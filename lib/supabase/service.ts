import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database_generated';

// Solo usar en Server Actions/Route Handlers confiables
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false }
  });
}