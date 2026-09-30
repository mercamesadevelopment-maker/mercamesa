import type { BusinessHours, BusinessHourEntry } from './business-hours-editor';

export const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo',
};

/** Un tramo de días seguidos con el mismo horario: «Lunes a sábado · 08:00 – 18:00». */
export interface HoursGroup {
  days: string;
  hours: string;
  isClosed: boolean;
}

/** `08:00:00` o `08:00` → `08:00`. */
function hhmm(time: string | null): string {
  return (time ?? '').slice(0, 5);
}

function schedule(entry: BusinessHourEntry): string {
  return entry.is_closed ? 'Cerrado' : `${hhmm(entry.open_time)} – ${hhmm(entry.close_time)}`;
}

function daysLabel(from: number, to: number, total: number): string {
  if (total === 7 && from === 1 && to === 7) return 'Todos los días';
  if (from === to) return DAY_LABELS[from];
  if (to === from + 1) return `${DAY_LABELS[from]} y ${DAY_LABELS[to].toLowerCase()}`;
  return `${DAY_LABELS[from]} a ${DAY_LABELS[to].toLowerCase()}`;
}

/**
 * El horario semanal dicho en pocas líneas: los días SEGUIDOS con el mismo
 * horario van juntos. Siete días iguales son una sola línea; un día distinto en
 * medio parte el tramo, porque «lunes, miércoles y viernes» se lee peor que tres
 * líneas cortas.
 */
export function summarizeWeeklyHours(hours: BusinessHours): HoursGroup[] {
  const days = [...hours].sort((a, b) => a.day - b.day);
  const groups: HoursGroup[] = [];

  let start = 0;
  for (let i = 1; i <= days.length; i++) {
    if (i < days.length && schedule(days[i]) === schedule(days[start])) continue;

    const first = days[start];
    const last = days[i - 1];
    groups.push({
      days: daysLabel(first.day, last.day, days.length),
      hours: schedule(first),
      isClosed: first.is_closed,
    });
    start = i;
  }

  return groups;
}

export interface OpenStatus {
  isOpen: boolean;
  /** «Abierta · cierra a las 18:00» o «Cerrada · abre mañana a las 08:00». */
  label: string;
}

function minutes(time: string | null): number {
  const [h, m] = hhmm(time).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** Día ISO y minutos del día en Colombia, sin depender de la zona del navegador. */
function nowInBogota(now: Date): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: WEEKDAYS[get('weekday')] ?? 1, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/**
 * Si la tienda está abierta ahora según su horario, en hora de Colombia.
 *
 * La insignia «Abierta» salía de `stores.is_active`, que dice si la tienda está
 * habilitada en la plataforma, no si atiende: marcaba «Abierta» un domingo a
 * medianoche.
 */
export function openStatus(hours: BusinessHours, now: Date = new Date()): OpenStatus {
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const { day, minute } = nowInBogota(now);

  const today = byDay.get(day);
  if (today && !today.is_closed) {
    const open = minutes(today.open_time);
    // Un cierre igual o anterior a la apertura se lee como «hasta medianoche».
    const close = minutes(today.close_time) > open ? minutes(today.close_time) : 24 * 60;

    if (minute >= open && minute < close) {
      return { isOpen: true, label: `Abierta · cierra a las ${hhmm(today.close_time)}` };
    }
    if (minute < open) {
      return { isOpen: false, label: `Cerrada · abre hoy a las ${hhmm(today.open_time)}` };
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const next = byDay.get(((day - 1 + offset) % 7) + 1);
    if (next && !next.is_closed) {
      const when = offset === 1 ? 'mañana' : `el ${DAY_LABELS[next.day].toLowerCase()}`;
      return { isOpen: false, label: `Cerrada · abre ${when} a las ${hhmm(next.open_time)}` };
    }
  }

  return { isOpen: false, label: 'Cerrada' };
}
