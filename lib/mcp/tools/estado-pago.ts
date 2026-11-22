import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getBuyerPaymentStatus } from '@/lib/orders/buyer-payment';
import { asBuyer } from '../buyer';
import { fail, ok } from '../result';
import { toPaymentStatusView } from '../views';
import { telefono } from './schemas';

export function registerEstadoPago(server: McpServer) {
  server.registerTool(
    'estado_pago',
    {
      title: 'Estado del pago',
      description:
        'El pago de un pedido del comprador del teléfono: si está pendiente, en proceso, aprobado o rechazado, qué hacer en cada caso ' +
        '(`que_hacer`) y las devoluciones de ese pedido, por un caso de PQRSF o porque una tienda canceló su parte: cuánto, cómo ' +
        '(saldo a favor o dinero) y en qué van. No trae datos financieros (tarjeta, banco ni referencias).',
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
        const pago = await getBuyerPaymentStatus(service, user.userId, codigo);
        // Un pedido ajeno se responde igual que uno que no existe.
        if (!pago) return fail('NO_EXISTE', 'No hay un pedido con ese código para este comprador.');
        return ok({ pago: toPaymentStatusView(pago) });
      })
  );
}
