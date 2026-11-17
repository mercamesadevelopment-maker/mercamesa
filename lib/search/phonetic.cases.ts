/**
 * Casos de la clave fonética. Los usan la prueba de `phoneticKey` y la de la
 * base (`supabase/tests/busqueda_tolerante.test.sql` repite esta lista): así las
 * dos funciones no se separan.
 */
export const PHONETIC_CASES: [texto: string, clave: string][] = [
  ['vino', 'bino'],
  ['bino', 'bino'],
  ['agua', 'agua'],
  ['hagua', 'agua'],
  ['arroz', 'aros'],
  ['aros', 'aros'],
  ['Cebolla', 'seboya'],
  ['queso', 'keso'],
  ['Zanahoria', 'sanaoria'],
  ['yuca', 'yuka'],
  ['lluca', 'yuka'],
  ['guayaba', 'guayaba'],
  ['Guiso', 'giso'],
  ['gengibre', 'jenjibre'],
  ['jengibre', 'jenjibre'],
  ['chocolate', 'chokolate'],
  ['Plátano hartón', 'platano arton'],
  ['ñame', 'name'],
];
