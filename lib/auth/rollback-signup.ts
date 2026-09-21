import { createSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * Borra el usuario de Auth creado en esta misma petición, cuando lo que venía
 * después (crear el perfil) falló.
 *
 * Existe porque el registro son dos pasos que no comparten transacción:
 * `auth.signUp` crea la cuenta y luego se inserta en `profiles`. Si el segundo
 * falla, quedaba un usuario en `auth.users` sin perfil — y con él, un correo
 * bloqueado para siempre: cada reintento responde "ya registrado" aunque la
 * cuenta nunca llegó a existir de verdad. En la base hay un caso así de junio.
 *
 * Solo debe llamarse con el id que acaba de devolver `signUp`, nunca con el de
 * un usuario preexistente.
 *
 * No lanza: si el borrado falla no hay nada más que hacer, y el llamador debe
 * poder responder igual con el error original, que es el informativo.
 */
export async function rollbackSignUp(userId: string, contexto: string): Promise<void> {
  try {
    const service = createSupabaseServiceClient();
    const { error } = await service.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`[auth] ${contexto}: no se pudo deshacer el signUp de ${userId}`, error);
    }
  } catch (err) {
    console.error(`[auth] ${contexto}: no se pudo deshacer el signUp de ${userId}`, err);
  }
}
