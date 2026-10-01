'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  generateIdempotencyKey,
  createOrderWithItems,
  payWithSavedCard,
  obtenerPerfilDePago,
  iniciarPagoDeOrden,
  PERFIL_SIN_DOCUMENTO,
  PERFIL_SIN_EMAIL,
} from '@/src/features/payment/services/payment.service';
import { CartItem } from '@/src/types';
import { fmt } from '@/src/constants';
import { checkoutCartDb, clearCartDb, fetchOrderMinPrice } from '../services/cart.service';
import { quoteCheckout, type CheckoutQuote } from '../services/checkout-quote.service';
import { CARD_TOKENIZATION_ENABLED } from '@/src/features/payment/config';
import type { Database } from '@/types/database_generated';

type SavedPaymentMethod = Database['public']['Tables']['buyer_payment_methods']['Row'];

/** Cuánto le falta a la canasta para llegar al valor mínimo de compra. */
export interface FaltanteDelMinimo {
  subtotal: number;
  /** Siempre positivo. */
  shortfall: number;
}

/**
 * El mínimo dicho de la única forma que le sirve al comprador: cuánto falta.
 * Se mide sobre el pedido completo —el domicilio es uno por pedido—, así que
 * con varias tiendas en la canasta basta con que entre todas lleguen.
 */
export function mensajeMinimo(faltante: FaltanteDelMinimo, minPrice: number): string {
  return `Te faltan ${fmt(faltante.shortfall)} para el mínimo de compra de ${fmt(minPrice)}.`;
}

export function useCheckout() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveCard, setSaveCard] = useState(false);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([]);
  const [paymentChoice, setPaymentChoice] = useState<'saved' | 'new'>('new');
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  useEffect(() => {
    // Con la tokenización apagada no hay dónde usar las tarjetas guardadas,
    // así que ni siquiera se consultan.
    if (!CARD_TOKENIZATION_ENABLED) return;

    const loadSavedPaymentMethods = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('buyer_payment_methods')
        .select('*')
        .eq('buyer_id', user.id)
        .not('zonapagos_token', 'is', null)
        .order('is_default', { ascending: false });

      const methods = data || [];
      setSavedPaymentMethods(methods);

      if (methods.length > 0) {
        setPaymentChoice('saved');
        setSelectedPaymentMethodId(methods[0].id);
      }
    };

    loadSavedPaymentMethods();
  }, []);

  const isWS = state.userRole === 'wholesale';
  const getPrice = (item: CartItem) => (isWS ? item.wsPrice : item.retailPrice);

  const storesInCart = Array.from(new Set(state.cart.map((i) => i.storeId)));

  const cartByStore = storesInCart.map((storeId) => {
    const storeFromState = state.stores.find((s) => s.id === storeId);
    return {
      store: storeFromState || {
        id: storeId,
        plazaId: 0,
        emoji: '🏪',
        name: 'Tienda',
        ownerName: '',
        cat: '',
        phone: '',
        desc: '',
        open: true,
        rating: 0,
        reviewCount: 0,
        local: '',
        status: 'active',
        openTime: '',
        closeTime: '',
        location: { lat: 0, lng: 0 },
        email: '',
      },
      items: state.cart.filter((i) => i.storeId === storeId),
    };
  });

  const subtotal = state.cart.reduce(
    (acc, item) => acc + getPrice(item) * item.qty,
    0
  );

  /**
   * El valor mínimo de compra. Se consulta acá y no en la cotización porque el
   * mínimo no depende del domicilio: así el paso 1 puede avisar antes de pedir
   * la dirección, en vez de dejar que el comprador se entere al pagar.
   */
  const [minPrice, setMinPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchOrderMinPrice()
      .then((valor) => {
        if (!cancelled) setMinPrice(valor);
      })
      // Si no se puede leer, no se bloquea la compra: el servidor lo vuelve a
      // comprobar de todos modos. Solo se pierde el aviso temprano.
      .catch((e) => console.error('No se pudo leer el valor mínimo de compra:', e));

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Cuánto falta para el mínimo, o `null` si ya se alcanzó. Se mide sobre toda
   * la canasta, igual que lo hace el servidor (`assertMinimumPurchase`).
   */
  const belowMinimum: FaltanteDelMinimo | null =
    minPrice !== null && state.cart.length > 0 && subtotal < minPrice
      ? { subtotal, shortfall: minPrice - subtotal }
      : null;

  // El precio ya no se calcula en el navegador: el servidor cotiza el domicilio
  // con el operador logístico y aplica las comisiones parametrizadas. Acá solo se
  // muestra lo que él responde.
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Firma del carrito: evita recotizar cuando cambia algo que no afecta el precio
  // (notas, por ejemplo) y evita el bucle de un array nuevo en cada render.
  const cartSignature = state.cart
    .map((i) => `${i.id}:${i.qty}:${getPrice(i)}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (!selectedAddressId || state.cart.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let cancelled = false;
    setIsQuoting(true);
    setQuoteError(null);

    // Una sola cotización para toda la canasta: aunque lleve varias tiendas, el
    // pedido sale en una entrega y paga un domicilio.
    quoteCheckout({
      delivery_address_id: selectedAddressId,
      items: state.cart.map((i) => ({ store_product_id: String(i.id), quantity: i.qty })),
    })
      .then((cotizacion) => {
        if (cancelled) return;
        setQuote(cotizacion);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError(err instanceof Error ? err.message : 'No pudimos calcular el total de tu pedido.');
      })
      .finally(() => {
        if (!cancelled) setIsQuoting(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature, selectedAddressId]);

  const totalDeliveryFee = quote?.deliveryFee ?? 0;
  const total = quote?.total ?? 0;

  /**
   * Saldo a favor. Lo que se muestra acá es una vista previa: cuánto se usa de
   * verdad lo decide el servidor al crear el pedido, con el saldo de ese
   * momento.
   */
  const [creditBalance, setCreditBalance] = useState(0);
  const [useCredit, setUseCredit] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/profile/credit')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.data) setCreditBalance(Math.max(0, Number(json.data.balance) || 0));
      })
      // Sin saldo a la vista se compra igual, pagando el total.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const creditToApply = useCredit ? Math.min(creditBalance, total) : 0;
  const totalToPay = total - creditToApply;
  // Sin cotización no se puede pagar: no hay un total que cobrar. Tampoco por
  // debajo del mínimo: el servidor lo rechazaría al final.
  const canPlaceOrder = !!quote && !isQuoting && !quoteError && belowMinimum === null;

  const handlePlaceOrder = async (onClose: () => void) => {
    if (isPlacingOrder) return;

    // Se corta antes de crear nada: sin esto, una orden sin dirección se creaba
    // en silencio y quedaba imposible de despachar.
    if (!selectedAddressId) {
      setErrorMessage('Selecciona la dirección a la que quieres recibir tu pedido.');
      return;
    }

    if (minPrice !== null && belowMinimum) {
      setErrorMessage(mensajeMinimo(belowMinimum, minPrice));
      return;
    }

    // Sin cotización no hay total que cobrar. El servidor también lo rechaza,
    // pero cortar acá evita un viaje inútil y un mensaje confuso.
    if (!canPlaceOrder) {
      setErrorMessage(quoteError ?? 'Estamos calculando el total de tu pedido, espera un momento.');
      return;
    }

    setIsPlacingOrder(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Usuario no autenticado');
      }

      const buyerId = user.id;
      // Ya no evita duplicados por sí sola: se genera por clic. El que reutiliza
      // el pedido de un reintento es `POST /api/orders`, comparando el carrito.
      const idempotencyKey = generateIdempotencyKey();

      // Antes de crear el pedido: sin documento o correo no hay cómo pagarlo.
      const perfil = await obtenerPerfilDePago();

      // Un solo pedido para toda la canasta. Antes esto era un `for` por tienda
      // cuyo cuerpo terminaba en `window.location.href = paymentUrl`: se cobraba
      // la primera tienda y las demás se abandonaban en silencio. Ahora todas
      // las tiendas van en el mismo pedido y se pagan juntas.
      if (cartByStore.length === 0) {
        throw new Error('Tu canasta está vacía.');
      }

      // Los precios no viajan en el payload: el servidor los recalcula desde la
      // base y cotiza el domicilio. Mandarlos solo daría la falsa impresión de
      // que el navegador decide cuánto se cobra.
      const orderPayload = {
        order: {
          buyer_id: buyerId,
          buyer_type: (state.userRole === 'wholesale' ? 'wholesale' : 'retail') as 'retail' | 'wholesale',
          status: 'pending' as const,
          payment_status: 'pending' as const,
          notes: 'Pedido desde la web',
          delivery_address_id: selectedAddressId,
          client_idempotency_key: idempotencyKey,
          use_credit: useCredit && creditBalance > 0,
        },
        items: state.cart.map((i) => ({
          store_product_id: String(i.id),
          quantity: i.qty,
          unit_price: getPrice(i),
          total_price: getPrice(i) * i.qty,
          catalog_name: i.name,
          unit_name: i.unit || 'und',
          notes: i.notes || null,
        })),
        // Informativo: el servidor arma las partes de cada tienda a partir de
        // los productos y recalcula los subtotales.
        storeOrders: cartByStore.map((group) => ({
          store_id: String(group.store.id),
          order_id: '',
          subtotal: group.items.reduce((acc, i) => acc + getPrice(i) * i.qty, 0),
          has_refrigerated: false,
          notes: '',
        })),
      };

      const orderResult = await createOrderWithItems(orderPayload);

      if (!orderResult?.data?.id) {
        throw new Error('No se pudo crear la orden');
      }

      const orderId = String(orderResult.data.id);
      const storeProductIds = state.cart.map((i) => String(i.id));

      // El saldo a favor cubrió todo: el pedido ya quedó pagado y no hay nada
      // que cobrar en la pasarela.
      if (orderResult.data.payment_status === 'approved') {
        dispatch({ type: 'CLEAR_CART' });
        try {
          await clearCartDb(buyerId);
        } catch (e) {
          console.error('Error clearing cart in DB:', e);
        }
        router.push('/orders');
        onClose();
        return;
      }

      if (paymentChoice === 'saved' && selectedPaymentMethodId) {
        try {
          await checkoutCartDb(buyerId, orderId, storeProductIds);
        } catch (e) {
          console.error('Error updating cart status to pending in DB:', e);
        }

        const result = await payWithSavedCard(orderId, selectedPaymentMethodId);

        if (result.paymentStatus === 'rejected') {
          throw new Error('El pago fue rechazado con la tarjeta guardada. Intenta con otro método de pago.');
        }

        dispatch({ type: 'CLEAR_CART' });
        try {
          await clearCartDb(buyerId);
        } catch (e) {
          console.error('Error clearing cart in DB:', e);
        }
        router.push('/orders');
        onClose();
        return;
      }

      // Sin URL de pago, `iniciarPagoDeOrden` lanza y el carrito queda como
      // estaba.
      const paymentUrl = await iniciarPagoDeOrden(orderId, {
        perfil,
        storeName:
          cartByStore.length === 1 ? cartByStore[0].store.name : `${cartByStore.length} tiendas`,
        guardarTarjeta: CARD_TOKENIZATION_ENABLED && saveCard,
      });

      try {
        // Los productos quedan del pedido mientras se pueda pagar: si el
        // comprador vuelve sin pagar, no reaparecen en el carrito, y lo retoma
        // desde «Mis órdenes». Vuelven solo si el pedido vence o el pago se
        // rechaza (ver `recoverAbandonedCartDb`).
        await checkoutCartDb(buyerId, orderId, storeProductIds);
      } catch (e) {
        console.error('Error updating cart status to pending in DB:', e);
      }
      dispatch({ type: 'CLEAR_CART' });
      window.location.href = paymentUrl;
      return;
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Hubo un error procesando el pedido.';

      if (message === PERFIL_SIN_DOCUMENTO || message === PERFIL_SIN_EMAIL) {
        dispatch({ type: 'SET_SECTION', section: 'profile_account' });
        router.push('/profile?incomplete=1');
        return;
      }

      setErrorMessage(message);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return {
    state,
    dispatch,
    isPlacingOrder,
    errorMessage,
    cartByStore,
    subtotal,
    totalDeliveryFee,
    total,
    creditBalance,
    useCredit,
    setUseCredit,
    creditToApply,
    totalToPay,
    quote,
    isQuoting,
    quoteError,
    canPlaceOrder,
    minPrice,
    belowMinimum,
    getPrice,
    handlePlaceOrder,
    saveCard,
    setSaveCard,
    savedPaymentMethods,
    paymentChoice,
    setPaymentChoice,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    selectedAddressId,
    setSelectedAddressId,
  };
}
