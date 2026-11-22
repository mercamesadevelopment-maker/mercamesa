import type { SupabaseClient } from '@supabase/supabase-js';
import { getIdentificationSlug } from '@/lib/identification/validate';
import { normalizeDocumentNumber, validateDocumentNumber } from '@/lib/identification/validate-document';
import { validateNitCheckDigit } from '@/lib/identification/nit';

/**
 * La identificación de la tienda (NIT, cédula…): `stores.identification_type_id`,
 * `document_number` y `document_dv`. La editan el admin y el tendero, y es
 * opcional: vaciar el número borra los tres.
 *
 * El número se valida según su tipo, con las mismas reglas que el de un perfil
 * (`validateDocumentNumber`). Con NIT o RUT se pide el dígito de verificación
 * escrito y se comprueba (`validateNitCheckDigit`): calcularlo solo haría que
 * un NIT mal escrito pasara.
 */

export interface StoreIdentificationFields {
  identification_type_id: string | null;
  document_number: string | null;
  document_dv: string | null;
}

const CON_DV = new Set(['nit', 'rut']);

/** Si el tipo de documento lleva dígito de verificación. */
export function needsCheckDigit(slug: string | null | undefined): boolean {
  return CON_DV.has(String(slug ?? ''));
}

/** Si el cuerpo trae algo de la identificación. Si no trae nada, no se toca. */
export function hasIdentification(body: Record<string, unknown>): boolean {
  return ['identification_type_id', 'document_number', 'document_dv'].some((k) => body[k] !== undefined);
}

/**
 * Lee la identificación del cuerpo. `slug` es el del tipo elegido, resuelto en
 * el servidor: `null` si el tipo no existe.
 */
export function parseStoreIdentification(
  body: Record<string, unknown>,
  slug: string | null
): { fields: StoreIdentificationFields } | { error: string } {
  const numero = normalizeDocumentNumber(typeof body.document_number === 'string' ? body.document_number : '');
  if (!numero) return { fields: { identification_type_id: null, document_number: null, document_dv: null } };

  const tipo = typeof body.identification_type_id === 'string' ? body.identification_type_id : '';
  if (!tipo) return { error: 'Elige el tipo de identificación de la tienda.' };
  if (!slug) return { error: 'El tipo de identificación no existe.' };

  const errorNumero = validateDocumentNumber(numero, slug);
  if (errorNumero) return { error: errorNumero };

  let dv: string | null = null;
  if (needsCheckDigit(slug)) {
    dv = String(body.document_dv ?? '').trim();
    if (!dv) return { error: 'Escribe el dígito de verificación del NIT (el número después del guion).' };
    const errorDv = validateNitCheckDigit(numero, dv);
    if (errorDv) return { error: errorDv };
  }

  return { fields: { identification_type_id: tipo, document_number: numero, document_dv: dv } };
}

/** Lo mismo, resolviendo el tipo en la base. `null` si el cuerpo no trae identificación. */
export async function resolveStoreIdentification(
  supabase: SupabaseClient<any>,
  body: Record<string, unknown>
): Promise<{ fields: StoreIdentificationFields } | { error: string } | null> {
  if (!hasIdentification(body)) return null;
  const tipo = typeof body.identification_type_id === 'string' ? body.identification_type_id : null;
  const slug = await getIdentificationSlug(supabase, tipo);
  return parseStoreIdentification(body, slug);
}
