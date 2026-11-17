import { normalizeText } from '@/lib/utils/text';

/**
 * El texto que Excel pone en el portapapeles: filas por salto de línea, celdas
 * por tabulador. Lo usan las tablas que se editan como hoja de cálculo
 * (categorías, productos del tendero).
 */
export function parsePastedCells(texto: string): string[][] {
  const filas = texto.replace(/\r\n?/g, '\n').split('\n');
  // Excel termina lo copiado con un salto de línea: esa última fila vacía no es dato.
  if (filas.length > 1 && filas[filas.length - 1] === '') filas.pop();
  return filas.map((fila) => fila.split('\t'));
}

const SI = new Set(['si', 'x', 'true', 'verdadero', '1', 'activa', 'activo', 'publicado']);
const NO = new Set(['no', 'false', 'falso', '0', 'inactiva', 'inactivo', 'retirado', '']);

/** Una casilla pegada: «sí», «x», «1»… o «no», «0», vacío. `null` si no se entiende. */
export function parsePastedBoolean(texto: string): boolean | null {
  const v = normalizeText(texto.trim());
  if (SI.has(v)) return true;
  if (NO.has(v)) return false;
  return null;
}
