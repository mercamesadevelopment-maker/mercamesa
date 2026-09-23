import { isValidEmail } from '@/lib/email/validate';

/**
 * Reglas de calidad de los datos de una tienda, en un solo lugar.
 *
 * No había ninguna: se podía guardar un correo de contacto malformado o una
 * descripción sin límite de longitud, tanto desde el formulario del admin
 * (`StoreModal`) como pegándole directo a la API. El formulario y las dos rutas
 * que guardan una tienda (`POST /api/stores`, `PUT /api/stores/[id]`) comparten
 * esta función para que la regla no se escriba tres veces y se desincronice.
 *
 * Teléfono y WhatsApp no están acá: ya los valida `toE164` en las rutas. El slug
 * ya se autogenera con una regex en el formulario. Las categorías ya se validan
 * en `lib/stores/category-links.ts`.
 */

const NAME_MAX_LENGTH = 120;
export const STORE_DESCRIPTION_MAX_LENGTH = 500;

export interface StoreFieldsInput {
  name?: string | null;
  description?: string | null;
  contactEmail?: string | null;
}

/** Devuelve el primer error encontrado, o `null` si los campos son válidos. */
export function validateStoreFields(input: StoreFieldsInput): string | null {
  const name = input.name?.trim() ?? '';
  if (input.name !== undefined && !name) {
    return 'El nombre de la tienda es obligatorio.';
  }
  if (name.length > NAME_MAX_LENGTH) {
    return `El nombre de la tienda no puede superar los ${NAME_MAX_LENGTH} caracteres.`;
  }

  if (input.description && input.description.length > STORE_DESCRIPTION_MAX_LENGTH) {
    return `La descripción no puede superar los ${STORE_DESCRIPTION_MAX_LENGTH} caracteres.`;
  }

  if (input.contactEmail && !isValidEmail(input.contactEmail)) {
    return 'El correo de contacto no es válido.';
  }

  return null;
}
