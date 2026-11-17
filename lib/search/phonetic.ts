import { normalizeText } from '@/lib/utils/text';

/**
 * La clave fonética de un texto en español: cómo suena, no cómo se escribe.
 *
 * Así «bino» y «vino» dan «bino»; «hagua» y «agua», «agua»; «aros» y «arroz»,
 * «aros». Es lo que resuelve los errores de ortografía más comunes, que son de
 * sonido (b/v, la h muda, s/z/c, ll/y, rr/r) y no de tecleo.
 *
 * **La base tiene la misma función** (`public.clave_fonetica`, migración
 * `busqueda_tolerante`) para la columna `catalog_products.search_phonetic`. Si
 * cambias una regla acá, cámbiala allá en el mismo orden: las dos se prueban con
 * los casos de `phonetic.cases.ts`.
 */
export function phoneticKey(texto: string | null | undefined): string {
  let s = normalizeText(texto).replace(/[^a-z0-9]+/g, ' ');
  s = s.replace(/ch/g, '_'); // la «ch» suena; se protege antes de quitar la h
  s = s.replace(/h/g, ''); // la h es muda
  s = s.replace(/qu/g, 'k');
  s = s.replace(/c([ei])/g, 's$1'); // ce, ci suenan s
  s = s.replace(/c/g, 'k'); // ca, co, cu, y la c antes de consonante
  s = s.replace(/z/g, 's');
  s = s.replace(/v/g, 'b');
  s = s.replace(/w/g, 'b');
  s = s.replace(/ll/g, 'y');
  s = s.replace(/g([ei])/g, 'j$1'); // ge, gi suenan j
  s = s.replace(/gu([ei])/g, 'g$1'); // gue, gui suenan ge, gi
  s = s.replace(/(.)\1+/g, '$1'); // rr → r, ss → s…
  s = s.replace(/_/g, 'ch');
  return s.replace(/\s+/g, ' ').trim();
}
