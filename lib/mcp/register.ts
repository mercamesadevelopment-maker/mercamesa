import type { McpServer } from '@modelcontextprotocol/server';
import { registerIdentificarUsuario } from './tools/identificar-usuario';
import { registerListarPedidos } from './tools/listar-pedidos';
import { registerDetallePedido } from './tools/detalle-pedido';
import { registerConsultarCaso } from './tools/consultar-caso';
import { registerProductos } from './tools/productos';
import { registerVerificarTelefono } from './tools/verificar-telefono';
import { registerEstadoPago } from './tools/estado-pago';
import { registerReglasDeCompra } from './tools/reglas-de-compra';
import { registerCobertura } from './tools/cobertura';
import { registerCasos } from './tools/casos';
import { registerTendero } from './tools/tendero';
import { registerEscritura } from './tools/escritura';

/**
 * Las herramientas de Carolina, el agente de Meteor. Las que escriben
 * (`verificar_telefono`, los casos, crear_orden y las del tendero) llevan su
 * llave de idempotencia, y las que tocan pedidos o precios piden confirmar:
 * sin `confirmar: true` solo devuelven el resumen. Documentación:
 * `docs/mcp-meteor.md`.
 */
export function registerMeteorTools(server: McpServer) {
  registerIdentificarUsuario(server);
  registerListarPedidos(server);
  registerDetallePedido(server);
  registerConsultarCaso(server);
  registerProductos(server);
  registerVerificarTelefono(server);
  registerEstadoPago(server);
  registerReglasDeCompra(server);
  registerCobertura(server);
  registerCasos(server);
  registerTendero(server);
  registerEscritura(server);
}
