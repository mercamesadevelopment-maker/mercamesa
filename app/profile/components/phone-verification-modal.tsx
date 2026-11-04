'use client';

import { useEffect } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { Modal } from '@/components/ui/modal/modal';
import { Button } from '@/components/ui/button';
import { usePhoneVerification } from '../hooks/use-phone-verification';

/**
 * Verificar el teléfono: el usuario manda por WhatsApp, desde su número, el
 * código que le mostramos. Se cierra solo cuando llega.
 */
export function PhoneVerificationModal({
  isOpen,
  phone,
  verified,
  onClose,
  onVerified,
}: {
  isOpen: boolean;
  phone: string;
  verified: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { current, loading, error, expired, request, reset } = usePhoneVerification(onVerified);

  useEffect(() => {
    if (isOpen && !verified) request();
    if (!isOpen) reset();
  }, [isOpen, verified, request, reset]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verificar por WhatsApp" maxWidth="max-w-md">
      {verified ? (
        <div className="p-6 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-mm-g" />
          <p className="mb-6 font-display text-2xl text-mm-g">¡Número verificado!</p>
          <p className="mb-8 text-sm text-mm-txs">
            Ya puedes recibir por WhatsApp los avisos de tus pedidos y consultarlos con Carolina.
          </p>
          <Button className="w-full" onClick={onClose}>
            Listo
          </Button>
        </div>
      ) : (
        <div className="space-y-5 p-6">
          <p className="text-sm text-mm-txs">
            Envía este código por WhatsApp <span className="font-bold text-mm-g">desde el número {phone}</span>.
            Así comprobamos que es tuyo.
          </p>

          {error && <div className="rounded-2xl bg-rl px-4 py-3 text-sm text-r">{error}</div>}

          {current && !expired && (
            <>
              <p
                className="rounded-2xl bg-mm-gbg py-4 text-center font-mono text-3xl font-bold tracking-[0.3em] text-mm-g"
                aria-label="Código de verificación"
              >
                {current.code}
              </p>
              <a href={current.whatsappUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full" type="button">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp y enviar
                </Button>
              </a>
              <p className="text-center text-xs text-mm-txw">
                Esperando tu mensaje… Esta ventana se actualiza sola.
              </p>
            </>
          )}

          {expired && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-mm-txs">El código venció.</p>
              <Button variant="outline" className="w-full" loading={loading} onClick={request}>
                Pedir otro código
              </Button>
            </div>
          )}

          {!current && !expired && error && (
            <Button variant="outline" className="w-full" loading={loading} onClick={request}>
              Intentar de nuevo
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
