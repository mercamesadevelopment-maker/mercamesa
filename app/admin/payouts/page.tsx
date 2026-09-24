'use client';

import { useState } from 'react';
import { Banknote, Landmark, Settings2, Building2 } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { PayoutsTab } from './components/payouts-tab';
import { BankAccountsTab } from './components/bank-accounts-tab';
import { PayoutSettingsTab } from './components/payout-settings-tab';
import { BanksTab } from './components/banks-tab';

type TabKey = 'payouts' | 'accounts' | 'settings' | 'banks';

const TABS: { key: TabKey; label: string; icon: React.ElementType; description: string }[] = [
  {
    key: 'payouts',
    label: 'Dispersiones',
    icon: Banknote,
    description:
      'Liquidaciones de pago a las tiendas. El sistema arma un borrador los martes y jueves; aprobarlo genera el archivo que se sube al portal del banco.',
  },
  {
    key: 'accounts',
    label: 'Cuentas bancarias',
    icon: Landmark,
    description:
      'Las cuentas que registraron las tiendas. Una cuenta solo entra a la dispersión después de cotejarla contra su certificado bancario.',
  },
  {
    key: 'settings',
    label: 'Parámetros',
    icon: Settings2,
    description:
      'Los datos del ordenante que exige el archivo: NIT, oficina, cuenta y clave del emisor. Los entrega BBVA al habilitar Global C@sh.',
  },
  {
    key: 'banks',
    label: 'Bancos',
    icon: Building2,
    description:
      'Los códigos de banco del archivo de dispersión, del anexo que entrega BBVA.',
  },
];

export default function PayoutsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('payouts');
  const actual = TABS.find((t) => t.key === activeTab)!;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mm-gbg text-mm-g">
          <Banknote className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-fraunces text-3xl text-mm-g">Dispersiones</h1>
          <p className="text-sm text-mm-txs">
            Pagos a las tiendas por sus pedidos entregados.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const Icono = tab.icon;
          const activo = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all',
                activo
                  ? 'bg-mm-g text-white'
                  : 'border border-mm-crd bg-white text-mm-txs hover:border-mm-g/40'
              )}
            >
              <Icono className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-mm-crd/40 bg-mm-gbg/30 px-4 py-3">
        <p className="text-xs leading-relaxed text-mm-txs">{actual.description}</p>
      </div>

      <div className="rounded-3xl border border-mm-crd bg-white p-6">
        {activeTab === 'payouts' && <PayoutsTab />}
        {activeTab === 'accounts' && <BankAccountsTab />}
        {activeTab === 'settings' && <PayoutSettingsTab />}
        {activeTab === 'banks' && <BanksTab />}
      </div>
    </div>
  );
}
