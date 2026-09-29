'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert, Clock, Info } from 'lucide-react';
import { Button, Input, cn } from '@/src/components/Shared';

/**
 * Dónde le pagan a la tienda: una cuenta bancaria o una llave Bre-B.
 *
 * Los datos se PROPONEN: nacen pendientes y no entran a ninguna dispersión hasta
 * que MercaMesa los coteje contra el certificado bancario. Eso se dice en
 * pantalla, porque si no el tendero registra su cuenta, ve que todo quedó bien y
 * no entiende por qué no le llega el pago.
 *
 * Los datos no se editan: registrar otros reemplaza a los anteriores y vuelve a
 * empezar la verificación. Es a propósito —cambiar el destino del dinero sin que
 * nadie lo mire es justo lo que hay que evitar— y también se dice.
 */

interface Banco {
  code: string;
  name: string;
  isActive: boolean;
}

type Metodo = 'account' | 'breb';

interface Cuenta {
  id: string;
  paymentMethod: Metodo;
  brebKey: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountKind: 'checking' | 'savings' | null;
  accountNumber: string | null;
  bbvaOfficeCode: string | null;
  holderDocumentType: string;
  holderDocumentNumber: string;
  holderDocumentDv: string;
  holderName: string;
  holderAddress: string;
  holderEmail: string | null;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason: string | null;
  verifiedAt: string | null;
}

/**
 * Códigos del archivo del banco (formato por líneas). Son los que pide el
 * formato, no los nuestros: un NIT, sea de persona natural o jurídica, es `03`.
 */
const TIPOS_DOCUMENTO = [
  { code: '01', label: 'Cédula de ciudadanía' },
  { code: '03', label: 'NIT' },
  { code: '02', label: 'Cédula de extranjería' },
  { code: '04', label: 'Tarjeta de identidad' },
  { code: '05', label: 'Pasaporte' },
];

const BBVA = '0013';

/** Lo que cabe en el archivo del banco donde va la llave. */
const LARGO_MAXIMO_LLAVE = 17;

const ESTADOS: Record<Cuenta['status'], { label: string; icon: React.ElementType; clase: string }> = {
  pending: { label: 'Pendiente de verificación', icon: Clock, clase: 'border-amber-200 bg-amber-50 text-amber-900' },
  verified: { label: 'Verificada', icon: ShieldCheck, clase: 'border-mm-g/25 bg-mm-gbg/50 text-mm-g' },
  rejected: { label: 'Rechazada', icon: ShieldAlert, clase: 'border-r/30 bg-rl text-r' },
};

const CLASE_SELECT =
  'w-full rounded-2xl border border-mm-crd bg-white px-4 py-2.5 text-sm text-mm-g outline-none focus:border-mm-g';

export function BankAccountTab({ storeId }: { storeId: string }) {
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    paymentMethod: 'account' as Metodo,
    brebKey: '',
    bankCode: '',
    accountKind: 'savings' as 'checking' | 'savings',
    accountNumber: '',
    bbvaOfficeCode: '',
    holderDocumentType: '01',
    holderDocumentNumber: '',
    holderDocumentDv: '0',
    holderName: '',
    holderAddress: '',
    holderEmail: '',
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
      // Sin datos todavía, el formulario se abre solo: es lo único que hay que
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
      setError(e instanceof Error ? e.message : 'No se pudieron guardar los datos.');
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

  const esLlave = form.paymentMethod === 'breb';
  const esBbva = form.bankCode === BBVA;
  const esNit = form.holderDocumentType === '03';

  return (
    <div className="space-y-6">
      {cuenta && !editando && (
        <>
          <EstadoCuenta cuenta={cuenta} />

          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cuenta.paymentMethod === 'breb' ? (
              <Dato etiqueta="Llave Bre-B" valor={cuenta.brebKey ?? ''} />
            ) : (
              <>
                <Dato etiqueta="Banco" valor={cuenta.bankName ?? cuenta.bankCode ?? ''} />
                <Dato
                  etiqueta="Tipo de cuenta"
                  valor={cuenta.accountKind === 'checking' ? 'Corriente' : 'Ahorros'}
                />
                <Dato etiqueta="Número de cuenta" valor={cuenta.accountNumber ?? ''} />
                {cuenta.bbvaOfficeCode && (
                  <Dato etiqueta="Código de oficina" valor={cuenta.bbvaOfficeCode} />
                )}
              </>
            )}
            <Dato etiqueta="Titular" valor={cuenta.holderName} />
            <Dato
              etiqueta="Documento del titular"
              valor={`${cuenta.holderDocumentNumber}${
                cuenta.holderDocumentDv !== '0' ? `-${cuenta.holderDocumentDv}` : ''
              }`}
            />
            <Dato etiqueta="Dirección" valor={cuenta.holderAddress} />
            {cuenta.holderEmail && <Dato etiqueta="Correo" valor={cuenta.holderEmail} />}
          </dl>

          <div className="flex items-start gap-2.5 rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-mm-txw" />
            <p className="text-xs leading-relaxed text-mm-txs">
              Estos datos no se editan. Si cambias de cuenta o de llave, registras unos nuevos
              que reemplazan a estos —y vuelven a quedar pendientes de verificación, así que
              puede demorarse un pago.
            </p>
          </div>

          <Button variant="outline" onClick={() => setEditando(true)}>
            Cambiar cómo recibo los pagos
          </Button>
        </>
      )}

      {editando && (
        <div className="space-y-5">
          {cuenta && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">
                Estos datos reemplazarán a los actuales y quedarán pendientes de verificación.
                Mientras tanto, tus pedidos entregados esperan para dispersarse.
              </p>
            </div>
          )}

          <Campo etiqueta="¿Cómo quieres recibir tus pagos?">
            <div className="flex gap-2">
              {([['account', 'Cuenta bancaria'], ['breb', 'Llave Bre-B']] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, paymentMethod: k })}
                  className={cn(
                    'flex-1 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all',
                    form.paymentMethod === k
                      ? 'border-mm-g bg-mm-gbg text-mm-g'
                      : 'border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {esLlave ? (
              <div className="space-y-1 sm:col-span-2">
                <Input
                  label="Llave Bre-B"
                  value={form.brebKey}
                  maxLength={LARGO_MAXIMO_LLAVE}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm({ ...form, brebKey: e.target.value.replace(/\s/g, '') })
                  }
                  placeholder="Tu celular, tu cédula u otra llave de tu banco"
                />
                <p className="ml-1 text-xs text-mm-txw">
                  La que tengas registrada en tu banco, de máximo {LARGO_MAXIMO_LLAVE} caracteres.
                  Un correo largo no cabe: en ese caso usa tu celular o tu cédula.
                </p>
              </div>
            ) : (
              <>
                <Campo etiqueta="Banco">
                  <select
                    value={form.bankCode}
                    onChange={(e) => setForm({ ...form, bankCode: e.target.value })}
                    className={CLASE_SELECT}
                  >
                    <option value="">Selecciona...</option>
                    {bancos.map((b) => (
                      <option key={b.code} value={b.code}>{b.name}</option>
                    ))}
                  </select>
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
                    placeholder="Ej. 350"
                  />
                )}
              </>
            )}

            <Campo etiqueta="Tipo de documento del titular">
              <select
                value={form.holderDocumentType}
                onChange={(e) => setForm({ ...form, holderDocumentType: e.target.value })}
                className={CLASE_SELECT}
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

            <Input
              label="Dirección del titular"
              value={form.holderAddress}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, holderAddress: e.target.value })
              }
              placeholder="Basta con la ciudad, ej. Bogotá"
            />

            <Input
              label="Correo (opcional)"
              type="email"
              value={form.holderEmail}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, holderEmail: e.target.value })
              }
              placeholder="Para el aviso del banco"
            />
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
              {cuenta ? 'Reemplazar' : 'Registrar'}
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
  const destino = cuenta.paymentMethod === 'breb' ? 'esta llave' : 'esta cuenta';
  return (
    <div className={cn('flex items-start gap-2.5 rounded-2xl border p-4', clase)}>
      <Icono className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="text-xs leading-relaxed">
        <p className="font-bold">{label}</p>
        {cuenta.status === 'pending' && (
          <p>
            MercaMesa está cotejando tus datos con tu certificado bancario. Tus pedidos
            entregados esperan a que queden verificados para poder dispersarse.
          </p>
        )}
        {cuenta.status === 'rejected' && cuenta.rejectionReason && (
          <p>{cuenta.rejectionReason} — corrige y vuelve a registrarlos.</p>
        )}
        {cuenta.status === 'verified' && <p>Tus pagos se consignan a {destino}.</p>}
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
