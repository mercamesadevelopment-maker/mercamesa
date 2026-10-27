/**
 * Cierre de cuentas por inactividad: la política, sin base ni red.
 *
 * Al año sin usar la cuenta se le avisa a la persona; si en las dos semanas
 * siguientes no vuelve, la cuenta se cierra. «Usar» es iniciar sesión, tener una
 * sesión abierta que se renueva o hacer un pedido (`last_account_activity` en la
 * base).
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export const INACTIVITY_DAYS = 365;
export const CLOSURE_GRACE_DAYS = 14;

/** Antes de esta fecha, la cuenta lleva un año sin uso. */
export function inactiveBefore(now: Date): Date {
  return new Date(now.getTime() - INACTIVITY_DAYS * DIA_MS);
}

/** Cuándo se cierra una cuenta avisada en `notifiedAt`. */
export function closesAt(notifiedAt: Date): Date {
  return new Date(notifiedAt.getTime() + CLOSURE_GRACE_DAYS * DIA_MS);
}

export type InactivityStep = 'none' | 'notify' | 'wait' | 'cancel' | 'close';

/**
 * Qué toca con una cuenta:
 * - `none`: la usó en el último año y no tiene aviso.
 * - `notify`: lleva un año sin uso y no se le ha avisado.
 * - `wait`: ya se le avisó y todavía no se cumplen las dos semanas.
 * - `cancel`: se le avisó y volvió después: el aviso se borra.
 * - `close`: se le avisó, pasaron las dos semanas y no volvió.
 */
export function nextStep({
  lastActivity,
  notice,
  now,
}: {
  lastActivity: Date;
  notice: { notifiedAt: Date; closesAt: Date } | null;
  now: Date;
}): InactivityStep {
  if (notice) {
    if (lastActivity > notice.notifiedAt) return 'cancel';
    return now >= notice.closesAt ? 'close' : 'wait';
  }
  return lastActivity < inactiveBefore(now) ? 'notify' : 'none';
}

/**
 * Las tiendas que quedan sin dueño cuando se cierra la cuenta de alguien: esas
 * pasan a inactivas. Si la tienda tiene otro dueño, sigue igual y la persona solo
 * sale de ella; un vendedor que no es dueño nunca deja una tienda sin dueño.
 */
export function storesLeftWithoutOwner(
  memberships: { storeId: string; userId: string; isOwner: boolean }[],
  closingUserId: string
): string[] {
  const propias = new Set(
    memberships.filter((m) => m.userId === closingUserId && m.isOwner).map((m) => m.storeId)
  );
  const conOtroDueno = new Set(
    memberships.filter((m) => m.userId !== closingUserId && m.isOwner).map((m) => m.storeId)
  );
  return [...propias].filter((storeId) => !conOtroDueno.has(storeId));
}
