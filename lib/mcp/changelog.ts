/**
 * Los cambios del MCP de Meteor y de sus avisos, tal como los lee Meteor en la
 * página pública `/mcp/cambios`. Es la única fuente: de acá salen esa página y la
 * versión que responde el servidor (`serverInfo.version` en `app/api/mcp`).
 *
 * Cada PR que cambie lo que Meteor recibe agrega una versión arriba
 * (`.github/workflows/mcp-cambios.yml` no deja fusionar sin eso). La versión:
 *
 * - Primer número: algo que ya funcionaba en Meteor deja de funcionar (un campo
 *   que se quita o se renombra, una entrada que pasa a ser obligatoria, un error
 *   nuevo donde antes había respuesta). Esos cambios van con `rompe: true`.
 * - Segundo número: algo nuevo que no rompe nada (una herramienta, un campo, un
 *   tipo de aviso).
 * - Tercer número: una corrección.
 *
 * `donde` es lo que Meteor reconoce: el nombre de la herramienta, «Avisos»,
 * «Errores» o «Todas las herramientas». No las rutas del código.
 */

export type McpChangeKind = 'nuevo' | 'cambio' | 'corregido' | 'retirado';

export interface McpChange {
  tipo: McpChangeKind;
  donde: string;
  detalle: string;
  /** Una integración que ya funcionaba deja de funcionar si no se ajusta. */
  rompe?: boolean;
}

export interface McpRelease {
  version: string;
  /** `YYYY-MM-DD`, el día en que se fusionó en `development`. */
  fecha: string;
  resumen: string;
  cambios: McpChange[];
}

export const MCP_CHANGE_KIND_LABELS: Record<McpChangeKind, string> = {
  nuevo: 'Nuevo',
  cambio: 'Cambió',
  corregido: 'Corregido',
  retirado: 'Retirado',
};

/** De la más nueva a la más vieja. */
export const MCP_RELEASES: McpRelease[] = [
  {
    version: '2.1.0',
    fecha: '2026-11-10',
    resumen:
      'Los códigos de Pibox llegan como avisos, cada uno a quien le corresponde, y cada aviso dice el rol de su destinatario.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'Avisos · codigo_recogida',
        detalle:
          'Cuando Pibox da el código de recogida, un aviso por la línea `tenderos` para cada persona que le entrega el paquete al mensajero: el equipo de la tienda; o, si el pedido sale de la bahía de la plaza, logística o el patinador. Trae `destinatario.telefono`, `pedido.codigo`, `parte` (código y tienda; `null` en la bahía), `tiendas` y `recogida` (`codigo`, `conductor` y `placa` si ya están asignados, y `lugar`: `tienda` o `bahia`).',
      },
      {
        tipo: 'nuevo',
        donde: 'Avisos · domicilio_recogido',
        detalle:
          'Cuando el mensajero recoge y va hacia el comprador, un aviso para él por la línea `compradores`, como `domicilio_en_camino` y además `domicilio.codigo_entrega`, el código que le da al mensajero al recibir.',
      },
      {
        tipo: 'nuevo',
        donde: 'Avisos',
        detalle:
          'Todos los avisos traen `destinatario.rol`: `comprador`, `tendero`, `logistica` o `patinador`. `linea` sigue diciendo desde qué número escribir.',
      },
    ],
  },
  {
    version: '2.0.0',
    fecha: '2026-11-08',
    resumen:
      'Los valores del pedido pasan a los dos conceptos de la factura, y PQRSF suma la felicitación.',
    cambios: [
      {
        tipo: 'cambio',
        donde: 'detalle_pedido',
        detalle:
          '`valores` trae `productos_de_terceros` (lo de las tiendas) y `domicilio` (todo lo de MercaMesa: domicilio, gastos administrativos y operativos), además de `descuento`, `saldo_a_favor_usado` y `total`.',
        rompe: true,
      },
      {
        tipo: 'retirado',
        donde: 'detalle_pedido',
        detalle:
          'Salen de `valores` los campos `productos`, `comision_de_servicio`, `mensajes` y `servicio_mercamesa`. En su lugar se usan `productos_de_terceros` y `domicilio`.',
        rompe: true,
      },
      {
        tipo: 'nuevo',
        donde: 'consultar_caso',
        detalle:
          'Un caso puede tener el motivo «Felicitación». No pide respuesta de la tienda ni lleva devolución: lo cierra MercaMesa.',
      },
    ],
  },
  {
    version: '1.0.0',
    fecha: '2026-11-05',
    resumen: 'Primera entrega: las herramientas de consulta del comprador y los avisos para WhatsApp.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'Todas las herramientas',
        detalle:
          'Conexión por Streamable HTTP con `Authorization: Bearer <token>`, un token por entorno. El usuario se identifica por el teléfono de WhatsApp.',
      },
      {
        tipo: 'nuevo',
        donde: 'verificar_telefono',
        detalle:
          'Marca como verificado el teléfono con el código que la persona genera en su perfil y envía por WhatsApp.',
      },
      {
        tipo: 'nuevo',
        donde: 'identificar_usuario',
        detalle: 'Nombre, rol y tiendas de la cuenta con ese teléfono.',
      },
      {
        tipo: 'nuevo',
        donde: 'listar_pedidos',
        detalle: 'Los pedidos del comprador, del más reciente al más antiguo, con una parte por tienda.',
      },
      {
        tipo: 'nuevo',
        donde: 'detalle_pedido',
        detalle: 'Valores, dirección, productos, historial y domicilio de cada parte del pedido.',
      },
      {
        tipo: 'nuevo',
        donde: 'consultar_caso',
        detalle: 'Los casos de PQRSF del comprador, uno por uno o en lista.',
      },
      {
        tipo: 'nuevo',
        donde: 'buscar_productos',
        detalle: 'La vitrina pública, sin teléfono: 10 productos por página con su oferta vigente.',
      },
      {
        tipo: 'nuevo',
        donde: 'detalle_producto',
        detalle: 'Un producto de `buscar_productos` por su `id`.',
      },
      {
        tipo: 'nuevo',
        donde: 'Errores',
        detalle:
          '`TELEFONO_INVALIDO`, `NO_IDENTIFICADO`, `NO_VERIFICADO`, `CODIGO_INVALIDO`, `AMBIGUO` y `NO_EXISTE`, con `isError: true`.',
      },
      {
        tipo: 'nuevo',
        donde: 'Avisos',
        detalle:
          '`/api/meteor/avisos`: la lista de cambios de los pedidos que Meteor consulta para enviar por WhatsApp.',
      },
    ],
  },
];

export const MCP_VERSION = MCP_RELEASES[0].version;
