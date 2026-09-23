import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStoragePublicUrl } from '@/lib/supabase/utils';
import {
  LEGAL_BUCKET,
  LEGAL_KINDS,
  type LegalKind,
} from '@/lib/legal/current-documents';
import { notifyLegalDocumentUpdate } from '@/lib/legal/notify-update';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Publicar y consultar las versiones de los documentos legales.
 *
 * Append-only, como el precio mínimo de orden y las tarifas: cada publicación es
 * una fila nueva y la de mayor `version` de cada tipo es la vigente. La única
 * excepción es la corrección menor, que reemplaza el archivo de la vigente sin
 * crear versión — y por eso no invalida las aceptaciones ya registradas.
 */

export async function GET() {
  try {
    const supabase = await createClient();

    // La RLS de `legal_documents` deja leer a cualquiera —el pie de página los
    // consulta sin sesión—, así que el permiso hay que exigirlo acá: esta vista
    // trae además la observación interna del cambio y quién publicó.
    const denied = await requirePermission(
      supabase,
      'system-settings',
      'read',
      'No tienes permisos para ver los documentos legales'
    );
    if (denied) return denied;

    const { data, error } = await supabase
      .from('legal_documents')
      .select('*, profiles:published_by ( full_name, email )')
      .order('kind', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      console.error('admin/legal-documents GET:', error.message);
      return NextResponse.json(
        { error: 'No se pudieron cargar los documentos.' },
        { status: 400 }
      );
    }

    const documents = (data ?? []).map((row: any) => ({
      id: row.id,
      kind: row.kind as LegalKind,
      version: row.version,
      fileName: row.file_name,
      url: getStoragePublicUrl(LEGAL_BUCKET, row.file_path),
      notes: row.notes,
      publishedAt: row.published_at,
      publishedBy: row.profiles?.full_name || row.profiles?.email || null,
      notifiedAt: row.notified_at,
      notifiedCount: row.notified_count,
      notifyFailed: row.notify_failed,
    }));

    // A cuántos se les avisaría: el formulario lo dice antes de publicar, para
    // que nadie mande 24 correos sin saber que los estaba mandando.
    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json(
      { data: { documents, activeUsers: activeUsers ?? 0 } },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // En línea y no con `requirePermission` porque también hace falta `user.id`
    // para la columna `published_by`. Mismo criterio que tarifas.
    const { data: canCreate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'create',
    });

    if (!canCreate) {
      return NextResponse.json(
        { error: 'No tienes permisos para publicar documentos legales' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const kind = body.kind as LegalKind;
    const filePath = (body.file_path as string || '').trim();
    const fileName = (body.file_name as string || '').trim();
    const notes = (body.notes as string || '').trim();
    const esCorreccionMenor = body.minor_fix === true;

    if (!LEGAL_KINDS.includes(kind)) {
      return NextResponse.json({ error: 'El tipo de documento no es válido.' }, { status: 400 });
    }

    if (!filePath || !fileName) {
      return NextResponse.json({ error: 'Falta el archivo del documento.' }, { status: 400 });
    }

    if (!notes) {
      return NextResponse.json(
        { error: 'La observación del cambio es requerida.' },
        { status: 400 }
      );
    }

    // El cliente sube directo a Storage y manda la ruta. Sin esto, esa ruta
    // podría apuntar a cualquier cosa y quedar guardada como si fuera el
    // documento legal de la plataforma.
    if (!filePath.startsWith(`${kind}/`) || !filePath.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'La ruta del archivo no es válida.' },
        { status: 400 }
      );
    }

    const { data: vigente } = await supabase
      .from('legal_documents')
      .select('id, version')
      .eq('kind', kind)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ------------------------------------------------------------------
    // Corrección menor: mismo documento, archivo corregido
    // ------------------------------------------------------------------
    if (esCorreccionMenor) {
      if (!vigente) {
        return NextResponse.json(
          { error: 'No hay una versión publicada que corregir.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('legal_documents')
        .update({ file_path: filePath, file_name: fileName, notes })
        .eq('id', vigente.id)
        .select()
        .single();

      if (error) {
        console.error('admin/legal-documents corrección menor:', error.message);
        return NextResponse.json(
          { error: 'No se pudo guardar la corrección.' },
          { status: 400 }
        );
      }

      // Sin aviso y sin tocar las aceptaciones: es el mismo documento.
      return NextResponse.json({ data, notified: null }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // Versión nueva
    // ------------------------------------------------------------------
    const version = (vigente?.version ?? 0) + 1;

    const { data: creado, error } = await supabase
      .from('legal_documents')
      .insert({
        kind,
        version,
        file_path: filePath,
        file_name: fileName,
        notes,
        published_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('admin/legal-documents POST:', error.message);
      return NextResponse.json(
        { error: 'No se pudo publicar el documento.' },
        { status: 400 }
      );
    }

    // La primera publicación no avisa: no se actualizó nada, recién se publicó,
    // y el correo diría algo falso.
    if (version === 1) {
      return NextResponse.json({ data: creado, notified: null }, { status: 201 });
    }

    // Publicar no se deshace porque el correo falle: el documento vigente es lo
    // que importa. El resultado queda en la fila para poder reintentar.
    const resultado = await notifyLegalDocumentUpdate({
      kind,
      version,
      url: getStoragePublicUrl(LEGAL_BUCKET, filePath)!,
      publishedBy: user.id,
      documentId: creado.id,
    });

    await supabase
      .from('legal_documents')
      .update({
        notified_at: new Date().toISOString(),
        notified_count: resultado.enviados,
        notify_failed: resultado.fallidos,
      })
      .eq('id', creado.id);

    return NextResponse.json({ data: creado, notified: resultado }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
