import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import {
  getCurrentLegalDocuments,
  LEGAL_BUCKET,
  LEGAL_LABELS,
  type LegalKind,
} from '@/lib/legal/current-documents';
import { getStoragePublicUrl } from '@/lib/supabase/utils';

/**
 * La constancia legal de un usuario: qué aceptó, cuándo y desde dónde.
 *
 * Va en su propia ruta y no dentro del listado porque trae la IP de cada
 * aceptación, que no tiene por qué viajar en cada carga de la tabla.
 *
 * Incluye también la aceptación heredada del formulario de registro
 * (`profiles.terms_accepted_at`). Es anterior al sistema de documentos y no
 * apunta a ningún PDF, pero para quienes se registraron antes es la única
 * evidencia que existe, así que se devuelve aparte y etiquetada como lo que es.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'users',
      'read',
      'No tienes permisos para ver los usuarios'
    );
    if (denied) return denied;

    // Con la llave de servicio, igual que el listado: `profiles` tiene RLS y el
    // permiso ya se verificó arriba.
    const service = createSupabaseServiceClient();

    const { data: perfil, error: perfilError } = await service
      .from('profiles')
      .select('id, full_name, email, terms_accepted_at, roles ( name )')
      .eq('id', userId)
      .maybeSingle();

    if (perfilError) {
      console.error('admin/users/legal: perfil', perfilError);
      return NextResponse.json({ error: 'No se pudo cargar el usuario.' }, { status: 500 });
    }

    if (!perfil) {
      return NextResponse.json({ error: 'El usuario no existe.' }, { status: 404 });
    }

    const { data: filas, error } = await service
      .from('legal_acceptances')
      .select('document_id, accepted_at, accepted_ip, legal_documents ( kind, version, file_path, file_name, published_at )')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('admin/users/legal: aceptaciones', error);
      return NextResponse.json({ error: 'No se pudo cargar la constancia.' }, { status: 500 });
    }

    const accepted = (filas ?? []).map((a: any) => ({
      documentId: a.document_id,
      kind: a.legal_documents?.kind as LegalKind | undefined,
      label: a.legal_documents?.kind
        ? LEGAL_LABELS[a.legal_documents.kind as LegalKind]
        : 'Documento eliminado',
      version: a.legal_documents?.version ?? null,
      fileName: a.legal_documents?.file_name ?? null,
      url: a.legal_documents?.file_path
        ? getStoragePublicUrl(LEGAL_BUCKET, a.legal_documents.file_path)
        : null,
      acceptedAt: a.accepted_at,
      acceptedIp: a.accepted_ip,
    }));

    // Lo que le falta: los vigentes que no están entre los aceptados. El
    // superadmin nunca tiene pendientes (ver `getPendingLegalDocuments`).
    const vigentes = await getCurrentLegalDocuments(service);
    const yaAceptados = new Set(accepted.map((a) => a.documentId));
    const esSuperadmin = (perfil as any).roles?.name === 'superadmin';

    const pending = esSuperadmin
      ? []
      : vigentes
          .filter((d) => !yaAceptados.has(d.id))
          .map((d) => ({
            documentId: d.id,
            kind: d.kind,
            label: LEGAL_LABELS[d.kind],
            version: d.version,
            fileName: d.fileName,
            url: d.url,
            publishedAt: d.publishedAt,
          }));

    return NextResponse.json(
      {
        data: {
          userName: perfil.full_name,
          userEmail: perfil.email,
          accepted,
          pending,
          /** Anterior al sistema de documentos: sin PDF al que apuntar. */
          signupAcceptedAt: perfil.terms_accepted_at,
          publishedLegalDocuments: vigentes.length,
          isSuperadmin: esSuperadmin,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
