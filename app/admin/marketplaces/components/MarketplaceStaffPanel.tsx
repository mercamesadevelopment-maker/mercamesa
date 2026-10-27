'use client';

import React, { useEffect, useState } from 'react';
import { Bike, PackageCheck, UserPlus, X } from 'lucide-react';
import { Button, Input, cn } from '@/src/components/Shared';
import { formatCOP } from '@/lib/utils/format';
import { STAFF_ROLE_LABEL, type StaffRole } from '@/lib/marketplace-staff/actor';
import type { MarketplaceStaffSettings } from '@/lib/marketplace-staff/admin';
import { useMarketplaceStaff } from '../hooks/use-marketplace-staff';
import { InviteMarketplaceStaffModal } from './InviteMarketplaceStaffModal';

interface MarketplaceStaffPanelProps {
  marketplaceId: string | null | undefined;
  marketplaceName: string;
  /** Se consulta solo con el modal abierto. */
  enabled: boolean;
}

const SIN_CONFIG: MarketplaceStaffSettings = {
  runnerEnabled: false,
  logisticsEnabled: false,
  commissionType: null,
  commissionValue: null,
};

/**
 * Cómo despacha la plaza los pedidos de varias tiendas y quién lo hace.
 *
 * - Patinador: recoge en cada tienda. Sin él, cada tendero lleva su parte.
 * - Logística: recibe en la bahía y entrega al domiciliario. Sin ella, se
 *   entrega directo al domiciliario.
 *
 * Lo que se cambia acá vale para los pedidos nuevos: los que están en curso
 * siguen con la configuración con la que se compraron.
 */
export function MarketplaceStaffPanel({ marketplaceId, marketplaceName, enabled }: MarketplaceStaffPanelProps) {
  const { overview, loading, saving, error, saveSettings, setMemberActive, invite, cancelInvitation } =
    useMarketplaceStaff(marketplaceId, enabled);
  const [form, setForm] = useState<MarketplaceStaffSettings>(SIN_CONFIG);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (overview) setForm(overview.settings);
  }, [overview]);

  const cambio = !!overview && JSON.stringify(form) !== JSON.stringify(overview.settings);

  if (loading && !overview) {
    return <div className="p-6 text-center text-mm-txw text-sm">Cargando el equipo de la plaza...</div>;
  }

  const porRol = (role: StaffRole) => (overview?.staff ?? []).filter((s) => s.role === role);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-mm-g uppercase tracking-widest mb-1">Pedidos de varias tiendas</h3>
        <p className="text-xs text-mm-txw">
          Cómo se juntan en la bahía las partes de un pedido con productos de varias tiendas. Sale un solo
          domiciliario por pedido. Los cambios aplican a los pedidos nuevos.
        </p>
      </div>

      {error && <div className="p-3 bg-rl rounded-xl text-r text-sm font-medium">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Interruptor
          icon={<Bike className="w-4 h-4" />}
          title="Usa patinador"
          hint={form.runnerEnabled ? 'Recoge en cada tienda y lleva a la bahía.' : 'Cada tendero lleva su parte.'}
          checked={form.runnerEnabled}
          onChange={(v) => setForm({ ...form, runnerEnabled: v })}
        />
        <Interruptor
          icon={<PackageCheck className="w-4 h-4" />}
          title="Tiene logística en la bahía"
          hint={
            form.logisticsEnabled
              ? 'Recibe las partes y entrega al domiciliario.'
              : 'Las partes se entregan directo al domiciliario.'
          }
          checked={form.logisticsEnabled}
          onChange={(v) => setForm({ ...form, logisticsEnabled: v })}
        />
      </div>

      {form.runnerEnabled && (
        <div className="rounded-2xl border border-mm-crd/60 bg-white p-4 space-y-3">
          <div>
            <p className="text-sm font-bold text-mm-g">Comisión del patinador</p>
            <p className="text-xs text-mm-txw">
              Informativa: la paga la plaza o la tienda por fuera. No cambia lo que paga el comprador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                [null, 'Sin comisión'],
                ['percent', '% de los productos'],
                ['fixed', 'Valor fijo por pedido'],
              ] as const
            ).map(([tipo, label]) => (
              <button
                key={label}
                type="button"
                onClick={() =>
                  setForm({ ...form, commissionType: tipo, commissionValue: tipo ? form.commissionValue ?? 0 : null })
                }
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                  form.commissionType === tipo
                    ? 'border-mm-g bg-mm-gbg text-mm-g'
                    : 'border-mm-crd text-mm-txs hover:border-mm-g/40'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {form.commissionType && (
            <div className="max-w-[220px]">
              <Input
                label={form.commissionType === 'percent' ? 'Porcentaje' : 'Valor (COP)'}
                type="number"
                min={0}
                max={form.commissionType === 'percent' ? 100 : undefined}
                step={form.commissionType === 'percent' ? 0.5 : 100}
                value={form.commissionValue ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setForm({ ...form, commissionValue: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveSettings(form)} loading={saving} disabled={!cambio}>
          Guardar configuración
        </Button>
      </div>

      <div className="border-t border-mm-crd/40 pt-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-mm-g uppercase tracking-widest">Equipo de la plaza</h3>
          <Button size="sm" variant="outline" onClick={() => setInviting(true)}>
            <UserPlus className="w-4 h-4 mr-1.5 inline" /> Invitar
          </Button>
        </div>

        {(['runner', 'logistics'] as StaffRole[]).map((role) => (
          <div key={role}>
            <p className="text-xs font-bold uppercase tracking-wider text-mm-txw mb-2">
              {STAFF_ROLE_LABEL[role]} ({porRol(role).filter((s) => s.isActive).length})
            </p>
            {porRol(role).length === 0 ? (
              <p className="text-xs text-mm-txw bg-mm-gbg/30 rounded-2xl border border-mm-crd/50 px-4 py-3">
                Nadie todavía.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {porRol(role).map((s) => (
                  <div
                    key={`${s.userId}-${role}`}
                    className={cn(
                      'flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-mm-crd/60',
                      !s.isActive && 'opacity-60'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-mm-g truncate">{s.name}</span>
                      <span className="block text-xs text-mm-txw truncate">{s.phone || s.email}</span>
                    </span>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setMemberActive(s.userId, role, !s.isActive)}
                      className="shrink-0 text-xs font-bold text-mm-txs hover:text-mm-g"
                    >
                      {s.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {(overview?.invitations ?? []).length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mm-txw mb-2">Invitaciones pendientes</p>
            <div className="space-y-2">
              {overview!.invitations.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-mm-crd/60 bg-white px-4 py-2.5"
                >
                  <span className="min-w-0 text-sm text-mm-g truncate">
                    {i.email} · {STAFF_ROLE_LABEL[i.role]}
                    {i.expired && <span className="ml-2 text-xs font-bold text-r">vencida</span>}
                  </span>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => cancelInvitation(i.id)}
                    className="shrink-0 text-mm-txw hover:text-r"
                    aria-label={`Cancelar la invitación de ${i.email}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(overview?.commissions ?? []).length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-mm-txw mb-2">
              Comisiones de patinadores este mes
            </p>
            <div className="rounded-2xl border border-mm-crd/60 bg-white divide-y divide-mm-crd/40">
              {overview!.commissions.map((c) => (
                <div key={c.userId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-mm-g font-bold truncate">{c.name}</span>
                  <span className="text-mm-txs whitespace-nowrap">
                    {c.orders} {c.orders === 1 ? 'pedido' : 'pedidos'} · <b className="text-mm-g">{formatCOP(c.amount)}</b>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <InviteMarketplaceStaffModal
        isOpen={inviting}
        marketplaceName={marketplaceName}
        onClose={() => setInviting(false)}
        onConfirm={invite}
      />
    </div>
  );
}

function Interruptor({
  icon,
  title,
  hint,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
        checked ? 'border-mm-g bg-mm-gbg' : 'border-mm-crd bg-white hover:border-mm-g/40'
      )}
    >
      <span className={cn('mt-0.5 shrink-0', checked ? 'text-mm-g' : 'text-mm-txw')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-mm-g">{title}</span>
        <span className="block text-xs text-mm-txs">{hint}</span>
      </span>
      <span
        className={cn(
          'mt-0.5 h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors',
          checked ? 'bg-mm-g' : 'bg-mm-crd'
        )}
      >
        <span className={cn('block h-4 w-4 rounded-full bg-white transition-transform', checked && 'translate-x-4')} />
      </span>
    </button>
  );
}
