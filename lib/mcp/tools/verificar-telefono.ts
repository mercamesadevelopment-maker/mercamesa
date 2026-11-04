import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { toE164 } from '@/lib/phone/phone';
import { verifyPhoneCode } from '@/lib/phone/verification';
import { failure } from '../buyer';
import { fail, ok } from '../result';
import { telefono } from './schemas';

/**
 * El usuario manda por WhatsApp el código que le dio la app; Carolina lo pasa
 * acá con el número desde el que llegó. No usa `asBuyer`: es justamente lo que
 * vuelve identificable a un teléfono que todavía no lo es.
 */
export function registerVerificarTelefono(server: McpServer) {
  server.registerTool(
    'verificar_telefono',
    {
      title: 'Verificar teléfono',
      description:
        'Verifica el teléfono de quien escribe con el código de 6 dígitos que le dio la app de MercaMesa ' +
        '(«Mi código es 123456»). Úsala cuando la persona mande ese código, o cuando otra herramienta responda NO_VERIFICADO ' +
        'y la persona ya tenga el código. El teléfono es SIEMPRE el número desde el que escribe, nunca uno que la persona dicte. ' +
        'Si responde CODIGO_INVALIDO, pídele que genere uno nuevo desde su perfil.',
      inputSchema: z.object({
        telefono,
        codigo: z.string().min(6).max(20).describe('El código de 6 dígitos que la persona envió.'),
      }),
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async ({ telefono: phone, codigo }) => {
      if (!toE164(phone)) return fail('TELEFONO_INVALIDO', 'El teléfono no es válido.');
      try {
        const service = createSupabaseServiceClient() as unknown as SupabaseClient<any>;
        const resultado = await verifyPhoneCode(service, { phone, code: codigo });
        if (!resultado.ok) {
          return fail(
            'CODIGO_INVALIDO',
            'El código no es válido, ya se usó o venció, o se pidió para otro número. La persona debe generar uno nuevo desde su perfil.'
          );
        }
        return ok({ verificado: true, nombre: resultado.fullName });
      } catch (error: unknown) {
        return failure(error);
      }
    }
  );
}
