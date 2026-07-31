import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database_generated';

// Solo usar en Server Actions/Route Handlers confiables
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
    global: {
      // Evita que el `fetch` parcheado de Next.js (Data Cache) intercepte
      // las respuestas binarias (ej. descargas de Storage) — puede
      // corromperlas al pasar por una re-serialización con pérdida.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}