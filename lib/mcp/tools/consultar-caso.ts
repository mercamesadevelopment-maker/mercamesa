import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { getPqrsDetail, listPqrs } from '@/lib/pqrs/queries';
import type { PqrsActor } from '@/lib/pqrs/actor';
import { asBuyer } from '../buyer';
import { fail, ok } from '../result';
import { toCaseSummaryView, toCaseView } from '../views';
import { pagina, telefono } from './schemas';

const NO_EXISTE = 'No hay un caso con ese código para este comprador.';

export function registerConsultarCaso(server: McpServer) {
  server.registerTool(
    'consultar_caso',
    {
      title: 'Consultar casos (PQRSF)',
      description:
        'Los casos (peticiones, quejas, reclamos y sugerencias) que abrió el comprador del teléfono. ' +
        'Sin código, la lista; con código (PQR-2026-000019), el detalle con la conversación y la devolución si la hubo.',
      inputSchema: z.object({
        telefono,
        codigo: z.string().min(3).max(40).optional().describe('Código del caso, por ejemplo PQR-2026-000019.'),
        pagina,
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone, codigo, pagina: page }) =>
      asBuyer(phone, async ({ service, user }) => {
        // Siempre como comprador, aunque la cuenta sea de un tendero o de un
        // administrador: por el chat solo se ven los casos propios.
        const actor: PqrsActor = { userId: user.userId, isAdmin: false, storeIds: [] };

        if (!codigo) {
          const r = await listPqrs(service, actor, { scope: 'buyer', page });
          return ok({ casos: r.items.map(toCaseSummaryView), total: r.total, pagina: r.page, paginas: r.totalPages });
        }

        const { data: fila, error } = await service
          .from('pqrs')
          .select('id')
          .eq('code', codigo.trim().toUpperCase())
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!fila) return fail('NO_EXISTE', NO_EXISTE);

        const detalle = await getPqrsDetail(service, actor, fila.id);
        if (!detalle || detalle.viewer !== 'buyer') return fail('NO_EXISTE', NO_EXISTE);
        return ok({ caso: toCaseView(detalle) });
      })
  );
}
