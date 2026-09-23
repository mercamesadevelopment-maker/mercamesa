'use client';

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldX, Clock, AlertTriangle, FileText } from 'lucide-react';
import { Button, cn } from '@/src/components/Shared';
import { Modal } from '@/components/ui/modal/modal';
import { fechaCorta } from '@/lib/dates/relative-time';
import { useBankAccounts } from '../hooks/use-bank-accounts';
import type { CuentaBancaria } from '../types';

const ESTADO: Record<CuentaBancaria['status'], { label: string; icon: React.ElementType; clase: string }> = {
  pending: { label: 'Por verificar', icon: Clock, clase: 'border-amber-200 bg-amber-50' },
  verified: { label: 'Verificada', icon: ShieldCheck, clase: 'border-mm-g/25 bg-mm-gbg/30' },
  rejected: { label: 'Rechazada', icon: ShieldX, clase: 'border-r/30 bg-rl/40' },
};

const TIPO_DOC: Record<string, string> = {
  '00': 'Registro civil', '01': 'Cédula', '02': 'Cédula de extranjería',
  '03': 'NIT', '04': 'Tarjeta de identidad', '05': 'Pasaporte',
  '06': 'NIT extranjería', '07': 'Sociedad extranjera', '08': 'Fideicomiso',
  '09': 'NIT persona natural',
};

/**
 * La bandeja de verificación.
 *
 * Verificar una cuenta es cotejarla contra el certificado bancario que la tienda
 * subió en sus documentos, así que la pantalla muestra el número COMPLETO —al
 * revés que el detalle de una liquidación, donde no hace falta— y recuerda dónde
 * está el documento con el que se compara.
 */
export function BankAccountsTab() {
  const { accounts, sinCuenta, loading, error, fetchAccounts, verificar } = useBankAccounts();
  const [revisando, setRevisando] = useState<CuentaBancaria | null>(null);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const decidir = async (aprobar: boolean) => {
    if (!revisando) return;
    if (!aprobar && !motivo.trim()) {
      setFallo('Escribe por qué se rechaza, para que la tienda sepa qué corregir.');
      return;
    }
    setTrabajando(true);
    setFallo(null);
    try {
      await verificar(revisando.id, aprobar, motivo.trim());
      setRevisando(null);
      setMotivo('');
    } catch (e: unknown) {
      setFallo(e instanceof Error ? e.message : 'No se pudo actualizar.');
    } finally {
      setTrabajando(false);
    }
  };

  const pendientes = accounts.filter((a) => a.status === 'pending').length;

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

      {pendientes > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-900">
            {pendientes} {pendientes === 1 ? 'cuenta espera' : 'cuentas esperan'} verificación.
            Mientras tanto, los pedidos entregados de esas tiendas no entran a ninguna dispersión.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {accounts.map((c) => {
          const { label, icon: Icono, clase } = ESTADO[c.status];
          return (
            <div key={c.id} className={cn('rounded-2xl border p-4', clase)}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-mm-g">{c.storeName}</p>
                  <p className="text-xs text-mm-txs">
                    {c.bankName} · {c.accountKind === 'checking' ? 'Corriente' : 'Ahorros'}{' '}
                    {c.accountNumber}
                    {c.bbvaOfficeCode && ` · oficina ${c.bbvaOfficeCode}`}
                  </p>
                  <p className="text-xs text-mm-txw">
                    {c.holderName} · {TIPO_DOC[c.holderDocumentType] ?? c.holderDocumentType}{' '}
                    {c.holderDocumentNumber}
                    {c.holderDocumentDv !== '0' && `-${c.holderDocumentDv}`}
                  </p>
                  {c.status === 'rejected' && c.rejectionReason && (
                    <p className="mt-1 text-xs font-medium text-r">{c.rejectionReason}</p>
                  )}
                  {c.status === 'verified' && (
                    <p className="mt-1 text-xs text-mm-txw">
                      Verificada por {c.verifiedByName ?? 'alguien'}
                      {c.verifiedAt && ` el ${fechaCorta(c.verifiedAt)}`}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-mm-txs">
                    <Icono className="h-3.5 w-3.5" />
                    {label}
                  </span>
                  {c.status !== 'verified' && (
                    <Button size="sm" variant="outline" onClick={() => { setRevisando(c); setMotivo(''); setFallo(null); }}>
                      Revisar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Las tiendas sin cuenta no se pueden ignorar: son las que van a quedar
          fuera de la próxima dispersión sin que nadie lo note. */}
      {sinCuenta.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-mm-txs">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            {sinCuenta.length} {sinCuenta.length === 1 ? 'tienda activa sin cuenta' : 'tiendas activas sin cuenta'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {sinCuenta.map((t) => (
              <span key={t.id} className="rounded-full bg-mm-crd/30 px-3 py-1 text-xs text-mm-txs">
                {t.name}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-mm-txw">
            No se les puede dispersar hasta que registren su cuenta desde Mi Tienda → Datos bancarios.
          </p>
        </div>
      )}

      <Modal
        isOpen={!!revisando}
        onClose={() => setRevisando(null)}
        title="Verificar la cuenta"
        maxWidth="max-w-lg"
      >
        {revisando && (
          <div className="space-y-5 p-6">
            <div className="flex items-start gap-2.5 rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 p-4">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
              <p className="text-xs leading-relaxed text-mm-txs">
                Compara estos datos con el certificado bancario de{' '}
                <span className="font-bold text-mm-g">{revisando.storeName}</span>, en Tiendas →
                Documentos. El nombre y el documento del titular tienen que coincidir con los del
                banco, o la transferencia rebota.
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              <Fila etiqueta="Banco" valor={`${revisando.bankName} (${revisando.bankCode})`} />
              <Fila etiqueta="Tipo" valor={revisando.accountKind === 'checking' ? 'Corriente' : 'Ahorros'} />
              <Fila etiqueta="Cuenta" valor={revisando.accountNumber} />
              {revisando.bbvaOfficeCode && (
                <Fila etiqueta="Oficina BBVA" valor={revisando.bbvaOfficeCode} />
              )}
              <Fila etiqueta="Titular" valor={revisando.holderName} />
              <Fila
                etiqueta="Documento"
                valor={`${TIPO_DOC[revisando.holderDocumentType] ?? revisando.holderDocumentType} ${
                  revisando.holderDocumentNumber
                }${revisando.holderDocumentDv !== '0' ? `-${revisando.holderDocumentDv}` : ''}`}
              />
            </dl>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-mm-txw">
                Motivo del rechazo
              </label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Solo si la rechazas. La tienda lo va a leer."
                className="w-full resize-none rounded-2xl border border-mm-crd bg-white px-4 py-3 text-sm text-mm-g outline-none focus:border-mm-g"
              />
            </div>

            {fallo && (
              <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{fallo}</div>
            )}

            <div className="flex justify-end gap-3 border-t border-mm-crd/40 pt-4">
              <Button
                variant="outline"
                className="border-r/40 text-r hover:bg-rl"
                onClick={() => decidir(false)}
                disabled={trabajando}
              >
                Rechazar
              </Button>
              <Button onClick={() => decidir(true)} loading={trabajando}>
                <ShieldCheck className="mr-1.5 h-4 w-4" />
                Verificar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mm-txw">{etiqueta}</dt>
      <dd className="text-right font-bold text-mm-g">{valor}</dd>
    </div>
  );
}
