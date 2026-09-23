'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, Clock, Info } from 'lucide-react';
import { Button, Input, cn } from '@/src/components/Shared';

/**
 * Dónde le consignan a la tienda.
 *
 * La cuenta se PROPONE: nace pendiente y no entra a ninguna dispersión hasta que
 * MercaMesa la coteje contra el certificado bancario. Eso se dice en pantalla,
 * porque si no el tendero registra su cuenta, ve que todo quedó bien y no
 * entiende por qué no le llega el pago.
 *
 * Los datos no se editan: registrar otra cuenta reemplaza la anterior y vuelve a
 * empezar la verificación. Es a propósito —cambiar el destino del dinero sin que
 * nadie lo mire es justo lo que hay que evitar— y también se dice.
 */

interface Banco {
  code: string;
  name: string;
  isActive: boolean;
}

interface Cuenta {
  id: string;
  bankCode: string;
  bankName: string | null;
  accountKind: 'checking' | 'savings';
  accountNumber: string;
  bbvaOfficeCode: string | null;
  holderDocumentType: string;
  holderDocumentNumber: string;
  holderDocumentDv: string;
  holderName: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  verifiedAt: string | null;
}

/** Códigos del archivo del banco. Son los que pide el formato, no los nuestros. */
const TIPOS_DOCUMENTO = [
  { code: '01', label: 'Cédula de ciudadanía' },
  { code: '03', label: 'NIT (persona jurídica)' },
  { code: '09', label: 'NIT persona natural' },
  { code: '02', label: 'Cédula de extranjería' },
  { code: '05', label: 'Pasaporte' },
];

const BBVA = '0013';

const ESTADOS: Record<Cuenta['status'], { label: string; icon: React.ElementType; clase: string }> = {
  pending: { label: 'Pendiente de verificación', icon: Clock, clase: 'border-amber-200 bg-amber-50 text-amber-900' },
  verified: { label: 'Verificada', icon: ShieldCheck, clase: 'border-mm-g/25 bg-mm-gbg/50 text-mm-g' },
  rejected: { label: 'Rechazada', icon: ShieldAlert, clase: 'border-r/30 bg-rl text-r' },
};

export function BankAccountTab({ storeId }: { storeId: string }) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    bankCode: '',
    accountKind: 'savings' as 'checking' | 'savings',
    accountNumber: '',
    bbvaOfficeCode: '',
    holderDocumentType: '01',
    holderDocumentNumber: '',
    holderDocumentDv: '0',
    holderName: '',
  });

  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const [resCuenta, resBancos] = await Promise.all([
        fetch(`/api/stores/${storeId}/bank-account`),
        fetch('/api/admin/banks'),
      ]);
      const { data } = await resCuenta.json();
      const { data: listaBancos } = await resBancos.json();
      setCuenta(data ?? null);
      setBancos((listaBancos ?? []).filter((b: Banco) => b.isActive));
      // Sin cuenta todavía, el formulario se abre solo: es lo único que hay que
      // hacer en esta pestaña.
      setEditando(!data);
    } catch {
      setError('No se pudo cargar la información bancaria.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/bank-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'No se pudo guardar');
      setCuenta(json.data);
      setEditando(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la cuenta.');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  const esBbva = form.bankCode === BBVA;
  const esNit = form.holderDocumentType === '03' || form.holderDocumentType === '09';

  return (
    <div className="space-y-6">
      {cuenta && !editando && (
        <>
          <EstadoCuenta cuenta={cuenta} />

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dato etiqueta="Banco" valor={cuenta.bankName ?? cuenta.bankCode} />
            <Dato
              etiqueta="Tipo de cuenta"
              valor={cuenta.accountKind === 'checking' ? 'Corriente' : 'Ahorros'}
            />
            <Dato etiqueta="Número de cuenta" valor={cuenta.accountNumber} />
            {cuenta.bbvaOfficeCode && (
              <Dato etiqueta="Código de oficina" valor={cuenta.bbvaOfficeCode} />
            )}
            <Dato etiqueta="Titular" valor={cuenta.holderName} />
            <Dato
              etiqueta="Documento del titular"
              valor={`${cuenta.holderDocumentNumber}${
                cuenta.holderDocumentDv !== '0' ? `-${cuenta.holderDocumentDv}` : ''
              }`}
            />
          </dl>

          <div className="flex items-start gap-2.5 rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
            <p className="text-xs leading-relaxed text-mm-txs">
              Los datos de una cuenta no se editan. Si cambias de cuenta, registras una
              nueva y reemplaza a esta —y vuelve a quedar pendiente de verificación, así
              que puede demorarse un pago.
            </p>
          </div>

          <Button variant="outline" onClick={() => setEditando(true)}>
            Registrar otra cuenta
          </Button>
        </>
      )}

      {editando && (
        <div className="space-y-5">
          {cuenta && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">
                Esta cuenta reemplazará a la actual y quedará pendiente de verificación.
                Mientras tanto, tus pedidos entregados esperan para dispersarse.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo etiqueta="Banco">
              <select
                value={form.bankCode}
                onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                className="w-full rounded-2xl border border-mm-crd bg-white px-4 py-2.5 text-sm text-mm-g outline-none focus:border-mm-g"
              >
                <option value="">Selecciona...</option>
                {bancos.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
              {bancos.length <= 1 && (
                <p className="text-xs text-mm-txw">
                  ¿No ves tu banco? Pídele a MercaMesa que lo agregue al catálogo.
                </p>
              )}
            </Campo>

            <Campo etiqueta="Tipo de cuenta">
              <div className="flex gap-2">
                {([['savings', 'Ahorros'], ['checking', 'Corriente']] as const).map(([k, l]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm({ ...form, accountKind: k })}
                    className={cn(
                      'flex-1 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all',
                      form.accountKind === k
                        ? 'border-mm-g bg-mm-gbg text-mm-g'
                        : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </Campo>

            <Input
              label="Número de cuenta"
              value={form.accountNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })
              }
              placeholder="Solo números"
            />

            {esBbva && (
              <Input
                label="Código de oficina BBVA"
                value={form.bbvaOfficeCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, bbvaOfficeCode: e.target.value.replace(/\D/g, '').slice(0, 4) })
                }
                placeholder="4 dígitos, ej. 0401"
              />
            )}

            <Campo etiqueta="Tipo de documento del titular">
              <select
                value={form.holderDocumentType}
                onChange={(e) => setForm({ ...form, holderDocumentType: e.target.value })}
                className="w-full rounded-2xl border border-mm-crd bg-white px-4 py-2.5 text-sm text-mm-g outline-none focus:border-mm-g"
              >
                {TIPOS_DOCUMENTO.map((t) => (
                  <option key={t.code} value={t.code}>{t.label}</option>
                ))}
              </select>
            </Campo>

            <Input
              label="Número de documento"
              value={form.holderDocumentNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, holderDocumentNumber: e.target.value.replace(/\D/g, '') })
              }
              placeholder="Sin puntos ni guiones"
            />

            {esNit && (
              <Input
                label="Dígito de verificación"
                value={form.holderDocumentDv}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, holderDocumentDv: e.target.value.replace(/\D/g, '').slice(0, 1) })
                }
                placeholder="El número después del guion"
              />
            )}

            <div className="sm:col-span-2">
              <Input
                label="Nombre del titular"
                value={form.holderName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, holderName: e.target.value })
                }
                placeholder="Exactamente como figura en el banco"
              />
            </div>
          </div>

          <p className="text-xs text-mm-txw">
            El nombre y el documento tienen que coincidir con los del banco: si no,
            el banco rechaza la transferencia.
          </p>

          {error && (
            <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>
          )}

          <div className="flex gap-3">
            <Button onClick={guardar} loading={guardando}>
              {cuenta ? 'Reemplazar cuenta' : 'Registrar cuenta'}
            </Button>
            {cuenta && (
              <Button variant="outline" onClick={() => { setEditando(false); setError(null); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EstadoCuenta({ cuenta }: { cuenta: Cuenta }) {
  const { label, icon: Icono, clase } = ESTADOS[cuenta.status];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl border p-4', clase)}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-xs leading-relaxed">
        <p className="font-bold">{label}</p>
        {cuenta.status === 'pending' && (
          <p>
            MercaMesa la está cotejando con tu certificado bancario. Tus pedidos entregados
            esperan a que quede verificada para poder dispersarse.
          </p>
        )}
        {cuenta.status === 'rejected' && cuenta.rejectionReason && (
          <p>{cuenta.rejectionReason} — corrige y vuelve a registrarla.</p>
        )}
        {cuenta.status === 'verified' && <p>Tus pagos se consignan a esta cuenta.</p>}
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="ml-1 text-xs font-semibold text-mm-txw">{etiqueta}</label>
      {children}
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
