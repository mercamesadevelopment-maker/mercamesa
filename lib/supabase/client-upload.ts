import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export async function uploadImageDirect(bucket: string, path: string, file: File): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: true,
  });
  if (error) throw error;
}
