import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getPublicAppUrl } from '@/lib/env';
import { OrderDraftError } from '@/lib/orders/build-order-draft';
import { DeliveryQuoteUnavailableError, DELIVERY_QUOTE_UNAVAILABLE_MESSAGE } from '@/lib/pricing/delivery-quote';
import { placeChatOrder, previewChatOrder } from '@/lib/orders/chat-order';
import { changeStoreOrderStatus, StoreOrderStatusError } from '@/lib/orders/change-store-order-status';
import { checkTransition } from '@/lib/orders/status-transitions';
import { STORE_STATUS_LABELS } from '@/lib/orders/status-labels';
import { cancelStorePart, CancelPartError } from '@/lib/orders/cancel-store-part';
import { MIN_CANCEL_REASON } from '@/lib/orders/cancel-part-rules';
import { isPiboxEnabled, PiboxDataError } from '@/lib/pibox';
import { requestDeliveryForStoreOrder } from '@/lib/pibox/request-delivery';
import { savePriceBatch } from '@/lib/store-products/save-price-batch';
import { validateRow, type PriceBatchRow, type PriceValues } from '@/lib/store-products/price-grid';
import { asBuyer, failure } from '../buyer';
import { asStoreMember } from '../store-member';
import { fail, ok, type ToolResult } from '../result';
import { telefono } from './schemas';
import { claveIdempotencia } from './casos';
import { tienda } from './tendero';

const confirmar = z
  .boolean()
  .optional()
  .describe(
    'Sin él (o en false) no escribe nada: devuelve el resumen para que se lo muestres a la persona. Solo cuando ella diga que sí, ' +
      'vuelve a llamar con true y la misma clave_idempotencia.'
  );

/** «Por WhatsApp», en el historial: así se sabe que el cambio no salió del panel. */
const POR_WHATSAPP = 'Por WhatsApp (Carolina)';

const statusLabel = (s: string) => STORE_STATUS_LABELS[s as keyof typeof STORE_STATUS_LABELS] ?? s;

/** La parte de la tienda por su código. `null` si no existe o es de otra tienda. */
async function storePart(service: SupabaseClient<any>, storeId: string, code: string) {
  const { data, error } = await service
    .from('store_orders')
    .select('id, code, status, store_id, orders ( fulfillment, payment_status )')
    .eq('code', code.trim().toUpperCase())
    .eq('store_id', storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as { id: string; code: string; status: string; orders: { fulfillment: string | null; payment_status: string } | null } | null;
}

function orderFailure(error: unknown): ToolResult {
  if (error instanceof OrderDraftError) return fail('DATOS_INVALIDOS', error.message);
  if (error instanceof DeliveryQuoteUnavailableError) return fail('SIN_COTIZACION', DELIVERY_QUOTE_UNAVAILABLE_MESSAGE);
  return failure(error);
}

/** Un producto en actualizar_precio: por su `id` o su código, y lo que cambia. */
export const cambioDePrecio = z.object({
  id: z.string().uuid().optional().describe('El `id` del producto, de inventario_del_tendero o buscar_productos.'),
  codigo: z.string().min(1).max(50).optional().describe('O el código del producto en su tienda (MM-000123 o el suyo propio).'),
  precio: z.number().positive().optional(),
  precio_mayorista: z.number().positive().nullable().optional().describe('null para quitarlo.'),
  minimo_mayorista: z.number().int().min(1).nullable().optional(),
  stock: z.number().min(0).optional(),
  publicado: z.boolean().optional(),
  })
  .refine((p) => Boolean(p.id) !== Boolean(p.codigo), 'Cada producto lleva `id` o `codigo`, uno de los dos.');

export function registerEscritura(server: McpServer) {
  // ---------------------------------------------------------------- comprador
  server.registerTool(
    'crear_orden',
    {
      title: 'Crear un pedido',
      description:
        'Arma un pedido del comprador del teléfono con productos de buscar_productos (`id`) y una de sus direcciones (`direccion_id` de ' +
        'listar_direcciones). Primero llámala sin `confirmar`: devuelve el resumen (productos con su precio, productos de terceros, ' +
        'domicilio y total) sin crear nada. Muéstraselo y, solo si dice que sí, llama de nuevo con `confirmar: true` y la misma ' +
        '`clave_idempotencia`. El pedido queda pendiente de pago y se paga en MercaMesa con el botón «Pagar» de Mis órdenes (`enlace_pago`); ' +
        'tú nunca cobras. Si usa su saldo a favor y alcanza, queda pagado. Aplican las reglas de reglas_de_compra.',
      inputSchema: z.object({
        telefono,
        productos: z
          .array(z.object({ id: z.string().uuid(), cantidad: z.number().positive().max(10000) }))
          .min(1)
          .max(60)
          .describe('Cada producto por su `id` de buscar_productos y la cantidad, en su unidad.'),
        direccion_id: z.string().uuid(),
        notas: z.string().max(500).optional(),
        usar_saldo: z.boolean().optional().describe('Usar el saldo a favor del comprador.'),
        confirmar,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asBuyer(args.telefono, async ({ service, user }) => {
        try {
          const input = {
            buyerId: user.userId,
            items: args.productos.map((p) => ({ storeProductId: p.id, quantity: p.cantidad })),
            addressId: args.direccion_id,
            notes: args.notas ?? null,
            useCredit: args.usar_saldo,
          };

          if (!args.confirmar) {
            const v = await previewChatOrder(service, input);
            return ok({
              confirmado: false,
              resumen: {
                tiendas: v.draft.storeParts.map((s) => ({ tienda: s.storeName, valor: s.subtotal })),
                productos: v.draft.items.map((i) => ({
                  nombre: i.catalog_name,
                  cantidad: i.quantity,
                  unidad: i.unit_name,
                  precio: i.unit_price,
                  total: i.total_price,
                })),
                ahorro_en_ofertas: v.pricing.discountTotal,
                productos_de_terceros: v.concepts.thirdPartyProducts,
                domicilio: v.concepts.delivery,
                total: v.pricing.total,
                saldo_a_favor_disponible: v.credit,
              },
            });
          }

          const r = await placeChatOrder(service, { ...input, key: args.clave_idempotencia });
          if ('message' in r) return fail(r.status === 403 ? 'NO_PERMITIDO' : 'DATOS_INVALIDOS', r.message);
          const pagado = r.order.payment_status === 'approved';
          return ok({
            confirmado: true,
            repetido: r.repeated,
            pedido: {
              codigo: r.order.code,
              total: r.order.total,
              saldo_a_favor_usado: r.order.credit_applied,
              pago: r.order.payment_status,
            },
            enlace_pago: pagado ? null : `${getPublicAppUrl()}/orders`,
            que_sigue: pagado
              ? 'El saldo a favor cubrió todo: el pedido quedó pagado y las tiendas lo empiezan a preparar.'
              : 'El pedido quedó pendiente de pago. El comprador lo paga en MercaMesa, en Mis órdenes, con el botón «Pagar», antes de que venza.',
          });
        } catch (error) {
          return orderFailure(error);
        }
      })
  );

  // ---------------------------------------------------------------- tendero
  server.registerTool(
    'modificar_orden',
    {
      title: 'Cancelar la parte de una tienda',
      description:
        'Lo único que hoy se puede cambiar de un pedido ya hecho: que la tienda de la persona del teléfono cancele SU parte de un pedido ' +
        'de varias tiendas porque no puede cumplir (`accion: cancelar_parte`). El resto del pedido sigue y al comprador se le abona como ' +
        'saldo a favor lo que pagó por esa parte. El comprador no puede cambiar ni cancelar un pedido por aquí: si ya pagó, se radica un ' +
        'caso (registrar_caso); si no ha pagado, el pedido vence solo y no se le cobra. Primero sin `confirmar`, para ver qué pasa; luego ' +
        'con `confirmar: true`.',
      inputSchema: z.object({
        telefono,
        tienda,
        accion: z.enum(['cancelar_parte']),
        parte: z.string().min(3).max(40).describe('Código de la parte de su tienda (MM-2026-001091-2).'),
        motivo: z.string().min(MIN_CANCEL_REASON).max(500).describe('Por qué no puede cumplir; lo lee el comprador.'),
        confirmar,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asBuyer(args.telefono, async ({ user }) => {
        if (user.stores.length === 0) {
          return fail(
            'NO_PERMITIDO',
            'El comprador no puede cambiar ni cancelar un pedido por el chat. Si ya lo pagó, radica un caso con registrar_caso; si no lo ha pagado, vence solo y no se le cobra.'
          );
        }
        return asStoreMember(args.telefono, args.tienda, async ({ service, store }) => {
          try {
            const parte = await storePart(service, store.id, args.parte);
            if (!parte) return fail('NO_EXISTE', 'Esa parte no es de esta tienda.');
            if (!args.confirmar) {
              return ok({
                confirmado: false,
                resumen: {
                  parte: parte.code,
                  estado_actual: statusLabel(parte.status),
                  que_pasa:
                    'La parte queda cancelada, el resto del pedido sigue, y al comprador se le abona como saldo a favor lo que pagó por ella. Esta parte no se le paga a la tienda.',
                },
              });
            }
            const r = await cancelStorePart(service, { storeOrderId: parte.id, actorId: user.userId, reason: `${args.motivo} (${POR_WHATSAPP})` });
            return ok({ confirmado: true, parte: parte.code, abonado_al_comprador: r.refunded, pedido_cancelado_completo: r.orderCancelled });
          } catch (error) {
            if (error instanceof CancelPartError) return fail(error.status === 404 ? 'NO_EXISTE' : 'NO_PERMITIDO', error.message);
            return failure(error);
          }
        });
      })
  );

  server.registerTool(
    'cambiar_estado_subpedido',
    {
      title: 'Avanzar el estado de una parte',
      description:
        'Avanza la parte de la tienda de la persona al paso siguiente, como el botón del panel: Confirmado → Empacando → Listo Recogida → ' +
        'En Camino → Entregado (el `siguiente` de pedidos_del_tendero). Solo hacia adelante y un paso a la vez. Al quedar «Listo Recogida» se ' +
        'pide el mensajero, igual que en el panel; en un pedido de varias tiendas lo recoge el patinador o lo lleva la tienda a la bahía, ' +
        'y el paso siguiente no lo da la tienda. Primero sin `confirmar`; luego con `confirmar: true`. Repetirlo no cambia nada dos veces.',
      inputSchema: z.object({
        telefono,
        tienda,
        parte: z.string().min(3).max(40).describe('Código de la parte de su tienda (MM-2026-001091-1).'),
        estado: z
          .enum(['confirmed', 'packing', 'at_collection', 'dispatched', 'delivered'])
          .describe('El estado al que pasa: el `siguiente.estado` de pedidos_del_tendero.'),
        notas: z.string().max(500).optional(),
        confirmar,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asStoreMember(args.telefono, args.tienda, async ({ service, user, store }) => {
        try {
          const parte = await storePart(service, store.id, args.parte);
          if (!parte) return fail('NO_EXISTE', 'Esa parte no es de esta tienda.');
          if (parte.orders?.payment_status !== 'approved') {
            return fail('NO_PERMITIDO', 'Ese pedido no está pagado: todavía no es trabajo de la tienda.');
          }
          // Como en el panel: en un pedido de varias tiendas, lo que sigue a «Listo Recogida» no lo hace la tienda.
          if (parte.orders?.fulfillment === 'consolidated' && parte.status === 'at_collection' && args.estado !== 'at_collection') {
            return fail('NO_PERMITIDO', 'Este pedido sale con otras tiendas: lo recoge el patinador o se entrega en la bahía de la plaza.');
          }
          const paso = checkTransition(parte.status, args.estado);
          if (paso.kind === 'invalid') return fail('NO_PERMITIDO', `${paso.reason} Ahora está en «${statusLabel(parte.status)}».`);

          if (!args.confirmar) {
            return ok({
              confirmado: false,
              resumen: {
                parte: parte.code,
                de: statusLabel(parte.status),
                a: statusLabel(args.estado),
                ya_estaba: paso.kind === 'same',
                pide_mensajero: args.estado === 'at_collection' && parte.orders?.fulfillment !== 'consolidated',
              },
            });
          }

          const nota = args.notas ? `${args.notas} (${POR_WHATSAPP})` : POR_WHATSAPP;
          await changeStoreOrderStatus(service, { storeOrderId: parte.id, target: args.estado, notes: nota, actorId: user.userId });

          let domicilio: string | null = null;
          if (args.estado === 'at_collection' && isPiboxEnabled()) {
            try {
              const r = await requestDeliveryForStoreOrder(service, parte.id, user.userId);
              domicilio =
                r.kind === 'consolidated'
                  ? r.error ?? (r.requested ? 'Se pidió el mensajero del pedido completo.' : 'Lo recoge el equipo de la plaza; no hay que hacer nada más.')
                  : r.kind === 'existing'
                    ? 'Ya había un mensajero pedido para esta parte.'
                    : 'Se pidió el mensajero.';
            } catch (error) {
              domicilio = `No se pudo pedir el mensajero: ${error instanceof PiboxDataError || error instanceof Error ? error.message : 'error desconocido'}. Que lo pida desde el panel.`;
              // Queda en el historial, como cuando falla desde el panel.
              await changeStoreOrderStatus(service, {
                storeOrderId: parte.id,
                target: 'at_collection',
                notes: `No se pudo solicitar el domicilio: ${domicilio}`,
                actorId: user.userId,
              }).catch(() => undefined);
            }
          }
          return ok({ confirmado: true, parte: parte.code, estado: args.estado, estado_texto: statusLabel(args.estado), domicilio });
        } catch (error) {
          if (error instanceof StoreOrderStatusError) return fail('NO_PERMITIDO', error.message);
          return failure(error);
        }
      })
  );

  server.registerTool(
    'actualizar_precio',
    {
      title: 'Actualizar precios y existencias',
      description:
        'Cambia, en productos de la tienda de la persona, por su `id` o su `codigo` (de inventario_del_tendero): precio, precio mayorista, mínimo mayorista, stock y si está ' +
        'publicado. Las mismas reglas de la tabla del panel (un producto no se publica sin precio; el mayorista no supera al precio). ' +
        'Cada cambio de stock queda en la bitácora como ajuste por WhatsApp. Hasta 50 productos. Primero sin `confirmar`: devuelve ' +
        'antes y después de cada uno, o el error de cada producto; luego con `confirmar: true`.',
      inputSchema: z.object({
        telefono,
        tienda,
        productos: z.array(cambioDePrecio).min(1).max(50),
        confirmar,
        clave_idempotencia: claveIdempotencia,
      }),
    },
    async (args) =>
      asStoreMember(args.telefono, args.tienda, async ({ service, user, store }) => {
        try {
          // Solo productos de su tienda: un `id` o un código de otra no aparece.
          const ids = args.productos.flatMap((p) => (p.id ? [p.id] : []));
          const codigos = args.productos.flatMap((p) => (p.codigo ? [p.codigo.trim().toUpperCase()] : []));
          const columnas = 'id, code, price_per_unit, wholesale_price, wholesale_min_qty, stock, is_active, unit_id, catalog_products ( name )';
          const [porIdQ, porCodigoQ] = await Promise.all([
            ids.length ? service.from('store_products').select(columnas).eq('store_id', store.id).in('id', ids) : { data: [], error: null },
            codigos.length
              ? service.from('store_products').select(columnas).eq('store_id', store.id).in('code', codigos)
              : { data: [], error: null },
          ]);
          if (porIdQ.error || porCodigoQ.error) throw new Error((porIdQ.error ?? porCodigoQ.error)!.message);
          const encontrados = matchProductRefs(args.productos, [...(porIdQ.data ?? []), ...(porCodigoQ.data ?? [])] as any[]);
          if ('message' in encontrados) return fail(encontrados.code, encontrados.message);

          const filas: PriceBatchRow[] = [];
          const vista: Record<string, unknown>[] = [];
          const errores: Record<string, string> = {};
          for (const [i, p] of args.productos.entries()) {
            const actual = encontrados.rows[i];
            const antes: PriceValues = {
              unitId: actual.unit_id ?? null,
              price: Number(actual.price_per_unit),
              wsPrice: actual.wholesale_price === null ? null : Number(actual.wholesale_price),
              wsMin: actual.wholesale_min_qty === null ? null : Number(actual.wholesale_min_qty),
              stock: Number(actual.stock ?? 0),
              isActive: Boolean(actual.is_active),
            };
            const fila: PriceBatchRow = { id: actual.id };
            if (p.precio !== undefined) fila.price_per_unit = p.precio;
            if (p.precio_mayorista !== undefined) fila.wholesale_price = p.precio_mayorista;
            if (p.minimo_mayorista !== undefined) fila.wholesale_min_qty = p.minimo_mayorista;
            if (p.stock !== undefined) fila.stock = p.stock;
            if (p.publicado !== undefined) fila.is_active = p.publicado;
            const e = validateRow(fila, antes);
            if (Object.keys(e).length > 0) errores[actual.code ?? actual.id] = Object.values(e).join(' ');
            filas.push(fila);
            vista.push({
              id: actual.id,
              codigo: actual.code,
              producto: actual.catalog_products?.name ?? null,
              antes: { precio: antes.price, precio_mayorista: antes.wsPrice, minimo_mayorista: antes.wsMin, stock: antes.stock, publicado: antes.isActive },
              despues: {
                precio: fila.price_per_unit ?? antes.price,
                precio_mayorista: fila.wholesale_price !== undefined ? fila.wholesale_price : antes.wsPrice,
                minimo_mayorista: fila.wholesale_min_qty !== undefined ? fila.wholesale_min_qty : antes.wsMin,
                stock: fila.stock ?? antes.stock,
                publicado: fila.is_active ?? antes.isActive,
              },
            });
          }
          if (Object.keys(errores).length > 0) {
            return fail('DATOS_INVALIDOS', Object.entries(errores).map(([c, m]) => `${c}: ${m}`).join(' | '));
          }
          if (!args.confirmar) return ok({ confirmado: false, resumen: { tienda: store.name, productos: vista } });

          const r = await savePriceBatch(service as any, user.userId, filas, 'whatsapp');
          if (r.status === 'forbidden') return fail('NO_PERMITIDO', r.message);
          if (r.status === 'invalid') return fail('DATOS_INVALIDOS', 'Algún producto no cumple las reglas; vuelve a revisar sin confirmar.');
          const fallidos = Object.keys(r.errors);
          return ok({ confirmado: true, guardados: r.saved.length, con_error: fallidos.length, productos: vista });
        } catch (error) {
          return failure(error);
        }
      })
  );
}

/**
 * Cada producto pedido, con su fila de la base (en el mismo orden), o por qué
 * no. Las filas ya vienen filtradas por la tienda: lo que no esté es de otra o
 * no existe. Un producto nombrado dos veces (por `id` y por código, por ejemplo)
 * no pasa: el lote guardaría dos cambios encima del mismo.
 */
export function matchProductRefs<R extends { id: string; code: string | null }>(
  refs: { id?: string; codigo?: string }[],
  rows: R[]
): { ok: true; rows: R[] } | { ok: false; code: 'NO_EXISTE' | 'DATOS_INVALIDOS'; message: string } {
  const porId = new Map(rows.map((r) => [r.id, r]));
  const porCodigo = new Map(rows.filter((r) => r.code).map((r) => [String(r.code).toUpperCase(), r]));
  const faltan: string[] = [];
  const hallados: R[] = [];
  for (const ref of refs) {
    const fila = ref.id ? porId.get(ref.id) : porCodigo.get(String(ref.codigo).trim().toUpperCase());
    if (!fila) faltan.push(ref.id ?? String(ref.codigo));
    else hallados.push(fila);
  }
  if (faltan.length > 0) {
    return { ok: false, code: 'NO_EXISTE', message: `Estos productos no son de la tienda: ${faltan.join(', ')}.` };
  }
  const repetidos = hallados.filter((f, i) => hallados.findIndex((g) => g.id === f.id) !== i);
  if (repetidos.length > 0) {
    return {
      ok: false,
      code: 'DATOS_INVALIDOS',
      message: `Un producto viene dos veces: ${[...new Set(repetidos.map((r) => r.code ?? r.id))].join(', ')}. Junta sus cambios en uno.`,
    };
  }
  return { ok: true, rows: hallados };
}
