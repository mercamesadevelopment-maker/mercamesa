/**
 * Traduce el error 23505 de Postgres (violación de índice único) a una frase
 * entendible.
 *
 * Existe porque devolver `error.message` tal cual saca a la pantalla cosas como
 * `duplicate key value violates unique constraint "categories_slug_key"`: no le
 * dice nada a quien administra, no indica qué campo corregir, y de paso expone
 * nombres de índices de la base.
 *
 * Sigue el mismo criterio que `lib/products/product-code.ts`, que ya resolvía
 * este caso para el código de producto: el nombre del índice es la clave, y el
 * mensaje se escribe donde se conoce el contexto (qué entidad y qué valor).
 */

/** Forma mínima de un error de PostgREST/Postgres; evita atarse a su tipo. */
export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/**
 * Devuelve el mensaje correspondiente al índice que se violó, o `null` si el
 * error no es una violación de unicidad conocida — en cuyo caso el llamador
 * decide qué responder.
 *
 * @param mensajes Índice único → frase para mostrar.
 */
export function uniqueViolationMessage(
  error: DbErrorLike | null | undefined,
  mensajes: Record<string, string>
): string | null {
  if (!error || error.code !== '23505') return null;

  // El nombre del índice viene dentro del mensaje, entre comillas dobles:
  // `duplicate key value violates unique constraint "categories_slug_key"`.
  const texto = `${error.message ?? ''} ${error.details ?? ''}`;

  for (const [indice, mensaje] of Object.entries(mensajes)) {
    if (texto.includes(indice)) return mensaje;
  }

  return null;
}

/**
 * Mensaje genérico para un 23505 que no está en el mapa. Se prefiere esto a
 * mostrar el error crudo: al menos dice qué pasó y qué hacer.
 */
export const DUPLICATE_FALLBACK_MESSAGE =
  'Ya existe otro registro con ese valor. Revisa los campos que deben ser únicos.';
