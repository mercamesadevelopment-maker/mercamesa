'use client';

import { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { SearchableSelect, type SelectOption } from '@/components/ui/searchable-select';
import { Button, Input, cn } from '@/src/components/Shared';
import { searchSiigoBuyersService } from '../../services/accounting.service';
import { MESES_SIIGO } from './balance-labels';

interface BalanceFormProps {
  generating: boolean;
  onGenerate: (body: Record<string, unknown>) => void;
}

const PRIMER_ANO = 2020;

/**
 * Los parámetros del balance de prueba de Siigo. El servidor vuelve a validar
 * todo; aquí solo se arma el pedido.
 */
export function BalanceForm({ generating, onGenerate }: BalanceFormProps) {
  const ahora = new Date();
  const [kind, setKind] = useState<'general' | 'third_party'>('general');
  const [year, setYear] = useState(String(ahora.getFullYear()));
  const [monthStart, setMonthStart] = useState('1');
  const [monthEnd, setMonthEnd] = useState(String(ahora.getMonth() + 1));
  const [accountStart, setAccountStart] = useState('');
  const [accountEnd, setAccountEnd] = useState('');
  const [taxDifference, setTaxDifference] = useState(false);
  const [identification, setIdentification] = useState('');
  const [thirdPartyName, setThirdPartyName] = useState('');
  const [branch, setBranch] = useState('0');

  // Búsqueda de compradores que ya son terceros en Siigo.
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (kind !== 'third_party' || search.trim().length < 2) {
      setOptions([]);
      return;
    }
    let vigente = true;
    setSearching(true);
    const t = setTimeout(() => {
      searchSiigoBuyersService(search.trim())
        .then((found) => {
          if (!vigente) return;
          setOptions(found.map((b) => ({ value: b.identification, label: `${b.name} · ${b.identification}` })));
        })
        .catch(() => vigente && setOptions([]))
        .finally(() => vigente && setSearching(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [search, kind]);

  const anos = Array.from({ length: ahora.getFullYear() - PRIMER_ANO + 1 }, (_, i) => String(ahora.getFullYear() - i));
  const selectClass =
    'w-full rounded-2xl border border-mm-crd bg-white px-4 py-2.5 text-sm font-medium text-mm-g focus:outline-none focus:ring-2 focus:ring-mm-g/20';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({
      kind,
      year,
      month_start: monthStart,
      month_end: monthEnd,
      account_start: accountStart,
      account_end: accountEnd,
      includes_tax_difference: taxDifference,
      ...(kind === 'third_party' && {
        identification,
        branch_office: branch,
        third_party_name: thirdPartyName,
      }),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-3xl border border-mm-crd bg-white p-6">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['general', 'General'],
            ['third_party', 'Por tercero'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              'rounded-xl px-4 py-2 text-sm font-bold transition-all',
              kind === k ? 'bg-mm-gbg text-mm-g ring-1 ring-mm-g/30' : 'text-mm-txs hover:bg-mm-gbg/50'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="ml-1 text-sm font-medium text-mm-txs">Año</span>
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="ml-1 text-sm font-medium text-mm-txs">Desde el mes</span>
          <select value={monthStart} onChange={(e) => setMonthStart(e.target.value)} className={selectClass}>
            {MESES_SIIGO.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="ml-1 text-sm font-medium text-mm-txs">Hasta el mes</span>
          <select value={monthEnd} onChange={(e) => setMonthEnd(e.target.value)} className={selectClass}>
            {MESES_SIIGO.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Cuenta inicial (opcional)"
          value={accountStart}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccountStart(e.target.value)}
          placeholder="Vacía: desde la primera cuenta"
          inputMode="numeric"
        />
        <Input
          label="Cuenta final (opcional)"
          value={accountEnd}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccountEnd(e.target.value)}
          placeholder="Vacía: hasta la última cuenta"
          inputMode="numeric"
        />
      </div>

      {kind === 'third_party' && (
        <div className="space-y-4 rounded-2xl bg-mm-gbg/30 p-4">
          <SearchableSelect
            label="Buscar un comprador que ya está en Siigo"
            options={options}
            value={options.some((o) => o.value === identification) ? identification : ''}
            onChange={(v) => {
              setIdentification(v);
              setThirdPartyName(options.find((o) => o.value === v)?.label.split(' · ')[0] ?? '');
            }}
            placeholder="Nombre, documento o correo"
            searchValue={search}
            onSearchChange={setSearch}
            loading={searching}
            emptyMessage={search.trim().length < 2 ? 'Escribe al menos dos letras.' : 'Ningún comprador con factura en Siigo.'}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Input
              label="Identificación del tercero"
              value={identification}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setIdentification(e.target.value);
                // Escrita a mano ya no es el comprador elegido.
                setThirdPartyName('');
              }}
              placeholder="Sin dígito de verificación"
              required
            />
            <Input
              label="Sucursal"
              value={branch}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBranch(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <p className="text-xs text-mm-txw">
            El buscador muestra solo compradores web, que son los terceros que MercaMesa crea en Siigo. Para un
            proveedor u otro tercero creado directo en Siigo, escribe su identificación.
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-mm-txs">
        <input
          type="checkbox"
          checked={taxDifference}
          onChange={(e) => setTaxDifference(e.target.checked)}
          className="h-4 w-4 rounded border-mm-crd"
        />
        Incluir las cuentas con diferencia fiscal
      </label>

      <div className="flex justify-end">
        <Button type="submit" loading={generating}>
          <FileSpreadsheet className="mr-1.5 h-4 w-4" />
          Generar balance
        </Button>
      </div>
    </form>
  );
}
