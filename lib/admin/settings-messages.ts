/**
 * Mensajes de unicidad de Parametrización, en un solo lugar.
 *
 * Van acá y no dentro de cada `route.ts` porque Next solo admite exportar
 * métodos HTTP desde una ruta: cualquier otra exportación rompe el build.
 *
 * Los nombres de índice están verificados contra la base (`pg_indexes`), no
 * supuestos: son la única pista que trae el error 23505, así que uno mal escrito
 * haría que el mensaje bueno nunca se use y saliera el genérico.
 *
 * `measurement_units` no aparece acá a propósito: no tiene ningún índice único
 * fuera de la clave primaria, así que su abreviatura se puede repetir.
 */

export const CATEGORY_SLUG_INDEX = 'categories_slug_key';
export const STORE_CATEGORY_SLUG_INDEX = 'store_categories_slug_key';
export const DOCUMENT_TYPE_SLUG_INDEX = 'document_types_slug_key';
/** Es compuesto: (parent_id, key). Dos módulos pueden repetir clave si cuelgan de padres distintos. */
export const MODULE_PARENT_KEY_INDEX = 'modules_parent_id_key_key';

export const categorySlugMessage = (slug: string) =>
  `Ya existe otra categoría con el slug "${slug}". Cambia el slug o edita la categoría que ya lo usa.`;

export const storeCategorySlugMessage = (slug: string) =>
  `Ya existe otra categoría de tienda con el slug "${slug}".`;

export const documentTypeSlugMessage = (slug: string) =>
  `Ya existe otro tipo de documento con el slug "${slug}".`;

export const moduleKeyMessage = (key: string) =>
  `Ya existe otro módulo con la clave "${key}" bajo el mismo módulo padre.`;

/** Mapas listos para `uniqueViolationMessage`. */
export const categorySlugMap = (slug: string) => ({ [CATEGORY_SLUG_INDEX]: categorySlugMessage(slug) });
export const storeCategorySlugMap = (slug: string) => ({ [STORE_CATEGORY_SLUG_INDEX]: storeCategorySlugMessage(slug) });
export const documentTypeSlugMap = (slug: string) => ({ [DOCUMENT_TYPE_SLUG_INDEX]: documentTypeSlugMessage(slug) });
export const moduleKeyMap = (key: string) => ({ [MODULE_PARENT_KEY_INDEX]: moduleKeyMessage(key) });
