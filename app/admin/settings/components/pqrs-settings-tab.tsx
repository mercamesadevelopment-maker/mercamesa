'use client';

import { useEffect, useState } from 'react';
import { Loader2, Info, Plus } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { usePqrsSettings } from '../hooks/use-pqrs-settings';

/**
 * Los plazos de las PQRS.
 *
 * Es un histórico, como las tarifas: cada cambio es una fila nueva y cada caso
 * recuerda con qué plazos se radicó.
 */
export function PqrsSettingsTab() {
  const { history, vigente, loading, error, fetchSettings, guardar } = usePqrsSettings();
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const vacio = { claimWindowHours: 24, storeResponseHours: 24, notes: '' };
  const [form, setForm] = useState(vacio);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const abrir = () => {
    setForm(
      vigente
        ? { claimWindowHours: vigente.claimWindowHours, storeResponseHours: vigente.storeResponseHours, notes: '' }
        : vacio
    );
    setFallo(null);
    setAbierto(true);
  };

  const enviar = async () => {
    setTrabajando(true);
    setFallo(null);
    try {
      await guardar(form);
      setAbierto(false);
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudieron guardar los plazos.');
    } finally {
      setTrabajando(false);
    }
  };

  const soloNumeros = (v: string) => Number(v.replace(/\D/g, '') || 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>}

      <div className="flex items-start gap-2.5 rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
        <p className="text-xs leading-relaxed text-mm-txs">
          El plazo para reclamar debe ser menor que los días de espera de la dispersión
          (Dispersiones → Parámetros): así el reclamo llega antes de que se le pague a la tienda.
        </p>
      </div>

      {vigente && (
        <div className="rounded-3xl border border-mm-crd bg-white p-6">
          <h3 className="mb-4 text-sm font-bold text-mm-g">Vigente</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Plazo para reclamar por un producto" valor={`${vigente.claimWindowHours} horas desde la entrega`} />
            <Dato etiqueta="Plazo de respuesta de la tienda" valor={`${vigente.storeResponseHours} horas`} />
          </dl>
        </div>
      )}

      <Button onClick={abrir}>
        <Plus className="mr-1.5 h-4 w-4" />
        {vigente ? 'Nuevo ajuste' : 'Cargar los plazos'}
      </Button>

      {history.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-mm-g">Historial</h3>
          <div className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
            {history.slice(1).map((h) => (
              <div key={h.id} className="px-4 py-3 text-xs">
                <p className="text-mm-txs">
                  Reclamo: <span className="font-bold text-mm-g">{h.claimWindowHours} h</span> · respuesta de la
                  tienda: <span className="font-bold text-mm-g">{h.storeResponseHours} h</span>
                </p>
                <p className="text-mm-txw">
                  {fechaCompleta(h.createdAt)}
                  {h.changedByName && ` · ${h.changedByName}`}
                  {h.notes && ` · ${h.notes}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Plazos de PQRS" maxWidth="max-w-lg">
        <div className="space-y-5 p-6">
          <p className="text-xs text-mm-txs">
            Los casos ya radicados conservan el plazo con el que nacieron; el cambio aplica a los nuevos.
          </p>

          <div className="space-y-4">
            <Input
              label="Horas para reclamar por un producto, desde la entrega"
              inputMode="numeric"
              value={String(form.claimWindowHours)}
              onChange={(e) => setForm({ ...form, claimWindowHours: soloNumeros(e.target.value) })}
            />
            <Input
              label="Horas que tiene la tienda para responder"
              inputMode="numeric"
              value={String(form.storeResponseHours)}
              onChange={(e) => setForm({ ...form, storeResponseHours: soloNumeros(e.target.value) })}
            />
            <Input
              label="Observación del cambio"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {fallo && <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{fallo}</div>}

          <div className="flex justify-end gap-3 border-t border-mm-crd/40 pt-4">
            <Button variant="outline" onClick={() => setAbierto(false)} disabled={trabajando}>
              Cancelar
            </Button>
            <Button onClick={enviar} loading={trabajando}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-mm-txw">{etiqueta}</dt>
      <dd className="text-sm font-bold text-mm-g">{valor}</dd>
    </div>
  );
}
