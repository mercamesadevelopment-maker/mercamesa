import type { SupabaseClient } from '@supabase/supabase-js';
import { getStoragePublicUrl } from '@/lib/supabase/utils';

/**
 * Los documentos legales de la plataforma.
 *
 * «Cuál es la versión vigente» lo necesitan cinco sitios —la pestaña del admin,
 * el pie de página, el registro, la pantalla de aceptación y la ruta que la
 * registra—, así que la respuesta vive acá y no repetida en cada uno.
 */

export const LEGAL_BUCKET = 'legal';

export type LegalKind = 'terms' | 'privacy';

export const LEGAL_KINDS: LegalKind[] = ['terms', 'privacy'];

export const LEGAL_LABELS: Record<LegalKind, string> = {
  terms: 'Términos y condiciones',
  privacy: 'Política de tratamiento de datos',
};

export type LegalDocument = {
  id: string;
  kind: LegalKind;
  version: number;
  fileName: string;
  /** Pública y sin vencimiento: se lee sin sesión, antes de tener cuenta. */
  url: string;
  publishedAt: string;
};

function aDocumento(row: {
  id: string;
  kind: string;
  version: number;
  file_path: string;
  file_name: string;
  published_at: string;
}): LegalDocument {
  return {
    id: row.id,
    kind: row.kind as LegalKind,
    version: row.version,
    fileName: row.file_name,
    // `file_path` es NOT NULL, así que siempre hay URL.
    url: getStoragePublicUrl(LEGAL_BUCKET, row.file_path)!,
    publishedAt: row.published_at,
  };
}

/**
 * La versión vigente de cada documento: la de mayor `version` de su tipo.
 *
 * Devuelve solo los que existen. Mientras el administrador no haya publicado
 * ninguno, la lista viene vacía y todo lo que depende de esto —el enlace del
 * pie, la pantalla de aceptación— simplemente no aparece, en vez de romperse.
 */
export async function getCurrentLegalDocuments(
  supabase: SupabaseClient<any>
): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('id, kind, version, file_path, file_name, published_at')
    .order('kind', { ascending: true })
    .order('version', { ascending: false });

  if (error) {
    console.error('[legal] no se pudieron leer los documentos', error.message);
    return [];
  }

  // La consulta trae todas las versiones ordenadas; se queda la primera de cada
  // tipo. Hacerlo acá y no con un `distinct on` mantiene la consulta legible y
  // el volumen es de unas pocas filas.
  const vigentes = new Map<string, LegalDocument>();
  for (const row of data ?? []) {
    if (!vigentes.has(row.kind)) vigentes.set(row.kind, aDocumento(row));
  }

  return LEGAL_KINDS.map((k) => vigentes.get(k)).filter(
    (d): d is LegalDocument => Boolean(d)
  );
}

/**
 * Los documentos vigentes que esta persona todavía no ha aceptado.
 *
 * El superadmin nunca tiene pendientes: si un PDF se sube mal, alguien tiene que
 * poder entrar a arreglarlo sin quedar frente a la pantalla de aceptación.
 */
export async function getPendingLegalDocuments(
  supabase: SupabaseClient<any>,
  userId: string,
  roleName: string | null | undefined
): Promise<LegalDocument[]> {
  if (roleName === 'superadmin') return [];

  const vigentes = await getCurrentLegalDocuments(supabase);
  if (vigentes.length === 0) return [];

  const { data: aceptados } = await supabase
    .from('legal_acceptances')
    .select('document_id')
    .eq('user_id', userId)
    .in('document_id', vigentes.map((d) => d.id));

  const yaAceptados = new Set((aceptados ?? []).map((a) => a.document_id));

  return vigentes.filter((d) => !yaAceptados.has(d.id));
}
