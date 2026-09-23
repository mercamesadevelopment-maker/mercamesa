'use client';

import { useEffect, useState } from 'react';
import {
  Loader2, FileText, Download, Ban, Eye, RefreshCw, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Button, Badge, cn } from '@/src/components/Shared';
import { Table } from '@/components/ui/table/components/Table';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { Modal } from '@/components/ui/modal/modal';
import { fmt } from '@/src/constants';
import { fechaCorta, fechaCompleta } from '@/lib/dates/relative-time';
import { usePayouts } from '../hooks/use-payouts';
import type { Payout, PayoutDetalle, Elegibles } from '../types';

const ESTADO: Record<Payout['status'], { label: string; clase: string }> = {
  draft: { label: 'Borrador', clase: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Aprobada', clase: 'bg-mm-gbg text-mm-g' },
  cancelled: { label: 'Cancelada', clase: 'bg-mm-crd/40 text-mm-txw' },
};

/**
 * Las liquidaciones.
 *
 * Un borrador se revisa antes de aprobarlo, y aprobarlo es lo que genera el
 * archivo. Se avisa en el diálogo: a partir de ahí existe un .txt que alguien
 * puede subir al banco, y el banco no deshace transferencias.
 */
export function PayoutsTab() {
  const {
    payouts, loading, error, fetchPayouts, fetchElegibles, fetchDetalle,
    crearBorrador, aprobar, cancelar, descargar,
  } = usePayouts();

  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<{ title: string; message: string } | null>(null);
  const [elegibles, setElegibles] = useState<Elegibles | null>(null);
  const [detalle, setDetalle] = useState<PayoutDetalle | null>(null);
  const [confirmando, setConfirmando] = useState<{ payout: Payout; accion: 'approve' | 'cancel' } | null>(null);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const conError = (e: unknown) =>
    setAviso({
      title: 'No se pudo completar',
      message: e instanceof Error ? e.message : 'Error inesperado',
    });

  const verElegibles = async () => {
    setTrabajando(true);
    try { setElegibles(await fetchElegibles()); }
    catch (e) { conError(e); }
    finally { setTrabajando(false); }
  };

  const generar = async () => {
    setTrabajando(true);
    try {
      const r = await crearBorrador();
      setElegibles(null);
      setAviso({
        title: 'Borrador creado',
        message:
          `Quedaron ${r.itemsCount} pedidos de ${r.storesCount} tiendas, por ${fmt(r.totalAmount)}. ` +
          'Revísalo y apruébalo para generar el archivo del banco.',
      });
    } catch (e) { conError(e); }
    finally { setTrabajando(false); }
  };

  const confirmar = async () => {
    if (!confirmando) return;
    setTrabajando(true);
    try {
      if (confirmando.accion === 'approve') {
        const r = await aprobar(confirmando.payout.id);
        await descargar(confirmando.payout.id, r.fileName);
        setAviso({
          title: 'Archivo generado',
          message:
            `Se descargó ${r.fileName} con ${r.storesCount} pagos por ${fmt(r.totalAmount)}. ` +
            'Súbelo al portal del banco.',
        });
      } else {
        await cancelar(confirmando.payout.id);
        setAviso({
          title: 'Borrador cancelado',
          message: 'Sus pedidos vuelven a quedar disponibles para la próxima dispersión.',
        });
      }
      setConfirmando(null);
    } catch (e) { conError(e); setConfirmando(null); }
    finally { setTrabajando(false); }
  };

  const columns = [
    {
      key: 'consecutive',
      label: 'Liquidación',
      render: (p: Payout) => (
        <div>
          <p className="font-bold text-mm-g">{p.fileName ?? `Borrador #${p.consecutive}`}</p>
          <p className="text-xs text-mm-txw" title={fechaCompleta(p.scheduledFor)}>
            Proceso: {fechaCorta(p.scheduledFor)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: (p: Payout) => (
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', ESTADO[p.status].clase)}>
          {ESTADO[p.status].label}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Total',
      render: (p: Payout) => (
        <div>
          <p className="font-bold text-mm-g">{fmt(p.totalAmount)}</p>
          <p className="text-xs text-mm-txw">{p.itemsCount} pedidos</p>
        </div>
      ),
    },
    {
      key: 'quien',
      label: 'Quién',
      render: (p: Payout) => (
        <div className="space-y-0.5 text-xs text-mm-txs">
          <p>
            <span className="text-mm-txw">Generó: </span>
            {p.generatedByName ?? 'Automático'}
          </p>
          {p.approvedByName && (
            <p><span className="text-mm-txw">Aprobó: </span>{p.approvedByName}</p>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>}

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={verElegibles} loading={trabajando}>
          <Eye className="mr-1.5 h-4 w-4" />
          Ver qué se dispersaría
        </Button>
        <Button onClick={generar} loading={trabajando}>
          <FileText className="mr-1.5 h-4 w-4" />
          Generar borrador
        </Button>
        <Button variant="outline" onClick={() => fetchPayouts()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-mm-txw">
        El sistema arma un borrador solo los martes y jueves a las 6 a. m. Esto es para
        hacerlo antes, o para revisar sin crear nada.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
        </div>
      ) : (
        <Table<Payout>
          data={payouts}
          columns={columns}
          getRowKey={(p) => p.id}
          emptyMessage="Todavía no hay liquidaciones."
          actions={(p: Payout) => (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try { setDetalle(await fetchDetalle(p.id)); } catch (e) { conError(e); }
                }}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Ver
              </Button>
              {p.status === 'draft' && (
                <>
                  <Button size="sm" onClick={() => setConfirmando({ payout: p, accion: 'approve' })}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Aprobar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-r/40 text-r hover:bg-rl"
                    onClick={() => setConfirmando({ payout: p, accion: 'cancel' })}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                </>
              )}
              {p.hasFile && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try { await descargar(p.id, p.fileName!); } catch (e) { conError(e); }
                  }}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Descargar
                </Button>
              )}
            </div>
          )}
        />
      )}

      <VistaPrevia elegibles={elegibles} onClose={() => setElegibles(null)} onGenerar={generar} trabajando={trabajando} />
      <DetalleModal detalle={detalle} onClose={() => setDetalle(null)} />

      <ConfirmModal
        isOpen={!!confirmando}
        onClose={() => setConfirmando(null)}
        onConfirm={confirmar}
        isLoading={trabajando}
        variant={confirmando?.accion === 'approve' ? 'warning' : 'danger'}
        title={confirmando?.accion === 'approve' ? 'Aprobar y generar el archivo' : 'Cancelar el borrador'}
        confirmText={confirmando?.accion === 'approve' ? 'Sí, generar' : 'Sí, cancelar'}
        message={
          confirmando?.accion === 'approve' ? (
            <>
              Se generará el archivo para el banco con{' '}
              <span className="font-bold text-mm-g">{confirmando.payout.itemsCount} pedidos</span> por{' '}
              <span className="font-bold text-mm-g">{fmt(confirmando.payout.totalAmount)}</span>, y se
              descargará.
              {'\n\n'}
              A partir de ahí la liquidación no se puede deshacer desde acá: una vez subas el archivo
              al portal, el banco transfiere y no hay vuelta atrás. Revisa el detalle antes.
            </>
          ) : (
            <>
              El borrador quedará cancelado y sus{' '}
              <span className="font-bold text-mm-g">{confirmando?.payout.itemsCount} pedidos</span>{' '}
              volverán a quedar disponibles para la próxima dispersión.
            </>
          )
        }
      />

      <ConfirmModal
        isOpen={!!aviso}
        onClose={() => setAviso(null)}
        onConfirm={() => setAviso(null)}
        variant="info"
        hideCancel
        confirmText="Entendido"
        title={aviso?.title ?? ''}
        message={aviso?.message ?? ''}
      />
    </div>
  );
}

/** Qué se pagaría ahora, y qué queda fuera y por qué. */
function VistaPrevia({
  elegibles, onClose, onGenerar, trabajando,
}: {
  elegibles: Elegibles | null;
  onClose: () => void;
  onGenerar: () => void;
  trabajando: boolean;
}) {
  return (
    <Modal isOpen={!!elegibles} onClose={onClose} title="Qué se dispersaría ahora" maxWidth="max-w-3xl">
      {elegibles && (
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between rounded-2xl border border-mm-g/25 bg-mm-gbg/40 p-4">
            <div>
              <p className="text-sm text-mm-txs">
                {elegibles.ordersCount} pedidos · {elegibles.stores.length} tiendas
              </p>
              <p className="text-2xl font-bold text-mm-g">{fmt(elegibles.total)}</p>
            </div>
            {elegibles.ordersCount > 0 && (
              <Button onClick={onGenerar} loading={trabajando}>Generar borrador</Button>
            )}
          </div>

          {elegibles.stores.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-mm-g">Se les pagaría a</h3>
              <div className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
                {elegibles.stores.map((s) => (
                  <div key={s.storeId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-mm-g">{s.storeName}</span>
                    <span className="text-mm-txw">
                      {s.orders} {s.orders === 1 ? 'pedido' : 'pedidos'} ·{' '}
                      <span className="font-bold text-mm-g">{fmt(s.amount)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lo descartado se muestra, no se esconde: un pedido que no aparece
              por ningún lado parece un error del sistema. */}
          {elegibles.discarded.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                {elegibles.discarded.length} quedan fuera
              </h3>
              <div className="divide-y divide-amber-200/60 rounded-2xl border border-amber-200 bg-amber-50/50">
                {elegibles.discarded.map((d) => (
                  <div key={d.storeOrderId} className="flex items-start justify-between gap-4 px-4 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-mm-g">{d.storeName}</p>
                      <p className="text-mm-txw">{d.storeOrderCode} · {fmt(d.amount)}</p>
                    </div>
                    <span className="shrink-0 text-right text-amber-900">{d.reasonLabel}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-mm-txw">
                El periodo de espera tras la entrega es de {elegibles.holdDays} días.
              </p>
            </div>
          )}

          {elegibles.ordersCount === 0 && elegibles.discarded.length === 0 && (
            <p className="py-8 text-center text-sm text-mm-txw">
              No hay pedidos entregados pendientes de pago.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

/** El detalle de una liquidación, por tienda y con sus pedidos. */
function DetalleModal({ detalle, onClose }: { detalle: PayoutDetalle | null; onClose: () => void }) {
  return (
    <Modal
      isOpen={!!detalle}
      onClose={onClose}
      title={detalle?.fileName ?? `Borrador #${detalle?.consecutive ?? ''}`}
      maxWidth="max-w-3xl"
    >
      {detalle && (
        <div className="space-y-5 p-6">
          <div className="flex items-center justify-between rounded-2xl bg-mm-gbg/40 p-4">
            <span className="text-sm text-mm-txs">
              {detalle.itemsCount} pedidos · {detalle.stores.length} tiendas
            </span>
            <span className="text-xl font-bold text-mm-g">{fmt(detalle.totalAmount)}</span>
          </div>

          <div className="space-y-3">
            {detalle.stores.map((s) => (
              <div key={s.storeId} className="rounded-2xl border border-mm-crd p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-bold text-mm-g">{s.storeName}</p>
                    <p className="text-xs text-mm-txw">
                      {s.holderName} ·{' '}
                      {s.accountKind === 'checking' ? 'Corriente' : 'Ahorros'} ····{s.accountLast4}
                    </p>
                  </div>
                  <span className="shrink-0 font-bold text-mm-g">{fmt(s.amount)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.orders.map((o) => (
                    <Badge key={o.id} className="text-[10px]">
                      {o.code} · {fmt(o.amount)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
