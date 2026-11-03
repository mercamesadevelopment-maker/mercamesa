import type { McpServer } from '@modelcontextprotocol/server';
import { registerIdentificarUsuario } from './tools/identificar-usuario';
import { registerListarPedidos } from './tools/listar-pedidos';
import { registerDetallePedido } from './tools/detalle-pedido';
import { registerConsultarCaso } from './tools/consultar-caso';
import { registerProductos } from './tools/productos';

/**
 * Las herramientas de Carolina, el agente de Meteor. Por ahora solo consultan;
 * las que escriben (radicar un caso, agregarle un mensaje) llegan con su llave
 * de idempotencia. Documentación: `docs/mcp-meteor.md`.
 */
export function registerMeteorTools(server: McpServer) {
  registerIdentificarUsuario(server);
  registerListarPedidos(server);
  registerDetallePedido(server);
  registerConsultarCaso(server);
  registerProductos(server);
}
