import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database_generated';
import { getPublicSupabaseUrl, getPublicSupabaseAnonKey } from '@/lib/env';

/**
 * Cliente con la clave pública que **no deja rastro de sesión**: ni cookies, ni
 * almacenamiento, ni refresco automático.
 *
 * Existe para poder comprobar una contraseña sin que eso deje a la persona
 * dentro. El cliente de `server.ts` guarda la sesión en cookies apenas
 * `signInWithPassword` responde bien, así que con él no hay forma de exigir un
 * segundo paso: cuando se le fuera a pedir el código, ya habría entrado.
 *
 * No sirve para leer datos protegidos por RLS en nombre de nadie: no tiene
 * sesión. Es exactamente para eso.
 */
export function createSupabaseStatelessClient() {
  return createClient<Database>(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
