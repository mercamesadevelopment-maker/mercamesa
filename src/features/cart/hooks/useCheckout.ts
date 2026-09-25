'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  generateIdempotencyKey,
  createOrderWithItems,
  initiateZonapagosPayment,
  payWithSavedCard,
  getPaymentUrl,
} from '@/src/features/payment/services/payment.service';
import { CartItem } from '@/src/types';
import { fmt } from '@/src/constants';
import { checkoutCartDb, clearCartDb, fetchOrderMinPrice } from '../services/cart.service';
import { quoteCheckout, sumQuotes, type CheckoutQuote } from '../services/checkout-quote.service';
import { CARD_TOKENIZATION_ENABLED } from '@/src/features/payment/config';
import type { Database } from '@/types/database_generated';

type SavedPaymentMethod = Database['public']['Tables']['buyer_payment_methods']['Row'];

/**
 * Un carrito con productos de dos tiendas no se puede pagar de una sola vez:
 * cada tienda despacha por separado y genera su propia orden, y ZonaPagos cobra
 * una orden por redirección. El texto lo usan el hook (como corte final) y el
 * panel (como aviso), para que digan lo mismo.
 */
export const MENSAJE_CARRITO_MEZCLADO =
  'Tu canasta tiene productos de más de una tienda. Elige con cuál quieres seguir para poder pagar.';

/** Una tienda de la canasta que todavía no llega al valor mínimo de compra. */
export interface TiendaBajoMinimo {
  storeName: string;
  subtotal: number;
  /** Cuánto falta para llegar al mínimo. Siempre positivo. */
  shortfall: number;
}

/**
 * El mínimo dicho de la única forma que le sirve al comprador: cuánto falta y
 * en qué tienda. El mensaje anterior —"El pedido no alcanza el valor mínimo de
 * $12.000"— salía al pagar, no decía de qué tienda hablaba, y con dos tiendas en
 * la canasta contradecía el subtotal que mostraba el propio carrito.
 */
export function mensajeMinimo(tienda: TiendaBajoMinimo, minPrice: number): string {
  return `Te faltan ${fmt(tienda.shortfall)} para el mínimo de ${fmt(minPrice)} en ${tienda.storeName}.`;
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
   * Carrito con productos de dos tiendas. No debería poder armarse —`addToCart`
   * lo bloquea— pero la recuperación de un pago abandonado sí lo mezcla: los
   * ítems que quedaron en `pending` vuelven a `active` junto a lo que el
   * comprador haya agregado mientras tanto de otra tienda.
   */
  const hasMixedStores = cartByStore.length > 1;

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
   * Las tiendas que no llegan al mínimo, con cuánto les falta. El mínimo se
   * aplica por orden y cada tienda es una orden, así que se mide por grupo y no
   * sobre el subtotal sumado: con $10.000 en una tienda y $5.000 en otra el pie
   * mostraba $15.000 y el servidor rechazaba igual, sin decir por qué.
   */
  const storesBelowMinimum =
    minPrice === null
      ? []
      : cartByStore
          .map((group) => ({
            storeName: group.store.name,
            subtotal: group.items.reduce((acc, i) => acc + getPrice(i) * i.qty, 0),
          }))
          .filter((g) => g.subtotal < minPrice)
          .map((g) => ({ ...g, shortfall: minPrice - g.subtotal }));

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

    // Una cotización por tienda: cada grupo se despacha por separado y tiene su
    // propio domicilio.
    const groups = storesInCart.map((storeId) => ({
      store_id: String(storeId),
      delivery_address_id: selectedAddressId,
      items: state.cart
        .filter((i) => i.storeId === storeId)
        .map((i) => ({ store_product_id: String(i.id), quantity: i.qty })),
    }));

    Promise.all(groups.map(quoteCheckout))
      .then((quotes) => {
        if (cancelled) return;
        setQuote(sumQuotes(quotes));
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
  // Sin cotización no se puede pagar: no hay un total que cobrar. Y tampoco con
  // dos tiendas en la canasta o por debajo del mínimo, que son las dos formas
  // que tenía este flujo de llegar hasta el final para fallar (o, peor, de
  // cobrar menos de lo mostrado).
  const canPlaceOrder =
    !!quote &&
    !isQuoting &&
    !quoteError &&
    !hasMixedStores &&
    storesBelowMinimum.length === 0;

  const handlePlaceOrder = async (onClose: () => void) => {
    if (isPlacingOrder) return;

    // Se corta antes de crear nada: sin esto, una orden sin dirección se creaba
    // en silencio y quedaba imposible de despachar.
    if (!selectedAddressId) {
      setErrorMessage('Selecciona la dirección a la que quieres recibir tu pedido.');
      return;
    }

    if (hasMixedStores) {
      setErrorMessage(MENSAJE_CARRITO_MEZCLADO);
      return;
    }

    if (minPrice !== null && storesBelowMinimum.length > 0) {
      setErrorMessage(mensajeMinimo(storesBelowMinimum[0], minPrice));
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
      const idempotencyKey = generateIdempotencyKey();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone, document_number')
        .eq('id', buyerId)
        .single();

      if (!profile) {
        throw new Error('No se encontró el perfil del usuario');
      }

      if (!profile.document_number) {
        throw new Error('El usuario no tiene documento registrado');
      }

      if (!profile.email) {
        throw new Error('El usuario no tiene email registrado');
      }

      const nameParts = (profile.full_name || '').trim().split(' ');
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.slice(1).join(' ') || 'MercaMesa';

      // Un carrito es de una sola tienda: `addToCart` lo impide y el modal de
      // conflicto lo anuncia. Si aun así llegaran dos —la recuperación de un
      // pago abandonado puede mezclarlas—, se corta ACÁ, antes de crear nada.
      //
      // Antes esto era un `for` sobre `cartByStore` cuyo cuerpo terminaba en
      // `window.location.href = paymentUrl`: se creaba y se cobraba la orden de
      // la PRIMERA tienda y las demás se abandonaban en silencio, mientras la
      // pantalla mostraba el total sumado de todas (`sumQuotes`). El comprador
      // veía $106.185 y se le cobraban $69.047.
      if (cartByStore.length !== 1) {
        throw new Error(MENSAJE_CARRITO_MEZCLADO);
      }

      const group = cartByStore[0];
      const groupSubtotal = group.items.reduce(
        (acc, i) => acc + getPrice(i) * i.qty,
        0
      );

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
          client_idempotency_key: `${idempotencyKey}-${group.store.id}`,
        },
        items: group.items.map((i) => ({
          store_product_id: String(i.id),
          quantity: i.qty,
          unit_price: getPrice(i),
          total_price: getPrice(i) * i.qty,
          catalog_name: i.name,
          unit_name: i.unit || 'und',
          notes: i.notes || null,
        })),
        storeOrders: [
          {
            store_id: String(group.store.id),
            order_id: '',
            subtotal: groupSubtotal,
            has_refrigerated: false,
            notes: '',
          },
        ],
      };

      const orderResult = await createOrderWithItems(orderPayload);

      if (!orderResult?.data?.id) {
        throw new Error('No se pudo crear la orden');
      }

      const orderId = String(orderResult.data.id);
      // El monto a cobrar sale de la orden que acaba de crear el servidor, no
      // de una cuenta hecha acá: son la misma cifra solo si nadie manipuló nada.
      const groupTotal = Number(orderResult.data.total);
      const storeProductIds = group.items.map((i) => String(i.id));

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

      const zonapagosPayload = {
        idPago: Date.now().toString(),
        orderId: orderId,
        total: groupTotal,
        iva: 0,
        descripcion: `Pedido ${orderId} - ${group.store.name}`,
        email: profile.email,
        idCliente: String(profile.document_number),
        tipoIdCliente: '1',
        nombreCliente: firstName,
        apellidoCliente: lastName,
        telefonoCliente: profile.phone || '0000000000',
        guardarTarjeta: CARD_TOKENIZATION_ENABLED && saveCard,
      };

      const zonapagosResult = await initiateZonapagosPayment(zonapagosPayload);
      const paymentUrl = getPaymentUrl(zonapagosResult);

      if (paymentUrl) {
        try {
          // La recuperación del carrito ya no depende de una marca en
          // sessionStorage: al volver, la hidratación consulta los ítems
          // `pending` del comprador contra el estado de sus órdenes.
          await checkoutCartDb(buyerId, orderId, storeProductIds);
        } catch (e) {
          console.error('Error updating cart status to pending in DB:', e);
        }
        dispatch({ type: 'CLEAR_CART' });
        window.location.href = paymentUrl;
        return;
      }

      const errorMsg =
        typeof zonapagosResult?.str_descripcion_error === 'string'
          ? zonapagosResult.str_descripcion_error
          : typeof zonapagosResult?.error === 'string'
          ? zonapagosResult.error
          : typeof zonapagosResult?.mensaje === 'string'
          ? zonapagosResult.mensaje
          : 'No se obtuvo URL de pago';

      // Sin URL de pago no hay nada que cobrar. Lo que venía después —vaciar el
      // carrito y llevar a /orders— era inalcanzable: todas las salidas de arriba
      // retornan o lanzan.
      throw new Error(errorMsg);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Hubo un error procesando el pedido.';

      if (message === 'El usuario no tiene documento registrado' || message === 'El usuario no tiene email registrado') {
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
    quote,
    isQuoting,
    quoteError,
    canPlaceOrder,
    hasMixedStores,
    minPrice,
    storesBelowMinimum,
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
