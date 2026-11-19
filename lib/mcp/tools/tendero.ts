import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { loadStoreQueue, STORE_QUEUE_MAX } from '@/lib/orders/store-queue';
import { loadStoreStatement } from '@/lib/payouts/store-statement';
import { asStoreMember } from '../store-member';
import { fail, ok } from '../result';
import { toStatementView, toStoreQueueView } from '../views';
import { telefono } from './schemas';

export const tienda = z
  .string()
  .max(120)
  .optional()
  .describe('El nombre de la tienda, solo si la persona tiene varias. Con una, no hace falta.');

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD');

const hoyEnBogota = () => new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
const haceDias = (dias: number) => new Date(Date.now() - 5 * 60 * 60 * 1000 - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function registerTendero(server: McpServer) {
  server.registerTool(
    'pedidos_del_tendero',
    {
      title: 'Pedidos de la tienda',
      description:
        'Las partes de pedido de la tienda de la persona del teléfono, lo más urgente primero: las que hay que preparar, las que se ' +
        'están empacando, las listas para recoger y las que van en camino. Solo pedidos pagados. De cada una: productos de su tienda, ' +
        'notas del comprador y de empaque, si es refrigerado, si va junto con otras tiendas, el estado del domicilio y `siguiente` ' +
        '(el paso que sigue, para cambiar_estado_subpedido). Del comprador solo el primer nombre y el barrio. Nunca trae códigos.',
      inputSchema: z.object({
        telefono,
        tienda,
        incluir_cerrados: z.boolean().optional().describe('También las entregadas, canceladas y devueltas más recientes.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, tienda: nombre, incluir_cerrados }) =>
      asStoreMember(phone, nombre, async ({ service, store }) => {
        const r = await loadStoreQueue(service, store.id, { includeClosed: incluir_cerrados });
        return ok({ tienda: store.name, pedidos: r.parts.map(toStoreQueueView), hay_mas: r.truncated, maximo: STORE_QUEUE_MAX });
      })
  );

  server.registerTool(
    'liquidacion_del_tendero',
    {
      title: 'Liquidación de la tienda',
      description:
        'Lo que se le paga a la tienda de la persona del teléfono: lo vendido (pedidos entregados y pagados del periodo), lo pagado en ' +
        'el periodo, el próximo pago (fecha de la siguiente liquidación, valor y descuentos por devoluciones que asume la tienda) y lo ' +
        'retenido con su razón (sin cuenta verificada, sin factura, con un caso abierto o aún en el periodo de espera). ' +
        'A la tienda se le paga el valor de sus productos; MercaMesa cobra lo suyo al comprador. `retenciones` es null: el sistema no las calcula.',
      inputSchema: z.object({
        telefono,
        tienda,
        desde: fecha.optional().describe('AAAA-MM-DD. Por defecto, hace 30 días.'),
        hasta: fecha.optional().describe('AAAA-MM-DD. Por defecto, hoy.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, tienda: nombre, desde, hasta }) =>
      asStoreMember(phone, nombre, async ({ service, store }) => {
        const from = desde ?? haceDias(30);
        const to = hasta ?? hoyEnBogota();
        if (from > to) return fail('DATOS_INVALIDOS', '`desde` no puede ser después de `hasta`.');
        const estado = await loadStoreStatement(service, store.id, { from, to });
        return ok({ tienda: store.name, liquidacion: toStatementView(estado) });
      })
  );
}
