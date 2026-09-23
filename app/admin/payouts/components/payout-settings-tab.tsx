'use client';

import { useEffect, useState } from 'react';
import { Loader2, Info, Plus } from 'lucide-react';
import { Button, Input } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { fechaCompleta } from '@/lib/dates/relative-time';
import { usePayoutSettings } from '../hooks/use-bank-accounts';
import type { ParametrosDispersion } from '../types';

/**
 * Los datos del ordenante: quién paga y desde dónde.
 *
 * Todos estos valores los asigna el banco —el NIT con su dígito de verificación,
 * la oficina, la cuenta, la clave del emisor— y no hay forma de deducirlos ni de
 * sembrarlos. Por eso la tabla arranca vacía y esta pantalla es lo primero que
 * hay que llenar para que la dispersión funcione.
 *
 * Es un histórico: cada cambio es una fila nueva, y cada liquidación recuerda
 * contra qué fila se generó.
 */
export function PayoutSettingsTab() {
  const { history, vigente, loading, error, fetchSettings, guardar } = usePayoutSettings();
  const [abierto, setAbierto] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  const vacio = {
    ordererDocumentType: '03',
    ordererDocumentNumber: '',
    ordererDv: '0',
    ordererSuffix: '01',
    ordererName: '',
    ordererAddress: '',
    ordererCity: '',
    bbvaOfficeCode: '',
    bbvaAccountNumber: '',
    emitterKey: '',
    paymentConcept: 'Pago de ventas MercaMesa',
    fileConsecutiveOffset: 0,
    holdDays: 3,
    notes: '',
  };

  const [form, setForm] = useState(vacio);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const abrir = () => {
    // Se precarga con lo vigente: casi siempre se cambia un solo campo, y
    // obligar a reescribir el NIT y la cuenta invita a equivocarse.
    setForm(vigente ? { ...vigente, notes: '' } as typeof vacio : vacio);
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

      {!vigente && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-900">
            Todavía no están cargados los datos del ordenante, así que no se puede generar
            ninguna dispersión. El NIT, la oficina, la cuenta y la clave del emisor los da BBVA
            al habilitar Global C@sh.
          </p>
        </div>
      )}

      {vigente && (
        <div className="rounded-3xl border border-mm-crd bg-white p-6">
          <h3 className="mb-4 text-sm font-bold text-mm-g">Vigente</h3>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Ordenante" valor={vigente.ordererName} />
            <Dato
              etiqueta="NIT"
              valor={`${vigente.ordererDocumentNumber}-${vigente.ordererDv}`}
            />
            <Dato etiqueta="Dirección" valor={vigente.ordererAddress} />
            <Dato etiqueta="Ciudad" valor={vigente.ordererCity} />
            <Dato etiqueta="Oficina BBVA" valor={vigente.bbvaOfficeCode} />
            <Dato etiqueta="Cuenta" valor={vigente.bbvaAccountNumber} />
            <Dato etiqueta="Clave del emisor" valor={vigente.emitterKey} />
            <Dato etiqueta="Concepto de pago" valor={vigente.paymentConcept} />
            <Dato etiqueta="Espera tras la entrega" valor={`${vigente.holdDays} días`} />
            <Dato
              etiqueta="Desfase del consecutivo"
              valor={String(vigente.fileConsecutiveOffset)}
            />
          </dl>
        </div>
      )}

      <Button onClick={abrir}>
        <Plus className="mr-1.5 h-4 w-4" />
        {vigente ? 'Nuevo ajuste' : 'Cargar los datos'}
      </Button>

      {history.length > 1 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-mm-g">Historial</h3>
          <div className="divide-y divide-mm-crd/40 rounded-2xl border border-mm-crd">
            {history.slice(1).map((h) => (
              <div key={h.id} className="px-4 py-3 text-xs">
                <p className="text-mm-txs">
                  <span className="font-bold text-mm-g">{h.ordererName}</span> ·{' '}
                  {h.bbvaAccountNumber} · espera {h.holdDays} días
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

      <Modal isOpen={abierto} onClose={() => setAbierto(false)} title="Parámetros de dispersión" maxWidth="max-w-2xl">
        <div className="space-y-5 p-6">
          <p className="text-xs text-mm-txs">
            Estos valores los entrega BBVA. Cada guardado crea una versión nueva; las
            liquidaciones ya generadas siguen apuntando a la que usaron.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="NIT (sin dígito de verificación)" value={form.ordererDocumentNumber}
              onChange={(v) => setForm({ ...form, ordererDocumentNumber: v.replace(/\D/g, '') })} />
            <Campo label="Dígito de verificación" value={form.ordererDv}
              onChange={(v) => setForm({ ...form, ordererDv: v.replace(/\D/g, '').slice(0, 1) })} />
            <div className="sm:col-span-2">
              <Campo label="Nombre del ordenante" value={form.ordererName}
                onChange={(v) => setForm({ ...form, ordererName: v })}
                hint="Máximo 36 caracteres en el archivo; lo que sobre se corta." />
            </div>
            <div className="sm:col-span-2">
              <Campo label="Dirección" value={form.ordererAddress}
                onChange={(v) => setForm({ ...form, ordererAddress: v })} />
            </div>
            <Campo label="Ciudad" value={form.ordererCity}
              onChange={(v) => setForm({ ...form, ordererCity: v })} />
            <Campo label="Código de oficina BBVA" value={form.bbvaOfficeCode}
              onChange={(v) => setForm({ ...form, bbvaOfficeCode: v.replace(/\D/g, '').slice(0, 4) })}
              hint="4 dígitos" />
            <Campo label="Número de cuenta" value={form.bbvaAccountNumber}
              onChange={(v) => setForm({ ...form, bbvaAccountNumber: v.replace(/\D/g, '').slice(0, 10) })}
              hint="10 dígitos" />
            <Campo label="Clave del emisor" value={form.emitterKey}
              onChange={(v) => setForm({ ...form, emitterKey: v })}
              hint="El código del usuario que genera el fichero" />
            <div className="sm:col-span-2">
              <Campo label="Concepto de pago" value={form.paymentConcept}
                onChange={(v) => setForm({ ...form, paymentConcept: v })}
                hint="Lo que verá la tienda en su extracto" />
            </div>
            <Campo label="Días de espera tras la entrega" value={String(form.holdDays)}
              onChange={(v) => setForm({ ...form, holdDays: Number(v.replace(/\D/g, '') || 0) })}
              hint="Colchón por si aparece una devolución" />
            <Campo label="Desfase del consecutivo" value={String(form.fileConsecutiveOffset)}
              onChange={(v) => setForm({ ...form, fileConsecutiveOffset: Number(v.replace(/\D/g, '') || 0) })}
              hint="Para continuar la numeración que el banco ya lleve" />
            <div className="sm:col-span-2">
              <Campo label="Observación del cambio" value={form.notes}
                onChange={(v) => setForm({ ...form, notes: v })} />
            </div>
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
  label, value, onChange, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Input
        label={label}
        value={value}
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
