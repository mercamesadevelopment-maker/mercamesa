'use client';

import { useEffect, useState } from 'react';
import { Loader2, Info, Plus } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { usePayoutSettings } from '../hooks/use-bank-accounts';

/** El ancho del campo Concepto 1 en el archivo del banco. */
const MAX_CONCEPTO = 40;

/**
 * Parámetros de la dispersión.
 *
 * En el formato por líneas de BBVA el archivo no lleva datos del ordenante:
 * cada línea es un pago y todo lo del beneficiario —titular, documento,
 * dirección, cuenta o llave Bre-B— sale de la cuenta verificada de su tienda.
 * Aquí solo queda lo que no es de nadie en particular: el concepto que ve la
 * tienda en su extracto y cuántos días se espera tras la entrega.
 *
 * Es un histórico: cada cambio es una fila nueva, y cada liquidación recuerda
 * contra qué fila se generó.
 */
export function PayoutSettingsTab() {
  const { history, vigente, loading, error, fetchSettings, guardar } = usePayoutSettings();
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const vacio = { paymentConcept: 'Pago de ventas MercaMesa', holdDays: 3, notes: '' };
  const [form, setForm] = useState(vacio);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const abrir = () => {
    setForm(
      vigente
        ? { paymentConcept: vigente.paymentConcept, holdDays: vigente.holdDays, notes: '' }
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
      setFallo(e instanceof Error ? e.message : 'No se pudieron guardar los parámetros.');
    } finally {
      setTrabajando(false);
    }
  };

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
          El archivo es de una línea por pago. Los datos de cada línea —titular, documento,
          dirección, y la cuenta o la llave Bre-B— salen de la cuenta verificada de cada tienda
          en «Cuentas bancarias». Aquí solo va el concepto que la tienda verá en su extracto y la
          espera tras la entrega.
        </p>
      </div>

      {vigente && (
        <div className="rounded-3xl border border-mm-crd bg-white p-6">
          <h3 className="mb-4 text-sm font-bold text-mm-g">Vigente</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Concepto de pago" valor={vigente.paymentConcept} />
            <Dato etiqueta="Espera tras la entrega" valor={`${vigente.holdDays} días`} />
          </dl>
        </div>
      )}

      <Button onClick={abrir}>
        <Plus className="mr-1.5 h-4 w-4" />
        {vigente ? 'Nuevo ajuste' : 'Cargar los parámetros'}
      </Button>

      {history.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-mm-g">Historial</h3>
          <div className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
            {history.slice(1).map((h) => (
              <div key={h.id} className="px-4 py-3 text-xs">
                <p className="text-mm-txs">
                  <span className="font-bold text-mm-g">{h.paymentConcept}</span> · espera{' '}
                  {h.holdDays} días
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

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Parámetros de dispersión" maxWidth="max-w-lg">
        <div className="space-y-5 p-6">
          <p className="text-xs text-mm-txs">
            Cada guardado crea una versión nueva; las liquidaciones ya generadas siguen
            apuntando a la que usaron.
          </p>

          <div className="space-y-4">
            <Campo
              label="Concepto de pago"
              value={form.paymentConcept}
              maxLength={MAX_CONCEPTO}
              onChange={(v) => setForm({ ...form, paymentConcept: v })}
              hint={`Lo que verá la tienda en su extracto. ${form.paymentConcept.length} / ${MAX_CONCEPTO}`}
            />
            <Campo
              label="Días de espera tras la entrega"
              value={String(form.holdDays)}
              onChange={(v) => setForm({ ...form, holdDays: Number(v.replace(/\D/g, '') || 0) })}
              hint="Colchón por si aparece una devolución"
            />
            <Campo
              label="Observación del cambio"
              value={form.notes}
              onChange={(v) => setForm({ ...form, notes: v })}
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

function Campo({
  label, value, onChange, hint, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  maxLength?: number;
}) {
  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
        maxLength={maxLength}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      {hint && <p className="ml-1 text-xs text-mm-txw">{hint}</p>}
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
