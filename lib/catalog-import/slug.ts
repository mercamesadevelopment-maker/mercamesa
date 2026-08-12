/**
 * Slug de un producto del catálogo (`catalog_products.slug`, UNIQUE).
 *
 * Ninguna capa del backend lo generaba ni lo desambiguaba: un choque devolvía el
 * mensaje crudo de Postgres. Y el slugify que tenía el formulario del admin no
 * quitaba tildes, así que "Ñame criollo" producía "-ame-criollo" y "Maracuyá"
 * producía "maracuy-". Acá se hace como en el seed: desacentuando primero.
 */

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    // Marcas diacríticas: hay que quitarlas ANTES de filtrar por [a-z0-9], si no
    // la letra acentuada se pierde entera junto con su tilde.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Devuelve un slug libre, agregando sufijos `-1`, `-2`… como ya hace el seed
 * para los nombres que se repiten entre categorías (`pechuga-de-pollo-1`).
 *
 * `taken` se consulta y se actualiza, así que sirve a la vez para los slugs ya
 * guardados y para los generados antes en el mismo archivo.
 */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name) || 'producto';

  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }

  for (let suffix = 1; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }
}
