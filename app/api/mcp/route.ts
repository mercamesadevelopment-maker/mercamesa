import { createMcpHandler } from 'mcp-handler';
import { getMeteorMcpToken } from '@/lib/env';
import { bearerFrom, isValidMcpToken } from '@/lib/mcp/auth';
import { registerMeteorTools } from '@/lib/mcp/register';

/**
 * El MCP de Meteor (Carolina). Solo valida el token del entorno; quién es el
 * usuario lo resuelve cada herramienta con el teléfono.
 */
const handler = createMcpHandler(registerMeteorTools, {
  serverInfo: { name: 'mercamesa', version: '1.0.0' },
});

async function conToken(request: Request): Promise<Response> {
  const expected = getMeteorMcpToken();
  if (!expected) return Response.json({ error: 'El MCP no está habilitado en este entorno.' }, { status: 503 });

  if (!isValidMcpToken(bearerFrom(request.headers.get('authorization')), expected)) {
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  }

  return handler(request);
}

export { conToken as GET, conToken as POST, conToken as DELETE };
