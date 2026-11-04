import { createMcpHandler } from 'mcp-handler';
import { getMeteorMcpToken } from '@/lib/env';
import { meteorAuthError } from '@/lib/mcp/auth';
import { registerMeteorTools } from '@/lib/mcp/register';

/**
 * El MCP de Meteor (Carolina). Solo valida el token del entorno; quién es el
 * usuario lo resuelve cada herramienta con el teléfono.
 */
const handler = createMcpHandler(registerMeteorTools, {
  serverInfo: { name: 'mercamesa', version: '1.0.0' },
});

async function conToken(request: Request): Promise<Response> {
  return meteorAuthError(request, getMeteorMcpToken()) ?? handler(request);
}

export { conToken as GET, conToken as POST, conToken as DELETE };
