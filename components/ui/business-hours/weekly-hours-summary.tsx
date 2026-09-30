import React from 'react';
import { cn } from '@/src/components/Shared';
import type { BusinessHours } from './business-hours-editor';
import { summarizeWeeklyHours } from './summarize-hours';

/**
 * El horario de la semana en pocas líneas: siete días iguales son una sola
 * («Todos los días · 08:00 – 18:00»), y solo se separa lo que cambia.
 */
export function WeeklyHoursSummary({ hours, className }: { hours: BusinessHours; className?: string }) {
  return (
    <ul className={cn('space-y-1 text-sm', className)}>
      {summarizeWeeklyHours(hours).map((group) => (
        <li key={group.days} className="flex flex-wrap gap-x-2">
          <span className="font-semibold text-mm-g">{group.days}</span>
          <span className={cn('text-mm-txs', group.isClosed && 'text-mm-txw italic')}>{group.hours}</span>
        </li>
      ))}
    </ul>
  );
}
