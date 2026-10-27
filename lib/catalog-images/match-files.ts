import { normalizeText } from '@/lib/utils/text';
import { CATALOG_IMAGE_MAX_BYTES, imageExtension, isAcceptedImageExtension } from './files';

/** Un producto al que se le puede poner foto. */
export interface ImageTarget {
  id: string;
  slug: string;
  name: string;
  hasImage: boolean;
}

export interface ImageFileInfo {
  name: string;
  size: number;
}

export type ImageMatchStatus = 'ok' | 'replaces' | 'no_match' | 'ambiguous' | 'duplicate' | 'invalid';

export interface ImageMatch {
  /** Posición del archivo en la lista que se recibió. */
  index: number;
  fileName: string;
  status: ImageMatchStatus;
  product: ImageTarget | null;
  message: string;
}

/**
 * La clave con la que se compara un nombre de archivo, un slug o un nombre de
 * producto: sin tildes, en minúscula, y con guiones, guiones bajos y espacios
 * como una sola separación. Así «Tomate Chonto.jpg», «tomate_chonto.jpg» y el
 * slug «tomate-chonto» son lo mismo.
 */
export function imageKey(text: string): string {
  return normalizeText(text)
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function baseName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i < 0 ? fileName : fileName.slice(0, i);
}

/**
 * A qué producto va cada foto, por el nombre del archivo.
 *
 * Primero por el slug («Código catálogo» en la plantilla), que es único; si no,
 * por el nombre del producto, que puede repetirse. Dos fotos para el mismo
 * producto se marcan las dos: no hay cómo saber cuál es la buena.
 */
export function matchImageFiles(files: ImageFileInfo[], products: ImageTarget[]): ImageMatch[] {
  const bySlug = new Map<string, ImageTarget>();
  const byName = new Map<string, ImageTarget[]>();
  for (const p of products) {
    bySlug.set(imageKey(p.slug), p);
    const key = imageKey(p.name);
    byName.set(key, [...(byName.get(key) ?? []), p]);
  }

  const matches: ImageMatch[] = files.map((file, index) => {
    const base = { index, fileName: file.name, product: null };
    if (!isAcceptedImageExtension(imageExtension(file.name))) {
      return { ...base, status: 'invalid', message: 'Solo se aceptan fotos JPG, PNG o WEBP.' };
    }
    if (file.size > CATALOG_IMAGE_MAX_BYTES) {
      return { ...base, status: 'invalid', message: 'Pesa más de 8 MB: redúcela antes de subirla.' };
    }

    const key = imageKey(baseName(file.name));
    const product = bySlug.get(key) ?? null;
    if (product) return { ...base, product, status: 'ok', message: '' };

    const named = byName.get(key) ?? [];
    if (named.length > 1) {
      return {
        ...base,
        status: 'ambiguous',
        message: `Hay ${named.length} productos con ese nombre: nombra la foto con el código del catálogo.`,
      };
    }
    if (named.length === 1) return { ...base, product: named[0], status: 'ok', message: '' };

    return { ...base, status: 'no_match', message: 'No hay ningún producto con ese código o nombre.' };
  });

  const perProduct = new Map<string, number>();
  for (const m of matches) {
    if (m.product) perProduct.set(m.product.id, (perProduct.get(m.product.id) ?? 0) + 1);
  }

  return matches.map((m) => {
    if (!m.product) return m;
    if ((perProduct.get(m.product.id) ?? 0) > 1) {
      return { ...m, status: 'duplicate', message: `Hay más de una foto para «${m.product.name}».` };
    }
    if (m.product.hasImage) {
      return { ...m, status: 'replaces', message: `«${m.product.name}» ya tiene foto.` };
    }
    return m;
  });
}
