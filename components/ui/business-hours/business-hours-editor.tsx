import React from 'react';
import { cn } from '@/src/components/Shared';

export interface BusinessHourEntry {
  day: number; // ISO weekday: 1 = Lunes ... 7 = Domingo
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

export type BusinessHours = BusinessHourEntry[];

const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

export function createDefaultBusinessHours(): BusinessHours {
  return [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    is_closed: day === 7,
    open_time: day === 7 ? null : '08:00',
    close_time: day === 7 ? null : '18:00',
  }));
}

export function WeeklyHoursDisplay({ hours }: { hours: BusinessHours }) {
  return (
    <div className="rounded-2xl border border-mm-crd overflow-hidden divide-y divide-mm-crd">
      {hours.map((entry) => (
        <div
          key={entry.day}
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-2.5 bg-white text-sm',
            entry.is_closed && 'bg-mm-gbg/40'
          )}
        >
          <span className="font-bold text-mm-g">{DAY_LABELS[entry.day]}</span>
          <span className={cn('text-mm-txs', entry.is_closed && 'text-mm-txw italic')}>
            {entry.is_closed ? 'Cerrado' : `${entry.open_time} - ${entry.close_time}`}
          </span>
        </div>
      ))}
    </div>
  );
}

export function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: BusinessHours;
  onChange: (hours: BusinessHours) => void;
}) {
  const updateDay = (day: number, patch: Partial<BusinessHourEntry>) => {
    onChange(value.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-mm-txs ml-1">Horario de atención</label>

      <div className="rounded-2xl border border-mm-crd overflow-hidden divide-y divide-mm-crd">
        {value.map((entry) => (
          <div
            key={entry.day}
            className={cn(
              'flex flex-wrap items-center gap-3 px-4 py-3 bg-white',
              entry.is_closed && 'bg-mm-gbg/40'
            )}
          >
            <span className="w-24 shrink-0 text-sm font-bold text-mm-g">
              {DAY_LABELS[entry.day]}
            </span>

            <label className="flex items-center gap-2 text-xs text-mm-txs shrink-0">
              <input
                type="checkbox"
                checked={entry.is_closed}
                onChange={(e) => {
                  const is_closed = e.target.checked;
                  updateDay(entry.day, {
                    is_closed,
                    open_time: is_closed ? null : entry.open_time || '08:00',
                    close_time: is_closed ? null : entry.close_time || '18:00',
                  });
                }}
                className="rounded border-mm-crd text-mm-g focus:ring-mm-g"
              />
              Cerrado
            </label>

            {!entry.is_closed && (
              <div className="flex items-center gap-2 flex-grow">
                <input
                  type="time"
                  value={entry.open_time ?? ''}
                  onChange={(e) => updateDay(entry.day, { open_time: e.target.value })}
                  className="px-3 py-1.5 rounded-xl border-1.5 border-mm-crd bg-white text-sm outline-none focus:border-mm-g"
                  required
                />
                <span className="text-mm-txw text-sm">a</span>
                <input
                  type="time"
                  value={entry.close_time ?? ''}
                  onChange={(e) => updateDay(entry.day, { close_time: e.target.value })}
                  className="px-3 py-1.5 rounded-xl border-1.5 border-mm-crd bg-white text-sm outline-none focus:border-mm-g"
                  required
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
