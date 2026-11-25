import React from 'react';
import { KeyRound, MapPinned, Phone } from 'lucide-react';
import { Disclosure } from '@/components/ui/disclosure/Disclosure';
import { DELIVERY_CODE_NOTICE } from '@/lib/copy/security-notice';
import type { DeliveryView } from '@/lib/pibox/delivery-view';

interface ProtectOrderCardProps {
  /** El domicilio de Picap, si ya hay uno. */
  delivery: DeliveryView | null;
  /** Ya se entregó: el código no aplica. */
  delivered: boolean;
}

/**
 * «Protege tu pedido»: el código de entrega, que se da solo al recibir, y lo
 * que sirve mientras llega (seguir el mapa, llamar al domiciliario). El texto
 * largo de seguridad queda plegado.
 */
export function ProtectOrderCard({ delivery, delivered }: ProtectOrderCardProps) {
  const codigo = !delivered ? delivery?.deliveryValidationCode ?? null : null;
  const mapa = !delivered ? delivery?.trackingLink ?? null : null;
  const telefono = !delivered ? delivery?.driver?.phone ?? null : null;

  return (
    <section className="space-y-3 rounded-3xl bg-tinta p-5 text-hueso">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-hueso/70">Protege tu pedido</p>
          <p className="font-bold leading-snug">Entrega el código solo cuando recibas el pedido</p>
          {!codigo && (
            <p className="mt-1 text-xs text-hueso/70">Tu código aparece aquí cuando el domiciliario recoja el pedido.</p>
          )}
        </div>
        {codigo && (
          <div className="shrink-0 rounded-2xl bg-lima px-3 py-2 text-center text-tinta">
            <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase">
              <KeyRound className="h-3 w-3" /> Código
            </p>
            <p className="font-mono text-xl font-black tracking-widest">{codigo}</p>
          </div>
        )}
      </div>

      {(mapa || telefono) && (
        <div className="flex flex-wrap gap-2">
          {mapa && (
            <a
              href={mapa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-hueso px-3 py-1.5 text-xs font-bold text-tinta hover:bg-white"
            >
              <MapPinned className="h-3.5 w-3.5" /> Seguir en el mapa
            </a>
          )}
          {telefono && (
            <a
              href={`tel:${telefono}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-hueso/40 px-3 py-1.5 text-xs font-bold text-hueso hover:bg-hueso/10"
            >
              <Phone className="h-3.5 w-3.5" /> Llamar al domiciliario
            </a>
          )}
        </div>
      )}

      <Disclosure label="¿Por qué?" buttonClassName="text-xs text-lima hover:text-lima-clara">
        <div className="space-y-2 pt-2 text-xs leading-relaxed text-hueso/80">
          {DELIVERY_CODE_NOTICE.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Disclosure>
    </section>
  );
}
