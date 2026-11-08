'use client';

import { Table } from '@/components/ui/table/components/Table';
import { cn } from '@/lib/utils/cn';
import { fechaCorta } from '@/lib/dates/relative-time';
import type { LogisticsMarketplaceRow } from '@/lib/accounting/logistics-report';
import { useLogisticsReport } from '../../hooks/use-logistics-report';
import { TotalsCards } from '../totals-cards';
import { ListState } from '../list-state';

/** Un día de calendario de Colombia (`YYYY-MM-DD`), sin que la zona horaria lo corra al día anterior. */
function dia(d: string): string {
  return fechaCorta(`${d}T12:00:00-05:00`);
}

function Activo({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        'whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold',
        on ? 'bg-okl text-ok' : 'bg-mm-gbg text-mm-txw'
      )}
    >
      {label}: {on ? 'sí' : 'no'}
    </span>
  );
}

/** Los servicios de una plaza día por día: el dato del convenio con el aliado de logística. */
function DetallePorDia({ row }: { row: LogisticsMarketplaceRow }) {
  if (row.days.length === 0) {
    return <p className="px-4 py-3 text-sm text-mm-txw">Sin servicios de logística en el periodo.</p>;
  }
  return (
    <div className="overflow-x-auto px-4 py-3">
      <table className="w-full max-w-xl text-sm">
        <thead>
          <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-mm-txw">
            <th className="py-1.5 pr-4 font-bold">Día</th>
            <th className="py-1.5 pr-4 font-bold text-right">Servicios</th>
            <th className="py-1.5 pr-4 font-bold text-right">Partes recibidas</th>
            <th className="py-1.5 font-bold text-right">Con novedad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mm-gbg">
          {row.days.map((d) => (
            <tr key={d.day}>
              <td className="py-1.5 pr-4 text-mm-txs">{dia(d.day)}</td>
              <td className="py-1.5 pr-4 text-right font-mono font-bold text-mm-g">{d.services}</td>
              <td className="py-1.5 pr-4 text-right font-mono text-mm-txs">{d.partsReceived}</td>
              <td className={cn('py-1.5 text-right font-mono', d.partsDamaged ? 'font-bold text-arcilla-oscura' : 'text-mm-txw')}>
                {d.partsDamaged}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Qué plazas tienen logística y cuántos servicios prestó cada una. Un servicio
 * es un pedido que salió de la bahía y en el que logística intervino.
 */
export function LogisticsTab({ query }: { query: string }) {
  const { data, loading, error } = useLogisticsReport(query);

  const columns = [
    {
      key: 'name',
      label: 'Plaza',
      render: (r: LogisticsMarketplaceRow) => (
        <div>
          <p className="font-bold text-mm-g">{r.name}</p>
          {!r.isActive && <p className="text-xs text-mm-txw">Plaza inactiva</p>}
        </div>
      ),
    },
    {
      key: 'config',
      label: 'Configuración',
      render: (r: LogisticsMarketplaceRow) => (
        <div className="flex flex-wrap gap-1.5">
          <Activo on={r.logisticsEnabled} label="Logística" />
          <Activo on={r.runnerEnabled} label="Patinador" />
        </div>
      ),
    },
    {
      key: 'staff',
      label: 'Personal',
      render: (r: LogisticsMarketplaceRow) => (
        <span className="font-mono text-sm text-mm-txs">{r.logisticsStaff}</span>
      ),
    },
    {
      key: 'services',
      label: 'Servicios',
      render: (r: LogisticsMarketplaceRow) => (
        <span className="font-mono text-lg font-extrabold text-mm-g">{r.services}</span>
      ),
    },
    {
      key: 'average',
      label: 'Promedio al día',
      render: (r: LogisticsMarketplaceRow) => (
        <span className="font-mono text-sm text-mm-txs">{r.averagePerDay.toLocaleString('es-CO')}</span>
      ),
    },
    {
      key: 'parts',
      label: 'Partes recibidas',
      render: (r: LogisticsMarketplaceRow) => (
        <div className="font-mono text-sm">
          <p className="text-mm-txs">{r.partsReceived}</p>
          {r.partsDamaged > 0 && <p className="text-xs font-bold text-arcilla-oscura">{r.partsDamaged} con novedad</p>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {data && (
        <>
          <p className="text-sm text-mm-txs">
            Del {dia(data.from)} al {dia(prevDay(data.to))}. Un servicio es un pedido que salió de la bahía y en el que
            logística recibió alguna parte o lo despachó; un pedido de varias tiendas cuenta una vez. Solo aplica el
            filtro de plaza y el de fecha (sin fecha, el mes en curso).
          </p>
          <TotalsCards
            cards={[
              { label: 'Servicios', value: String(data.totals.services), hint: `${data.elapsedDays} días corridos` },
              { label: 'Plazas con logística', value: String(data.totals.marketplacesWithLogistics), hint: `de ${data.rows.length}` },
              { label: 'Partes recibidas', value: String(data.totals.partsReceived) },
              {
                label: 'Partes con novedad',
                value: String(data.totals.partsDamaged),
                tone: data.totals.partsDamaged ? 'warn' : 'default',
              },
            ]}
          />
        </>
      )}
      <ListState loading={loading && !data} error={error}>
        <div className="rounded-3xl border border-mm-crd bg-white">
          <Table<LogisticsMarketplaceRow>
            data={data?.rows ?? []}
            columns={columns}
            getRowKey={(r) => r.marketplaceId}
            expandableContent={(r) => <DetallePorDia row={r} />}
            emptyMessage="No hay plazas que cumplan los filtros."
          />
        </div>
      </ListState>
    </div>
  );
}

/** El último día de `[from, to)`. */
function prevDay(d: string): string {
  return new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}
