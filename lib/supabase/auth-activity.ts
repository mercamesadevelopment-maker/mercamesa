import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthActivity = {
  lastSignInAt: string | null;
  emailVerifiedAt: string | null;
};

/**
 * Último ingreso y verificación del correo, leídos de `auth.users`.
 *
 * **No se copian a `profiles`.** Supabase ya los mantiene; duplicarlos en una
 * columna propia sería garantizar que algún día digan cosas distintas, y la
 * fecha equivocada en una pantalla de auditoría es peor que no tener la fecha.
 *
 * El esquema `auth` no está expuesto por PostgREST, así que la única vía es la
 * API de administración.
 */
export async function fetchAuthActivity(
  service: SupabaseClient<any>,
  pageSize = 50
): Promise<Map<string, AuthActivity>> {
  const actividad = new Map<string, AuthActivity>();

  // `listUsers` pagina: pedir "todos" devuelve solo la primera página y el resto
  // aparecería sin fecha, como si nunca hubieran entrado. Se recorre hasta que
  // llegue una página incompleta, que es la última.
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: pageSize });

    if (error) {
      console.error('[auth-activity] no se pudo leer auth.users', error.message);
      break;
    }

    const usuarios = data?.users ?? [];

    for (const u of usuarios) {
      actividad.set(u.id, {
        lastSignInAt: u.last_sign_in_at ?? null,
        emailVerifiedAt: u.email_confirmed_at ?? null,
      });
    }

    if (usuarios.length < pageSize) break;
  }

  return actividad;
}
