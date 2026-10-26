import type { SiigoTestBalancePayload } from './types';

/**
 * Los parámetros de un balance de prueba de Siigo, validados con las reglas de
 * su API antes de llamarla: así el error sale en español y en la pantalla, y no
 * como un 400 de Siigo.
 */

export type BalanceKind = 'general' | 'third_party';

export interface BalanceRequest {
  kind: BalanceKind;
  payload: SiigoTestBalancePayload;
  /** El nombre del tercero tal como se eligió en el buscador, para el historial. */
  thirdPartyName: string | null;
}

export type ParsedBalanceRequest = ({ ok: true } & BalanceRequest) | { ok: false; message: string };

const PRIMER_ANO = 2000;

export function parseBalanceRequest(body: unknown, now = new Date()): ParsedBalanceRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind: BalanceKind = b.kind === 'third_party' ? 'third_party' : 'general';

  const year = toInt(b.year);
  if (year === null || year < PRIMER_ANO || year > now.getFullYear()) {
    return { ok: false, message: `El año debe estar entre ${PRIMER_ANO} y ${now.getFullYear()}.` };
  }

  const monthStart = toInt(b.month_start);
  const monthEnd = toInt(b.month_end);
  if (monthStart === null || monthEnd === null || monthStart < 1 || monthEnd > 13 || monthStart > 13 || monthEnd < 1) {
    return { ok: false, message: 'Los meses van de 1 a 13 (el 13 es el cierre).' };
  }
  if (monthStart > monthEnd) {
    return { ok: false, message: 'El mes inicial no puede ser posterior al mes final.' };
  }

  const accountStart = accountOrNull(b.account_start);
  const accountEnd = accountOrNull(b.account_end);
  if (accountStart === false || accountEnd === false) {
    return { ok: false, message: 'Las cuentas contables son solo números, por ejemplo 11050501.' };
  }
  if (accountStart && accountEnd && BigInt(accountStart) > BigInt(accountEnd)) {
    return { ok: false, message: 'La cuenta inicial no puede ser mayor que la cuenta final.' };
  }

  const payload: SiigoTestBalancePayload = {
    ...(accountStart && { account_start: accountStart }),
    ...(accountEnd && { account_end: accountEnd }),
    year,
    month_start: monthStart,
    month_end: monthEnd,
    includes_tax_difference: b.includes_tax_difference === true,
  };

  if (kind === 'general') return { ok: true, kind, payload, thirdPartyName: null };

  const identification = cleanIdentification(b.identification);
  if (!identification) {
    return { ok: false, message: 'Escribe la identificación del tercero, sin dígito de verificación.' };
  }
  const branch = b.branch_office === undefined || b.branch_office === '' ? 0 : toInt(b.branch_office);
  if (branch === null || branch < 0 || branch > 999) {
    return { ok: false, message: 'La sucursal es un número de 0 a 999.' };
  }

  const name = typeof b.third_party_name === 'string' ? b.third_party_name.trim().slice(0, 160) : '';
  return {
    ok: true,
    kind,
    payload: { ...payload, customer: { identification, branch_office: branch } },
    thirdPartyName: name || null,
  };
}

/**
 * La identificación como la pide Siigo: solo el número, sin puntos, espacios ni
 * dígito de verificación (`900.123.456-7` → `900123456`).
 */
export function cleanIdentification(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const sinDv = String(value).trim().split('-')[0];
  const digits = sinDv.replace(/[.\s]/g, '');
  return /^\d{3,20}$/.test(digits) ? digits : null;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** `null` si viene vacía (todas las cuentas), `false` si no es un número de cuenta. */
function accountOrNull(value: unknown): string | null | false {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return /^\d{1,20}$/.test(s) ? s : false;
}
