import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getBuyerOrder } from '@/lib/orders/buyer-orders';
import { asBuyer } from '../buyer';
import { fail, ok } from '../result';
import { toOrderDetailView } from '../views';
import { telefono } from './schemas';

export function registerDetallePedido(server: McpServer) {
  server.registerTool(
    'detalle_pedido',
    {
      title: 'Detalle de un pedido',
      description:
        'Un pedido del comprador del teléfono: valores, dirección y, por cada tienda, sus productos, el historial de estados ' +
        'y el domicilio (estado, conductor, placa y enlace de seguimiento). Nunca trae los códigos de entrega.',
      inputSchema: z.object({
        telefono,
        codigo: z
          .string()
          .min(3)
          .max(40)
          .describe('Código del pedido (MM-2026-001091) o de una de sus partes (MM-2026-001091-1).'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, codigo }) =>
      asBuyer(phone, async ({ service, user }) => {
        const order = await getBuyerOrder(service, user.userId, codigo);
        // Un pedido ajeno se responde igual que uno que no existe.
        if (!order) return fail('NO_EXISTE', 'No hay un pedido con ese código para este comprador.');
        return ok({ pedido: toOrderDetailView(order) });
      })
  );
}
