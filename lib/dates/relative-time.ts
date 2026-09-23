/**
 * Fechas legibles en español.
 *
 * Había un `timeAgo` privado dentro del servicio de notificaciones y, en el
 * resto de la app, `toLocaleDateString('es-CO')` suelto. Para auditoría hace
 * falta lo mismo en varios lugares, así que vive acá.
 */

/**
 * «Hace 5 min», «Hace 3 h», «Hace 2 d» — y a partir del mes, la fecha.
 *
 * Pasado cierto punto lo relativo deja de informar: «hace 87 días» obliga a
 * hacer la cuenta, mientras que «14 de junio de 2026» se lee de una.
 */
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';

  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '—';

  const diffMs = Date.now() - fecha.getTime();

  // Una fecha futura (reloj desfasado entre servidor y navegador) no debe
  // mostrarse como «hace -3 min».
  if (diffMs < 0) return fechaCorta(dateStr);

  const minutos = Math.floor(diffMs / 60_000);
  if (minutos < 1) return 'Justo ahora';
  if (minutos < 60) return `Hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias <= 30) return `Hace ${dias} d`;

  return fechaCorta(dateStr);
}

/** «14 de junio de 2026». */
export function fechaCorta(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return '—';

  return fecha.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Fecha y hora completas, para el `title` de un dato relativo: al pasar el
 * cursor sobre «Hace 3 h» se ve el momento exacto, que es lo que hace falta
 * cuando se está auditando.
 */
export function fechaCompleta(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Sin registro';
  const fecha = new Date(dateStr);
  if (Number.isNaN(fecha.getTime())) return 'Sin registro';

  return fecha.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}
