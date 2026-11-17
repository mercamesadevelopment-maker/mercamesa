import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils/text';
import { phoneticKey } from './phonetic';

/**
 * La búsqueda tolerante en el servidor (PostgREST), para el catálogo y la
 * vitrina. En el navegador está `fuzzyFilter` (`./fuzzy.ts`).
 *
 * Primera red, en la consulta: cada palabra tiene que estar en el texto
 * (`search_text`, sin tildes) **o** sonar igual (`search_phonetic`, la clave de
 * `clave_fonetica`). Así «bino» encuentra «vino» y «aros», «arroz».
 *
 * Segunda red, si no salió nada: `findSimilarProductIds`, con trigramas, para
 * los errores de tecleo («aguacte»).
 */

/** Las palabras de un término, solo letras y números: lo demás rompería el filtro `or` de PostgREST. */
export function searchWords(termino: string): string[] {
  return normalizeText(termino)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
}

interface Filtrable<Q> {
  or(filtros: string, opciones?: { referencedTable?: string }): Q;
}

/**
 * Agrega el filtro de búsqueda a una consulta de supabase-js.
 *
 * @param columnas Las dos columnas: el texto sin tildes y su clave fonética.
 * @param referencedTable Si las columnas son de una tabla embebida (con `!inner`).
 */
export function applyProductSearch<Q extends Filtrable<Q>>(
  query: Q,
  termino: string,
  columnas: { text: string; phonetic: string },
  referencedTable?: string
): Q {
  let q = query;
  for (const palabra of searchWords(termino)) {
    const clave = phoneticKey(palabra);
    const filtros = [`${columnas.text}.ilike.%${palabra}%`];
    // Aunque la palabra sea su propia clave, se busca en la fonética: «bino»
    // está en la clave de «vino» («bino tinto») aunque no en su texto.
    if (clave) filtros.push(`${columnas.phonetic}.ilike.%${clave}%`);
    q = q.or(filtros.join(','), referencedTable ? { referencedTable } : undefined);
  }
  return q;
}

/**
 * Los productos del catálogo que más se parecen a lo buscado
 * (`buscar_productos_parecidos`), para cuando la búsqueda no encontró nada.
 * Vacío si el término es muy corto o si la función falla: es una ayuda, no
 * puede tumbar la búsqueda.
 */
export async function findSimilarProductIds(supabase: SupabaseClient<any>, termino: string, limite = 60): Promise<string[]> {
  const texto = searchWords(termino).join(' ');
  if (texto.length < 3) return [];
  const { data, error } = await supabase.rpc('buscar_productos_parecidos', { p_texto: texto, p_limite: limite });
  if (error) {
    console.error('buscar_productos_parecidos:', error.message);
    return [];
  }
  return ((data ?? []) as { catalog_product_id: string }[]).map((r) => r.catalog_product_id);
}
