'use client';

import { useState } from 'react';
import { Banknote, Landmark, Settings2, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PayoutsTab } from './payouts-tab';
import { BankAccountsTab } from './bank-accounts-tab';
import { PayoutSettingsTab } from './payout-settings-tab';
import { BanksTab } from './banks-tab';

type SubTab = 'payouts' | 'accounts' | 'settings' | 'banks';

const SUBTABS: { key: SubTab; label: string; icon: React.ElementType; description: string }[] = [
  {
    key: 'payouts',
    label: 'Liquidaciones',
    icon: Banknote,
    description:
      'Liquidaciones de pago a las tiendas. El sistema arma un borrador los martes y jueves; aprobarlo genera el archivo que se sube al portal del banco. Los filtros de arriba aplican aquí.',
  },
  {
    key: 'accounts',
    label: 'Cuentas bancarias',
    icon: Landmark,
    description:
      'La cuenta bancaria o la llave Bre-B que registró cada tienda. Solo entra a la dispersión después de cotejarla contra su certificado bancario.',
  },
  {
    key: 'settings',
    label: 'Parámetros',
    icon: Settings2,
    description:
      'El concepto de pago que va en cada línea del archivo y los días de espera tras la entrega. El resto de cada línea sale de la cuenta verificada de la tienda.',
  },
  {
    key: 'banks',
    label: 'Bancos',
    icon: Building2,
    description:
      'Los códigos de banco del archivo de dispersión, del anexo que entrega BBVA. Las llaves Bre-B no necesitan banco: van con el código 9999.',
  },
];

/**
 * Las dispersiones a las tiendas, que antes eran su propio módulo
 * (`/admin/payouts`): liquidaciones, cuentas, parámetros y bancos.
 */
export function PayoutsSection({ query }: { query: string }) {
  const [activo, setActivo] = useState<SubTab>('payouts');
  const actual = SUBTABS.find((t) => t.key === activo)!;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SUBTABS.map((tab) => {
          const Icono = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActivo(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all',
                activo === tab.key
                  ? 'bg-mm-gbg text-mm-g ring-1 ring-mm-g/30'
                  : 'text-mm-txs hover:bg-mm-gbg/50'
              )}
            >
              <Icono className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs leading-relaxed text-mm-txs">{actual.description}</p>

      {activo === 'payouts' && <PayoutsTab query={query} />}
      {activo === 'accounts' && <BankAccountsTab />}
      {activo === 'settings' && <PayoutSettingsTab />}
      {activo === 'banks' && <BanksTab />}
    </div>
  );
}
