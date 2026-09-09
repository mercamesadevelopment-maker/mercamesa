import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';
import { canManageStore } from '@/lib/auth/can-manage-store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storeId } = await params;
    const supabase = await createClient();

    // 1. Fetch all document types
    const { data: docTypes, error: typesError } = await supabase
      .from('document_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (typesError) throw typesError;

    // 2. Fetch all uploaded documents for this store
    const { data: storeDocs, error: docsError } = await supabase
      .from('store_documents')
      .select('*')
      .eq('store_id', storeId);

    if (docsError) throw docsError;

    // 3. Merge them and generate signed URLs for private files
    const consolidated = await Promise.all(
      (docTypes || []).map(async (type) => {
        const doc = (storeDocs || []).find((d) => d.document_type_id === type.id);
        let signedUrl = null;

        if (doc?.file_url) {
          const { data: signedData } = await supabase.storage
            .from('store-documents')
            .createSignedUrl(doc.file_url, 3600); // 1 hour expiration
          signedUrl = signedData?.signedUrl || null;
        }

        return {
          id: type.id,
          name: type.name,
          slug: type.slug,
          is_required: type.is_required,
          document_id: doc?.id || null,
          file_url: doc?.file_url || null,
          signedUrl,
          status: doc?.status || 'pending',
          uploaded_at: doc?.updated_at || null,
        };
      })
    );

    return NextResponse.json({ data: consolidated }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: storeId } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const documentTypeId = formData.get('document_type_id') as string;
    const status = formData.get('status') as string || 'pending';
    const file = formData.get('file') as File | null;

    if (!documentTypeId) {
      return NextResponse.json({ error: 'Falta indicar el tipo de documento.' }, { status: 400 });
    }

    // Subir documentación de una tienda es una acción de esa tienda, no de
    // cualquiera con sesión: antes bastaba con estar autenticado y se podían
    // tocar los documentos de tiendas ajenas.
    if (!(await canManageStore(supabase, storeId, user.id))) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar los documentos de esta tienda.' },
        { status: 403 }
      );
    }

    // Aprobar es la decisión que habilita a la tienda a operar, así que no puede
    // tomarla la tienda sobre sí misma: exige permiso de administración.
    if (status === 'approved') {
      const { data: canApprove } = await supabase.rpc('has_permission', {
        module_key: 'stores',
        action_name: 'update',
      });

      if (!canApprove) {
        return NextResponse.json(
          { error: 'Solo un administrador puede aprobar documentos de una tienda.' },
          { status: 403 }
        );
      }
    }

    // Get document type slug for naming
    const { data: docType } = await supabase
      .from('document_types')
      .select('name, slug')
      .eq('id', documentTypeId)
      .single();

    const slug = docType?.slug || 'doc';

    let fileUrl = formData.get('file_url') as string | null;

    // Upload file if present
    if (file && file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const path = `stores/${storeId}/${slug}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('store-documents')
        .upload(path, file);

      if (uploadError) throw uploadError;
      fileUrl = path;
    }

    // `store_documents.file_url` es NOT NULL, así que un documento no puede
    // existir sin archivo. Antes se omitía el campo cuando no había ninguno y el
    // INSERT reventaba con el error crudo de Postgres ("null value in column
    // file_url..."), justo al hacer algo tan normal como cambiar el estado de un
    // documento que todavía no se ha subido.
    if (!fileUrl) {
      const docName = docType?.name ? `«${docType.name}»` : 'este documento';
      return NextResponse.json(
        { error: `Primero debes subir el archivo de ${docName} para poder cambiar su estado.` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('store_documents')
      .upsert(
        {
          store_id: storeId,
          document_type_id: documentTypeId,
          status,
          file_url: fileUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id,document_type_id' }
      )
      .select()
      .single();

    if (error) {
      // Nunca se devuelve el mensaje crudo de la base: no le dice nada a quien
      // administra y expone nombres de columnas.
      console.error('Error guardando documento de tienda:', error.message);
      return NextResponse.json(
        { error: 'No se pudo guardar el documento. Verifica el archivo e inténtalo de nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
