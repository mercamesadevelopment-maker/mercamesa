'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Clock, ArrowLeft, RefreshCw } from 'lucide-react';
import { syncPaymentStatus } from '@/src/features/payment/services/payment.service';
import { useApp } from '@/src/store';
import { deleteCartForOrderDb, revertCartDb, fetchCart } from '@/src/features/cart/services/cart.service';
import Link from 'next/link';

function PaymentStatusContent() {
  const { state, dispatch } = useApp();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async () => {
    if (!orderId) {
      setError('ID de pedido no encontrado en la URL');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await syncPaymentStatus(orderId);
      setStatus(result.paymentStatus);

      if (result.paymentStatus === 'approved') {
        try {
          await deleteCartForOrderDb(orderId);
        } catch (e) {
          console.error('Error deleting pending cart items:', e);
        }
      } else if (result.paymentStatus === 'rejected') {
        try {
          await revertCartDb(orderId);
          // Refetch active cart from database
          const buyerId = state.buyerProfile?.id;
          if (buyerId) {
            const items = await fetchCart(buyerId);
            dispatch({ type: 'HYDRATE_CART', cart: items });
          }
        } catch (e) {
          console.error('Error reverting pending cart items in DB:', e);
        }
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pending_checkout_order_id');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al verificar el estado del pago');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, [orderId]);

  if (loading) {
    return (
      <div className="bg-white p-10 rounded-[40px] shadow-sm border border-mm-crd flex flex-col items-center max-w-md w-full">
        <RefreshCw className="w-16 h-16 text-mm-g animate-spin mb-6" />
        <h1 className="text-2xl font-fraunces text-mm-g mb-2 text-center">Verificando Pago</h1>
        <p className="text-mm-txs text-center">Estamos consultando el estado de tu transacción con Zonapagos...</p>
      </div>
    );
  }

  const renderStatus = () => {
    switch (status) {
      case 'approved':
        return (
          <>
            <CheckCircle2 className="w-20 h-20 text-mm-g mb-6" />
            <h1 className="text-3xl font-fraunces text-mm-g mb-2 text-center">¡Pago Exitoso!</h1>
            <p className="text-mm-txs text-center mb-8">
              Tu pedido ha sido confirmado y pronto comenzará su preparación.
            </p>
          </>
        );
      case 'rejected':
        return (
          <>
            <XCircle className="w-20 h-20 text-red-500 mb-6" />
            <h1 className="text-3xl font-fraunces text-red-600 mb-2 text-center">Pago Rechazado</h1>
            <p className="text-mm-txs text-center mb-8">
              Lo sentimos, la transacción no pudo ser completada. Por favor, intenta nuevamente o usa otro medio de pago.
            </p>
          </>
        );
      case 'processing':
      case 'pending':
        return (
          <>
            <Clock className="w-20 h-20 text-orange-400 mb-6" />
            <h1 className="text-3xl font-fraunces text-orange-500 mb-2 text-center">Pago en Proceso</h1>
            <p className="text-mm-txs text-center mb-8">
              Zonapagos aún está procesando tu pago. Esto puede tardar unos minutos. Te avisaremos cuando el estado cambie.
            </p>
          </>
        );
      default:
        return (
          <>
            <XCircle className="w-20 h-20 text-red-500 mb-6" />
            <h1 className="text-3xl font-fraunces text-red-600 mb-2 text-center">Error en la Verificación</h1>
            <p className="text-mm-txs text-center mb-8">
              {error || 'No pudimos determinar el estado de tu pago.'}
            </p>
          </>
        );
    }
  };

  return (
    <div className="bg-white p-10 rounded-[40px] shadow-sm border border-mm-crd flex flex-col items-center max-w-md w-full">
      {renderStatus()}
      
      <div className="grid grid-cols-1 gap-4 w-full">
        <Link 
          href="/orders"
          className="flex items-center justify-center bg-mm-g text-white py-4 px-6 rounded-2xl font-bold hover:bg-mm-g/90 transition-colors"
        >
          Ver mis pedidos
        </Link>
        
        {(status !== 'approved' && status !== 'rejected') && (
          <button 
            onClick={checkStatus}
            className="flex items-center justify-center border border-mm-crd text-mm-g py-4 px-6 rounded-2xl font-bold hover:bg-mm-bg transition-colors"
          >
            Actualizar estado
          </button>
        )}
        
        <Link 
          href="/"
          className="flex items-center justify-center text-mm-txs font-medium hover:text-mm-g transition-colors mt-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}

export default function PaymentStatusPage() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-mm-bg">
      <Suspense fallback={
        <div className="bg-white p-10 rounded-[40px] shadow-sm border border-mm-crd flex flex-col items-center max-w-md w-full">
          <RefreshCw className="w-16 h-16 text-mm-g animate-spin mb-6" />
          <p className="text-mm-txs text-center font-bold animate-pulse">Cargando...</p>
        </div>
      }>
        <PaymentStatusContent />
      </Suspense>
    </div>
  );
}
