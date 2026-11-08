/** Pesos colombianos para mostrar: `$12.500`. `null`, `undefined` y `NaN` quedan en `$0`. */
export function formatCOP(n: number | null | undefined): string {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}

/** Una cantidad sin ceros de más: «1», «2,5», «0,25». */
export function formatQuantity(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
}
