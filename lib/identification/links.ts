import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Reescribe a qué tipos de persona aplica una identificación.
 *
 * Es la regla del cliente (Natural → CC, Jurídica → NIT, Establecimiento → NIT
 * o RUT), guardada en `person_type_identification_types`. Se edita desde el
 * propio tipo de identificación para no necesitar una tercera pantalla.
 *
 * Devuelve el mensaje de error, o `null` si salió bien.
 */
export async function replacePersonTypeLinks(
  supabase: SupabaseClient<any>,
  identificationTypeId: string,
  personTypeIds: string[]
): Promise<string | null> {
  const unique = Array.from(new Set(personTypeIds.filter(Boolean)));

  const { error: deleteError } = await supabase
    .from('person_type_identification_types')
    .delete()
    .eq('identification_type_id', identificationTypeId);

  if (deleteError) return deleteError.message;

  if (unique.length === 0) return null;

  const { error: insertError } = await supabase
    .from('person_type_identification_types')
    .insert(
      unique.map((personTypeId) => ({
        person_type_id: personTypeId,
        identification_type_id: identificationTypeId,
      }))
    );

  return insertError ? insertError.message : null;
}
