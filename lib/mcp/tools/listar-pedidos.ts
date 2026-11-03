import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { BUYER_ORDERS_MAX_PAGE_SIZE, listBuyerOrders } from '@/lib/orders/buyer-orders';
import { asBuyer } from '../buyer';
import { ok } from '../result';
import { toOrderSummaryView } from '../views';
import { pagina, telefono } from './schemas';

export function registerListarPedidos(server: McpServer) {
  server.registerTool(
    'listar_pedidos',
    {
      title: 'Listar pedidos',
      description:
        'Los pedidos del comprador del teléfono, del más reciente al más antiguo. Cada pedido trae una parte por tienda, ' +
        'cada una con su propio estado. Para el detalle de uno, usa detalle_pedido con su código.',
      inputSchema: z.object({
        telefono,
        pagina,
        por_pagina: z
          .number()
          .int()
          .min(1)
          .max(BUYER_ORDERS_MAX_PAGE_SIZE)
          .optional()
          .describe(`Pedidos por página, máximo ${BUYER_ORDERS_MAX_PAGE_SIZE}. Por defecto, 5.`),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, pagina: page, por_pagina }) =>
      asBuyer(phone, async ({ service, user }) => {
        const r = await listBuyerOrders(service, user.userId, { page, pageSize: por_pagina });
        return ok({
          pedidos: r.orders.map(toOrderSummaryView),
          total: r.total,
          pagina: r.page,
          por_pagina: r.pageSize,
        });
      })
  );
}
