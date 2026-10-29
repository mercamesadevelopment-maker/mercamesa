/** Pesos colombianos para mostrar: `$12.500`. `null`, `undefined` y `NaN` quedan en `$0`. */
export function formatCOP(n: number | null | undefined): string {
  return '$' + Number(n || 0).toLocaleString('es-CO');
}
