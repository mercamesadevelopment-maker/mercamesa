import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

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
      return NextResponse.json({ error: 'Missing document_type_id' }, { status: 400 });
    }

    // Get document type slug for naming
    const { data: docType } = await supabase
      .from('document_types')
      .select('slug')
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

    // Prepare data for upsert
    const upsertData: any = {
      store_id: storeId,
      document_type_id: documentTypeId,
      status,
      updated_at: new Date().toISOString(),
    };

    if (fileUrl) {
      upsertData.file_url = fileUrl;
    }

    const { data, error } = await supabase
      .from('store_documents')
      .upsert(upsertData, { onConflict: 'store_id,document_type_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
