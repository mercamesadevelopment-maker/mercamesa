import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeDocumentNumber } from '@/lib/identification/validate-document';
import { toE164 } from '@/lib/phone/phone';

/**
 * Documento o celular que ya pertenecen a otra cuenta.
 *
 * Lo comprueban las dos mitades del registro: `request-signup-code`, antes de
 * mandar el código, para que la persona se entere en el formulario y no después
 * de confirmar el correo; y `register-buyer`, que es la que decide, porque a la
 * primera se le puede llamar a mano sin estos datos.
 *
 * El correo NO se revisa acá: decir si un correo existe convertiría el registro
 * en una forma de averiguar quién está registrado (ver `request-signup-code`).
 * El documento y el celular sí se dicen, y por eso la ruta que los consulta
 * cuenta cada intento contra el límite por IP.
 */
export type SignupConflict = {
  code: 'document_in_use' | 'phone_in_use';
  message: string;
};

export async function findSignupConflict(
  service: SupabaseClient<any>,
  { documentNumber, phone }: { documentNumber?: string | null; phone?: string | null }
): Promise<SignupConflict | null> {
  const documento = normalizeDocumentNumber(documentNumber);
  if (documento && (await existeEnPerfiles(service, 'document_number', documento))) {
    return {
      code: 'document_in_use',
      message:
        'Ya hay una cuenta registrada con ese número de identificación. Si es tuya, inicia sesión o recupera tu contraseña.',
    };
  }

  // Los celulares se guardan en E.164; se compara en ese mismo formato.
  const celular = phone ? toE164(String(phone)) : null;
  if (celular && (await existeEnPerfiles(service, 'phone', celular))) {
    return {
      code: 'phone_in_use',
      message:
        'Ya hay una cuenta registrada con ese número de celular. Si es tuya, inicia sesión o recupera tu contraseña.',
    };
  }

  return null;
}

/**
 * `limit(1)` y no `maybeSingle()`: con dos perfiles que ya comparten el dato
 * —los hay—, `maybeSingle` falla, y como antes no se miraba el error, la
 * comprobación dejaba pasar justo los datos que ya estaban repetidos.
 *
 * Un fallo de la consulta se lanza: registrar un duplicado porque la base no
 * respondió es peor que pedir que se intente de nuevo.
 */
async function existeEnPerfiles(
  service: SupabaseClient<any>,
  column: 'document_number' | 'phone',
  value: string
): Promise<boolean> {
  const { data, error } = await service.from('profiles').select('id').eq(column, value).limit(1);

  if (error) {
    console.error(`[auth] signup-conflicts: no se pudo revisar ${column}`, error);
    throw new Error('No pudimos verificar tus datos. Intenta de nuevo.');
  }

  return (data ?? []).length > 0;
}
