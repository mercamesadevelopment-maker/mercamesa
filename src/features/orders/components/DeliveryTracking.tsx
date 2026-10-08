'use client';

import { Bike, Loader2, MapPinned, Phone, RotateCw, Search, AlertTriangle, CheckCircle2, KeyRound } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';
import type { DeliveryStage, DeliveryView, DeliveryViewer } from '@/lib/pibox/delivery-view';

interface DeliveryTrackingProps {
  delivery: DeliveryView | null;
  viewer: DeliveryViewer | null;
  loading: boolean;
  error: string | null;
  /** Solo tienda y admin: pide otro mensajero cuando el anterior se cerró. */
  onRequestAnother?: () => void;
  requesting?: boolean;
  /** Solo admin: las reservas anteriores (relanzadas o canceladas). */
  history?: DeliveryView[];
}

/** Los pasos que ve quien sigue el pedido, en orden. */
const STEPS: { stage: DeliveryStage; label: string }[] = [
  { stage: 'assigned', label: 'Asignado' },
  { stage: 'picking_up', label: 'Recogiendo' },
  { stage: 'on_the_way', label: 'En camino' },
  { stage: 'delivered', label: 'Entregado' },
];

const STEP_INDEX: Partial<Record<DeliveryStage, number>> = {
  searching: -1,
  scheduled: -1,
  assigned: 0,
  picking_up: 1,
  on_the_way: 2,
  delivered: 3,
};

/**
 * El domicilio de Pibox de un pedido: buscando conductor, quién es y por dónde
 * va. Lo usan el comprador, la tienda y el admin; los campos que llegan ya
 * vienen recortados por rol desde la API.
 */
export function DeliveryTracking({
  delivery,
  viewer,
  loading,
  error,
  onRequestAnother,
  requesting = false,
  history,
}: DeliveryTrackingProps) {
  return (
    <div className="bg-white rounded-3xl border border-mm-crd p-6 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4 border-b border-mm-crd/65 pb-4">
        <div className="w-9 h-9 bg-mm-gbg/45 rounded-xl flex items-center justify-center text-mm-g">
          <Bike className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-mm-g text-base">Domicilio</h3>
          <p className="text-[10px] text-mm-txw font-black uppercase tracking-wider">Entrega con Picap</p>
        </div>
      </div>

      {loading && !delivery ? (
        <p className="flex items-center gap-2 text-xs text-mm-txw">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando el domicilio...
        </p>
      ) : !delivery ? (
        <p className="text-xs text-mm-txs">
          {viewer === 'buyer'
            ? 'Cuando la tienda tenga tu pedido listo, aquí verás al domiciliario que lo lleva.'
            : 'Todavía no se ha solicitado el domiciliario. Se pide solo al marcar el pedido como «Listo Recogida».'}
        </p>
      ) : (
        <DeliveryBody delivery={delivery} viewer={viewer} onRequestAnother={onRequestAnother} requesting={requesting} />
      )}

      {error && <p className="mt-3 text-xs font-medium text-r">{error}</p>}

      {history && history.length > 1 && (
        <div className="mt-4 border-t border-mm-crd/60 pt-3">
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-mm-txw">Reservas de este pedido</p>
          <ul className="space-y-1 text-[11px] text-mm-txs">
            {history.map((h) => (
              <li key={h.bookingId} className="flex justify-between gap-3">
                <span className="truncate font-mono">{h.bookingId}</span>
                <span className="shrink-0">{h.statusLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeliveryBody({
  delivery,
  viewer,
  onRequestAnother,
  requesting,
}: {
  delivery: DeliveryView;
  viewer: DeliveryViewer | null;
  onRequestAnother?: () => void;
  requesting: boolean;
}) {
  const { stage } = delivery;

  if (stage === 'closed') {
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            {delivery.statusLabel}.{' '}
            {viewer === 'buyer'
              ? 'La tienda va a solicitar otro domiciliario.'
              : 'El pedido sigue en «Listo Recogida»: solicita otro domiciliario.'}
          </span>
        </p>
        {viewer !== 'buyer' && onRequestAnother && (
          <Button size="sm" onClick={onRequestAnother} loading={requesting} className="w-full sm:w-auto">
            <RotateCw className="w-4 h-4" /> Solicitar otro domiciliario
          </Button>
        )}
      </div>
    );
  }

  const stepIndex = STEP_INDEX[stage] ?? -1;

  return (
    <div className="space-y-4">
      {stage === 'searching' || stage === 'scheduled' ? (
        <p className="flex items-center gap-2 text-sm font-bold text-mm-g">
          <Search className="w-4 h-4 animate-pulse" /> {delivery.statusLabel}
        </p>
      ) : stage === 'delivered' ? (
        <p className="flex items-center gap-2 text-sm font-bold text-ok">
          <CheckCircle2 className="w-4 h-4" /> Pedido entregado
        </p>
      ) : (
        <p className="text-sm font-bold text-mm-g">{delivery.statusLabel}</p>
      )}

      {/* Línea de tiempo corta: lo que le importa a quien espera. */}
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => (
          <li key={s.stage} className="flex flex-col gap-1">
            <span className={cn('h-1.5 rounded-full', i <= stepIndex ? 'bg-mm-g' : 'bg-mm-crd/60')} />
            <span className={cn('text-[10px] font-bold', i <= stepIndex ? 'text-mm-g' : 'text-mm-txw')}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>

      {delivery.driver && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-mm-gbg/40 border border-mm-crd/50 p-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-mm-txw">Conductor</p>
            <p className="text-sm font-bold text-mm-g truncate">{delivery.driver.name || 'Asignado'}</p>
            {delivery.driver.plates && (
              <p className="text-xs text-mm-txs">Placa {delivery.driver.plates}</p>
            )}
          </div>
          {delivery.driver.phone && (
            <a
              href={`tel:${delivery.driver.phone}`}
              className="flex items-center gap-1.5 rounded-xl bg-white border border-mm-crd px-3 py-2 text-xs font-bold text-mm-g hover:border-mm-g transition-colors"
            >
              <Phone className="w-3.5 h-3.5" /> Llamar
            </a>
          )}
        </div>
      )}

      {delivery.trackingLink && stage !== 'delivered' && (
        <a
          href={delivery.trackingLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-mm-g underline underline-offset-2 hover:text-mm-oro"
        >
          <MapPinned className="w-3.5 h-3.5" /> Seguir en el mapa
        </a>
      )}

      {/* Códigos: el de recogida es de la tienda; el de entrega, del comprador. */}
      {delivery.pickupValidationCode && stage !== 'delivered' && viewer !== 'buyer' && (
        <CodeLine label="Código de recogida (lo valida el conductor en la tienda)" code={delivery.pickupValidationCode} />
      )}
      {delivery.deliveryValidationCode && stage !== 'delivered' && viewer !== 'store' && (
        <CodeLine label="Código de entrega (dalo solo al recibir el pedido)" code={delivery.deliveryValidationCode} />
      )}

      {delivery.cost !== undefined && delivery.cost !== null && (
        <p className="text-xs text-mm-txs">
          Costo del domicilio: <span className="font-bold text-mm-g">{fmt(delivery.cost)}</span>
        </p>
      )}
    </div>
  );
}

function CodeLine({ label, code }: { label: string; code: string }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-mm-crd px-3 py-2 text-xs text-mm-txs">
      <span className="flex items-center gap-1.5">
        <KeyRound className="w-3.5 h-3.5 shrink-0" /> {label}
      </span>
      <span className="font-mono text-sm font-black tracking-widest text-mm-g">{code}</span>
    </p>
  );
}
