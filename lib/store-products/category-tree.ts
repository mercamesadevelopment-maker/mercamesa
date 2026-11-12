/**
 * Las categorías de la vitrina en dos niveles: categoría y sus subcategorías,
 * cada una con cuántos productos publicados tiene.
 *
 * Llega plano desde `vitrina_arbol_categorias` (una fila por subcategoría, o con
 * la subcategoría nula si el producto cuelga directo de la categoría) y se
 * agrupa acá, sin tocar el orden alfabético que ya trae la base.
 */

export interface VitrinaSubcategoria {
  name: string;
  total: number;
}

export interface VitrinaCategoria {
  name: string;
  total: number;
  subcategories: VitrinaSubcategoria[];
}

export interface FilaArbol {
  categoria: string | null;
  subcategoria: string | null;
  total: number | string;
}

export function toCategoryTree(filas: FilaArbol[]): VitrinaCategoria[] {
  const porNombre = new Map<string, VitrinaCategoria>();

  for (const fila of filas) {
    if (!fila.categoria) continue;
    const total = Number(fila.total) || 0;
    let categoria = porNombre.get(fila.categoria);
    if (!categoria) {
      categoria = { name: fila.categoria, total: 0, subcategories: [] };
      porNombre.set(fila.categoria, categoria);
    }
    categoria.total += total;
    if (fila.subcategoria) categoria.subcategories.push({ name: fila.subcategoria, total });
  }

  return Array.from(porNombre.values());
}
