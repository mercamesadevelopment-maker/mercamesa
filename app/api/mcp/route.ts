import { createMcpHandler } from 'mcp-handler';
import { getMeteorMcpToken } from '@/lib/env';
import { meteorAuthError } from '@/lib/mcp/auth';
import { registerMeteorTools } from '@/lib/mcp/register';
import { MCP_VERSION } from '@/lib/mcp/changelog';

/**
 * El MCP de Meteor (Carolina). Solo valida el token del entorno; quién es el
 * usuario lo resuelve cada herramienta con el teléfono. La versión sale de los
 * cambios publicados en `/mcp/cambios` (`lib/mcp/changelog.ts`).
 */
const handler = createMcpHandler(registerMeteorTools, {
  serverInfo: { name: 'mercamesa', version: MCP_VERSION },
});

async function conToken(request: Request): Promise<Response> {
  return meteorAuthError(request, getMeteorMcpToken()) ?? handler(request);
}

export { conToken as GET, conToken as POST, conToken as DELETE };
