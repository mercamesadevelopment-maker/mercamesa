/** Nombres de los meses de Siigo: del 1 al 12, y el 13 es el cierre. */
export const MESES_SIIGO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Cierre',
];

const CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Cierre'];

/** «Ene–Dic 2026», «Mar 2026», «Cierre 2026». */
export function periodLabel(year: number, monthStart: number, monthEnd: number): string {
  const a = CORTOS[monthStart - 1];
  const b = CORTOS[monthEnd - 1];
  return monthStart === monthEnd ? `${a} ${year}` : `${a}–${b} ${year}`;
}
