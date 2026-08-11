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
import { checkoutCartDb, clearCartDb } from '../services/cart.service';
import { CARD_TOKENIZATION_ENABLED } from '@/src/features/payment/config';
import type { Database } from '@/types/database_generated';

type SavedPaymentMethod = Database['public']['Tables']['buyer_payment_methods']['Row'];

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

  const deliveryFeePerStore = 5000;
  const totalDeliveryFee = deliveryFeePerStore * cartByStore.length;
  const total = subtotal + totalDeliveryFee;

  const handlePlaceOrder = async (onClose: () => void) => {
    if (isPlacingOrder) return;

    // Se corta antes de crear nada: sin esto, una orden sin dirección se creaba
    // en silencio y quedaba imposible de despachar.
    if (!selectedAddressId) {
      setErrorMessage('Selecciona la dirección a la que quieres recibir tu pedido.');
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

      for (const group of cartByStore) {
        const groupSubtotal = group.items.reduce(
          (acc, i) => acc + getPrice(i) * i.qty,
          0
        );
        const groupTotal = groupSubtotal + deliveryFeePerStore;

        const orderPayload = {
          order: {
            buyer_id: buyerId,
            buyer_type: (state.userRole === 'wholesale' ? 'wholesale' : 'retail') as 'retail' | 'wholesale',
            status: 'pending' as const,
            payment_status: 'pending' as const,
            subtotal: groupSubtotal,
            delivery_fee: deliveryFeePerStore,
            discount: 0,
            total: groupTotal,
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
            await checkoutCartDb(buyerId, orderId, storeProductIds);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('pending_checkout_order_id', orderId);
            }
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

        throw new Error(errorMsg);
      }

      try {
        await clearCartDb(buyerId);
      } catch (e) {
        console.error('Error clearing cart in DB:', e);
      }
      dispatch({ type: 'CLEAR_CART' });
      router.push('/orders');
      onClose();
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
