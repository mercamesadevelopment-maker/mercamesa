import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPqrs } from '@/lib/pqrs/create';
import { addPqrsMessage } from '@/lib/pqrs/actions';
import { getPqrsReason } from '@/lib/pqrs/reasons';
import { loadOrderContext } from '@/lib/pqrs/order-context';
import { loadPqrsSettings } from '@/lib/pqrs/settings';
import { MAX_DESCRIPTION, MAX_PHOTOS } from '@/lib/pqrs/rules';
import { PqrsInputError } from '@/lib/pqrs/errors';
import type { PqrsActor } from '@/lib/pqrs/actor';
import { asBuyer, failure } from '../buyer';
import { fail, ok, type ToolResult } from '../result';
import { caseIdByCode, isRepeatedCaseMessage, loadParts, matchItems, pickPart, reasonsCatalog, whoHandles } from '../cases';
import { ChatPhotoError, importChatPhotos } from '../media';
import type { McpUser } from '../identity';
import { telefono } from './schemas';

export const claveIdempotencia = z
  .string()
  .min(8)
  .max(120)
  .describe('Llave única de esta acción (un UUID). Si reintentas por un fallo de red, manda la MISMA llave: no se duplica.');

const fotos = z
  .array(z.string().url())
  .max(MAX_PHOTOS)
  .optional()
  .describe(`URLs https de las fotos que mandó la persona, del almacenamiento de medios de Meteor. Hasta ${MAX_PHOTOS}.`);

/** Por el chat, la persona es comprador o el equipo de sus tiendas; nunca administrador. */
function actorOf(user: McpUser): PqrsActor {
  return { userId: user.userId, isAdmin: false, storeIds: user.stores.map((s) => s.id) };
}

/** Los errores esperables de un caso se dicen con su mensaje; los demás, como fallo. */
function caseFailure(error: unknown): ToolResult {
  if (error instanceof ChatPhotoError) return fail('DATOS_INVALIDOS', error.message);
  if (error instanceof PqrsInputError) {
    if (error.status === 404) return fail('NO_EXISTE', error.message);
    if (error.status === 403) return fail('NO_PERMITIDO', error.message);
    return fail('DATOS_INVALIDOS', error.message);
  }
  return failure(error);
}

async function caseView(service: SupabaseClient<any>, id: string) {
  const { data } = await service.from('pqrs').select('code, status, subject, created_at').eq('id', id).single();
  return data ? { codigo: data.code, estado: data.status, asunto: data.subject, creado: data.created_at } : null;
}

export function registerCasos(server: McpServer) {
  server.registerTool(
    'registrar_caso',
    {
      title: 'Radicar un caso (PQRSF)',
      description:
        'Radica una petición, queja, reclamo, sugerencia o felicitación a nombre de la persona del teléfono y devuelve el radicado, ' +
        'quién lo atiende y en cuánto. Antes de llamarla, confirma con la persona el motivo, el pedido y lo que pasó. ' +
        'Motivos (`motivo`) y lo que pide cada uno: ' +
        reasonsCatalog() +
        '. Un reclamo por productos pide `pedido` (la parte de la tienda, MM-2026-001091-1, o el pedido si tiene una sola tienda), ' +
        '`productos` y, según el motivo, fotos; solo se acepta dentro del plazo desde la entrega.',
      inputSchema: z.object({
        telefono,
        motivo: z.string().min(3).max(60).describe('La llave del motivo, de la lista de arriba.'),
        descripcion: z.string().min(10).max(MAX_DESCRIPTION).describe('Lo que pasó, en palabras de la persona.'),
        pedido: z.string().min(3).max(40).optional().describe('Código del pedido o de la parte de una tienda.'),
        tienda: z
          .string()
          .max(120)
          .optional()
          .describe('Solo el tendero, en un motivo sin pedido: el nombre de su tienda si tiene varias.'),
        productos: z
          .array(z.object({ producto: z.string().min(2).max(120), cantidad: z.number().positive().optional() }))
          .max(30)
          .optional()
          .describe('Los productos del reclamo, por su nombre en el pedido. Sin cantidad, la cantidad completa.'),
        fotos,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asBuyer(args.telefono, async ({ service, user }) => {
        try {
          // Un reintento con la misma llave es el mismo caso.
          const { data: previo } = await service
            .from('pqrs')
            .select('id')
            .eq('opened_by', user.userId)
            .eq('client_idempotency_key', args.clave_idempotencia)
            .maybeSingle();
          if (previo) return ok({ caso: await caseView(service, previo.id), repetido: true });

          const reason = getPqrsReason(args.motivo);
          if (!reason) return fail('DATOS_INVALIDOS', 'Ese motivo no existe. Usa una de las llaves de la lista.');

          const actor = actorOf(user);
          let storeOrderId: string | null = null;
          if (args.pedido) {
            const partes = await loadParts(
              service,
              args.pedido,
              reason.openedBy === 'buyer' ? { buyerId: user.userId } : { storeIds: actor.storeIds }
            );
            const parte = pickPart(args.pedido, partes);
            // `'message' in`: sin `strict`, TypeScript no estrecha por el booleano.
            if ('message' in parte) return fail(partes.length ? 'DATOS_INVALIDOS' : 'NO_EXISTE', parte.message);
            storeOrderId = parte.part.id;
          }

          let items: { orderItemId: string; quantity: number }[] = [];
          if (args.productos?.length) {
            if (!storeOrderId) return fail('DATOS_INVALIDOS', 'Para reclamar productos hay que decir de qué pedido son.');
            const contexto = await loadOrderContext(service, storeOrderId);
            const match = matchItems(contexto?.items ?? [], args.productos);
            if ('message' in match) return fail('DATOS_INVALIDOS', match.message);
            items = match.items;
          }

          let storeId: string | null = null;
          if (reason.openedBy === 'seller' && !storeOrderId) {
            const buscada = args.tienda?.trim().toLowerCase();
            const tiendas = buscada ? user.stores.filter((s) => s.name.toLowerCase().includes(buscada)) : user.stores;
            if (tiendas.length !== 1) {
              return fail(
                'DATOS_INVALIDOS',
                tiendas.length === 0
                  ? 'No encontramos esa tienda entre las de la persona.'
                  : `Di de cuál tienda es el caso: ${tiendas.map((t) => t.name).join(', ')}.`
              );
            }
            storeId = tiendas[0].id;
          }

          const attachments = await importChatPhotos(service, user.userId, args.fotos ?? []);
          const creado = await createPqrs(service, actor, {
            reason: reason.key,
            description: args.descripcion,
            storeOrderId,
            storeId,
            items,
            attachments,
            clientIdempotencyKey: args.clave_idempotencia,
          });

          const settings = await loadPqrsSettings(service);
          return ok({
            caso: await caseView(service, creado.id),
            motivo: reason.label,
            quien_atiende: whoHandles(reason, Boolean(storeOrderId || storeId), settings.storeResponseHours),
            repetido: false,
          });
        } catch (error) {
          return caseFailure(error);
        }
      })
  );

  server.registerTool(
    'agregar_a_caso',
    {
      title: 'Agregar a un caso',
      description:
        'Suma un mensaje, y si hay fotos, al caso abierto de la persona del teléfono (comprador que lo abrió o equipo de la tienda). ' +
        'Un caso resuelto no recibe más: si el problema sigue, se radica uno nuevo.',
      inputSchema: z.object({
        telefono,
        codigo: z.string().min(3).max(40).describe('Código del caso, por ejemplo PQR-2026-000019.'),
        mensaje: z.string().min(2).max(MAX_DESCRIPTION),
        fotos,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asBuyer(args.telefono, async ({ service, user }) => {
        try {
          const id = await caseIdByCode(service, args.codigo);
          if (await isRepeatedCaseMessage(service, { caseId: id, authorId: user.userId, key: args.clave_idempotencia })) {
            return ok({ caso: await caseView(service, id), agregado: true, repetido: true });
          }

          const attachments = await importChatPhotos(service, user.userId, args.fotos ?? []);
          await addPqrsMessage(service, actorOf(user), id, {
            body: args.mensaje,
            attachments,
            clientIdempotencyKey: args.clave_idempotencia,
          });
          return ok({ caso: await caseView(service, id), agregado: true, repetido: false });
        } catch (error) {
          return caseFailure(error);
        }
      })
  );
}
