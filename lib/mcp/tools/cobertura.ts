import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { listBuyerAddresses, loadCoverage } from '@/lib/orders/coverage';
import { DELIVERY_QUOTE_UNAVAILABLE_MESSAGE } from '@/lib/pricing/delivery-quote';
import { asBuyer } from '../buyer';
import { fail, ok } from '../result';
import { toAddressView, toCoverageView } from '../views';
import { telefono } from './schemas';

export function registerCobertura(server: McpServer) {
  server.registerTool(
    'listar_direcciones',
    {
      title: 'Direcciones del comprador',
      description:
        'Las direcciones de entrega guardadas del comprador del teléfono, la predeterminada primero. Su `id` es el que piden ' +
        'consultar_cobertura y crear_orden. Si no tiene ninguna, debe agregarla en su perfil de MercaMesa.',
      inputSchema: z.object({ telefono }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone }) =>
      asBuyer(phone, async ({ service, user }) => {
        const direcciones = await listBuyerAddresses(service, user.userId);
        return ok({ direcciones: direcciones.map(toAddressView) });
      })
  );

  server.registerTool(
    'consultar_cobertura',
    {
      title: 'Cobertura de una dirección',
      description:
        'Qué le puede llegar al comprador a una de sus direcciones (`direccion_id` de listar_direcciones): por cada plaza o tienda con ' +
        'dirección propia, sus tiendas con si están abiertas ahora y su horario, y el costo del domicilio hasta esa dirección. ' +
        'Un punto con `domicilio: null` no se pudo cotizar en este momento. El costo depende del valor del pedido (`valor`); ' +
        'sin él se cotiza con el mínimo de compra. Si no se pudo cotizar ninguno, responde SIN_COTIZACION.',
      inputSchema: z.object({
        telefono,
        direccion_id: z.string().uuid().describe('El `id` de una dirección de listar_direcciones.'),
        valor: z.number().positive().max(100000000).optional().describe('Valor aproximado de los productos, en pesos.'),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, direccion_id, valor }) =>
      asBuyer(phone, async ({ service, user }) => {
        const cobertura = await loadCoverage(service, user.userId, direccion_id, valor);
        if (!cobertura) return fail('NO_EXISTE', 'Esa dirección no es de este comprador.');
        if (cobertura.noQuote) return fail('SIN_COTIZACION', DELIVERY_QUOTE_UNAVAILABLE_MESSAGE);
        return ok({ cobertura: toCoverageView(cobertura) });
      })
  );
}
