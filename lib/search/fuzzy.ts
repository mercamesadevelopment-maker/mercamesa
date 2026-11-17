import { normalizeText } from '@/lib/utils/text';
import { phoneticKey } from './phonetic';

/**
 * Búsqueda tolerante en el navegador: encuentra «vino» con «bino», «arroz» con
 * «aros» y «aguacate» con «aguacte».
 *
 * Cada palabra de la consulta tiene que aparecer en el texto, y vale según cómo:
 *  - 3: tal cual (sin tildes ni mayúsculas), en cualquier parte;
 *  - 2: suena igual (`phoneticKey`) que el comienzo de una palabra del texto;
 *  - 1: se parece: una letra de diferencia en palabras de 4 a 6 letras, dos
 *       desde 7. Las de 3 o menos no se toleran, para que «pan» no traiga «pon».
 *
 * Lo exacto queda antes que lo que suena igual, y eso antes que lo parecido.
 * Para el servidor está `applyProductSearch` (`./server.ts`).
 */

const EXACTA = 3;
const FONETICA = 2;
const PARECIDA = 1;

function palabras(normalizado: string): string[] {
  return normalizado.split(/[^a-z0-9]+/).filter(Boolean);
}

/** Distancia de edición con trasposición (Damerau, versión OSA), cortando al pasar `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let menor = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < menor) menor = v;
    }
    if (menor > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

function tolerancia(palabra: string): number {
  if (palabra.length <= 3) return 0;
  return palabra.length >= 7 ? 2 : 1;
}

/** Un texto ya preparado para comparar muchas veces. */
export interface PreparedText {
  normal: string;
  words: string[];
  phonetic: string[];
}

export function prepareText(texto: string | string[] | null | undefined): PreparedText {
  const unido = Array.isArray(texto) ? texto.filter(Boolean).join(' ') : texto ?? '';
  const normal = normalizeText(unido);
  const words = palabras(normal);
  return { normal, words, phonetic: words.map(phoneticKey) };
}

function puntajePalabra(q: string, qFon: string, t: PreparedText): number {
  if (t.normal.includes(q)) return EXACTA;
  if (qFon && t.phonetic.some((w) => w.startsWith(qFon))) return FONETICA;
  const max = tolerancia(q);
  if (max === 0) return 0;
  const parecida = t.words.some((w) => {
    // Contra la palabra entera y contra su comienzo del mismo largo: «aguacte»
    // se parece a «aguacate», y «tomat» al comienzo de «tomatera».
    if (editDistance(q, w, max) <= max) return true;
    return w.length > q.length && editDistance(q, w.slice(0, q.length), max) <= max;
  });
  return parecida ? PARECIDA : 0;
}

/** Qué tanto coincide `consulta` con `texto`. `0` = no coincide. Consulta vacía = coincide. */
export function matchScore(consulta: string, texto: string | string[] | PreparedText): number {
  const q = palabras(normalizeText(consulta));
  if (q.length === 0) return 1;
  const t = typeof texto === 'object' && !Array.isArray(texto) ? texto : prepareText(texto);
  let total = 0;
  for (const palabra of q) {
    const p = puntajePalabra(palabra, phoneticKey(palabra), t);
    if (p === 0) return 0;
    total += p;
  }
  // Un pequeño premio a lo que empieza igual que la consulta: «papa» antes que «arepa de papa».
  return total + (t.normal.startsWith(normalizeText(consulta).trim()) ? 0.5 : 0);
}

/**
 * Si coincide, sin ordenar. Para listas que no deben cambiar de orden mientras
 * se buscan (una tabla que se está editando, por ejemplo).
 */
export function fuzzyMatches(consulta: string, texto: string | (string | null | undefined)[]): boolean {
  const t = Array.isArray(texto) ? texto.filter((x): x is string => Boolean(x)) : texto;
  return matchScore(consulta, t) > 0;
}

/**
 * Filtra y ordena por qué tan bien coincide cada elemento. Con la consulta
 * vacía devuelve la lista tal cual. Entre iguales, conserva el orden original.
 *
 * @example
 * fuzzyFilter(productos, 'bino', (p) => [p.name, p.code])
 */
export function fuzzyFilter<T>(items: T[], consulta: string, campos: (item: T) => string | (string | null | undefined)[]): T[] {
  if (palabras(normalizeText(consulta)).length === 0) return items;
  return items
    .map((item, i) => {
      const c = campos(item);
      const texto = Array.isArray(c) ? c.filter((x): x is string => Boolean(x)) : c;
      return { item, i, score: matchScore(consulta, texto) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.item);
}
