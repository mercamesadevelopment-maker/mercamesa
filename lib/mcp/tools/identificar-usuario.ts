import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';
import { asBuyer } from '../buyer';
import { ok } from '../result';
import { telefono } from './schemas';

export function registerIdentificarUsuario(server: McpServer) {
  server.registerTool(
    'identificar_usuario',
    {
      title: 'Identificar usuario',
      description:
        'Dice quién es la persona del teléfono: su nombre, su rol y sus tiendas si es tendero. Úsala al empezar la conversación. ' +
        'Si responde NO_VERIFICADO, explícale que entre a su perfil en MercaMesa, toque «Verificar por WhatsApp» y te envíe el código ' +
        '(luego usa verificar_telefono). Si responde NO_IDENTIFICADO o AMBIGUO, no des datos de pedidos ni de casos y ofrece hablar con una persona.',
      inputSchema: z.object({ telefono }),
      annotations: { readOnlyHint: true },
    },
    async ({ telefono: phone }) =>
      asBuyer(phone, async ({ user }) =>
        ok({
          nombre: user.fullName,
          rol: user.role,
          tiendas: user.stores.map((s) => s.name),
        })
      )
  );
}
