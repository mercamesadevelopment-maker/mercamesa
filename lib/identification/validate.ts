import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * La regla que pidió el cliente: qué identificación vale para qué tipo de
 * persona (Natural → CC, Jurídica → NIT, Establecimiento → NIT o RUT).
 *
 * Vive en `person_type_identification_types` y se administra desde
 * Parametrización. Filtrar el desplegable del formulario no basta: sin esta
 * comprobación, un POST a mano registraría una persona Natural con NIT.
 */

export interface IdentificationPairError {
  message: string;
}

/**
 * Verifica que el par exista en la tabla puente. Devuelve `null` si es válido,
 * o el error a devolver al cliente.
 */
export async function validateIdentificationPair(
  supabase: SupabaseClient<any>,
  personTypeId: string | null | undefined,
  identificationTypeId: string | null | undefined
): Promise<IdentificationPairError | null> {
  if (!personTypeId) {
    return { message: 'Falta el tipo de persona.' };
  }

  if (!identificationTypeId) {
    return { message: 'Falta el tipo de identificación.' };
  }

  const { data, error } = await supabase
    .from('person_type_identification_types')
    .select('person_type_id')
    .eq('person_type_id', personTypeId)
    .eq('identification_type_id', identificationTypeId)
    .maybeSingle();

  if (error) {
    return { message: `No se pudo validar el tipo de identificación: ${error.message}` };
  }

  if (!data) {
    return {
      message: 'El tipo de identificación no corresponde al tipo de persona seleccionado.',
    };
  }

  return null;
}

/** Datos del tipo de persona que condicionan qué campos pide el formulario. */
export interface PersonTypeRules {
  id: string;
  requiresBusinessName: boolean;
}

/**
 * Comprueba que la identificación exista y esté activa, sin atarla a un tipo de
 * persona.
 *
 * Hace falta para los perfiles antiguos que quedaron sin `person_type_id`: se
 * registraron por un formulario que nunca lo pedía. Con la regla completa no
 * podrían tocar nunca su tipo de identificación, y no hay nada que violar
 * porque no tienen tipo de persona contra el cual contrastar.
 */
export async function validateIdentificationTypeExists(
  supabase: SupabaseClient<any>,
  identificationTypeId: string | null | undefined
): Promise<IdentificationPairError | null> {
  if (!identificationTypeId) {
    return { message: 'Falta el tipo de identificación.' };
  }

  const { data } = await supabase
    .from('identification_types')
    .select('id')
    .eq('id', identificationTypeId)
    .eq('is_active', true)
    .maybeSingle();

  return data ? null : { message: 'El tipo de identificación no es válido.' };
}

export async function getPersonTypeRules(
  supabase: SupabaseClient<any>,
  personTypeId: string
): Promise<PersonTypeRules | null> {
  const { data } = await supabase
    .from('person_types')
    .select('id, requires_business_name')
    .eq('id', personTypeId)
    .eq('is_active', true)
    .maybeSingle();

  if (!data) return null;

  return { id: data.id as string, requiresBusinessName: Boolean(data.requires_business_name) };
}
