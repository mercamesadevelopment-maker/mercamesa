'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/src/store';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  generateIdempotencyKey,
  createOrderWithItems,
  initiateZonapagosPayment,
  getPaymentUrl,
} from '@/src/features/payment/services/payment.service';
import { CartItem } from '@/src/types';
import { checkoutCartDb, clearCartDb } from '../services/cart.service';

export function useCheckout() {
  const { state, dispatch } = useApp();
  const router = useRouter();
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      const { data: defaultAddress } = await supabase
        .from('delivery_addresses')
        .select('id')
        .eq('buyer_id', buyerId)
        .eq('is_default', true)
        .single();

      const nameParts = (profile.full_name || '').trim().split(' ');
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.slice(1).join(' ') || 'Mercamesa';

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
            delivery_address_id: defaultAddress?.id || null,
            client_idempotency_key: `${idempotencyKey}-${group.store.id}`,
          },
          items: group.items.map((i) => ({
            store_product_id: String(i.id),
            quantity: i.qty,
            unit_price: getPrice(i),
            total_price: getPrice(i) * i.qty,
            catalog_name: i.name,
            unit_name: i.unit || 'und',
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
        };

        const zonapagosResult = await initiateZonapagosPayment(zonapagosPayload);
        const paymentUrl = getPaymentUrl(zonapagosResult);

        if (paymentUrl) {
          try {
            const storeProductIds = group.items.map((i) => String(i.id));
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Hubo un error procesando el pedido.'
      );
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
  };
}
