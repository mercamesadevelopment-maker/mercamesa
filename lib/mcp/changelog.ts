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
    version: '2.6.1',
    fecha: '2026-11-19',
    resumen: 'Dos correcciones de seguridad en las herramientas que escriben.',
    cambios: [
      {
        tipo: 'corregido',
        donde: 'crear_orden',
        detalle:
          'Solo acepta productos publicados de tiendas activas, los mismos que muestra buscar_productos. Uno que no lo está responde DATOS_INVALIDOS con «ya no están disponibles».',
      },
      {
        tipo: 'corregido',
        donde: 'agregar_a_caso',
        detalle:
          'Un reintento con la misma clave_idempotencia solo cuenta como repetido en el mismo caso. Con el código de otro caso, la respuesta es la de siempre: NO_EXISTE si no es de la persona.',
      },
    ],
  },
  {
    version: '2.6.0',
    fecha: '2026-11-19',
    resumen:
      'Carolina escribe: crea pedidos (el pago sigue en la app), y el tendero avanza sus pedidos, cancela su parte y cambia precios y existencias. Todo pide confirmar.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'Herramientas que escriben',
        detalle:
          'crear_orden, modificar_orden, cambiar_estado_subpedido y actualizar_precio se llaman dos veces: sin `confirmar` devuelven `resumen` sin escribir nada; con `confirmar: true` y la misma `clave_idempotencia` escriben. Hay que mostrarle el resumen a la persona y esperar su sí. Lo que hacen queda en el historial como «Por WhatsApp (Carolina)».',
      },
      {
        tipo: 'nuevo',
        donde: 'crear_orden',
        detalle:
          'Con `productos` (`id` de buscar_productos y `cantidad`), `direccion_id`, `notas` y `usar_saldo`. El resumen trae productos con su precio, `productos_de_terceros`, `domicilio`, `total` y `saldo_a_favor_disponible`. Al confirmar devuelve `pedido` (`codigo`, `total`, `pago`), `enlace_pago` (Mis órdenes, donde se paga con «Pagar») y `que_sigue`. Carolina no cobra: el pedido queda pendiente de pago, salvo que el saldo a favor lo cubra. Aplican las reglas de reglas_de_compra; si no se cumplen, `DATOS_INVALIDOS` con el motivo.',
      },
      {
        tipo: 'nuevo',
        donde: 'modificar_orden',
        detalle:
          '`accion: cancelar_parte`: la tienda cancela su parte de un pedido de varias tiendas (`parte`, `motivo`); al comprador se le abona como saldo a favor. El comprador no puede cambiar ni cancelar un pedido: responde `NO_PERMITIDO` con qué hacer (caso si ya pagó; si no, el pedido vence solo).',
      },
      {
        tipo: 'nuevo',
        donde: 'cambiar_estado_subpedido',
        detalle:
          'Avanza la parte de su tienda un paso (`estado`: confirmed, packing, at_collection, dispatched, delivered), como el botón del panel. Al pasar a at_collection pide el mensajero (`domicilio` dice qué pasó). En un pedido de varias tiendas, después de «Listo Recogida» no avanza la tienda.',
      },
      {
        tipo: 'nuevo',
        donde: 'actualizar_precio',
        detalle:
          'Hasta 50 productos de su tienda por `codigo`: `precio`, `precio_mayorista`, `minimo_mayorista`, `stock` y `publicado`, con las reglas de la tabla del panel. El resumen trae `antes` y `despues` de cada uno. El cambio de stock queda en la bitácora como «Ajuste por WhatsApp».',
      },
    ],
  },
  {
    version: '2.5.0',
    fecha: '2026-11-19',
    resumen: 'El tendero consulta por el chat sus pedidos, por urgencia, y su liquidación.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'pedidos_del_tendero',
        detalle:
          'Las partes de pedido de la tienda de la persona, pagadas, lo más urgente primero (por preparar, empacando, listas para recoger, en camino). Cada una con `estado_texto` como en el panel del tendero, `siguiente` (el paso que sigue), `productos` de su tienda, `notas_del_comprador`, `notas_de_empaque`, `refrigerado`, `varias_tiendas`, `venta_de_mostrador` y `domicilio` (estado, conductor y placa). Del comprador solo `comprador` (primer nombre) y `barrio`. Sin códigos. `incluir_cerrados` suma las entregadas, canceladas y devueltas. Hasta 30, con `hay_mas`.',
      },
      {
        tipo: 'nuevo',
        donde: 'liquidacion_del_tendero',
        detalle:
          'Del periodo (`desde` y `hasta`, por defecto los últimos 30 días): `vendido`, `pagado` (con cada pago) y, a hoy, `proximo_pago` (`fecha_de_liquidacion`, martes o jueves; `valor`; `pedidos`; `descuentos` por devoluciones que asume la tienda) y `retenido` por razón con su `explicacion`. `retenciones` es `null`: el sistema no las calcula. A la tienda se le paga el valor de sus productos.',
      },
      {
        tipo: 'nuevo',
        donde: 'Herramientas del tendero',
        detalle:
          'Si la persona tiene varias tiendas, `tienda` (su nombre) dice cuál; sin ella responde `AMBIGUO` con la lista. Si no es de ninguna tienda, `NO_PERMITIDO`.',
      },
    ],
  },
  {
    version: '2.4.0',
    fecha: '2026-11-19',
    resumen: 'Carolina radica casos de PQRSF y les agrega mensajes y fotos, sin duplicarlos si reintenta.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'registrar_caso',
        detalle:
          'Radica un caso a nombre de la persona (comprador, o tendero en los motivos de tienda): `motivo` (la llave; la lista con lo que pide cada uno está en la descripción de la herramienta), `descripcion`, `pedido` (la parte de una tienda, o el pedido si tiene una sola), `productos` por su nombre en el pedido (con `cantidad` opcional), `fotos` y `clave_idempotencia`. Devuelve `caso` (`codigo`, `estado`), `motivo`, `quien_atiende` y `repetido`. Si el pedido tiene varias tiendas y no se dice cuál, responde `DATOS_INVALIDOS` con las partes.',
      },
      {
        tipo: 'nuevo',
        donde: 'agregar_a_caso',
        detalle:
          'Suma un `mensaje` y, si hay, `fotos` a un caso abierto por `codigo`, con `clave_idempotencia`. Un caso resuelto no recibe más.',
      },
      {
        tipo: 'nuevo',
        donde: 'Fotos',
        detalle:
          '`fotos` son URLs https del almacenamiento de medios de Meteor, hasta 5, JPG, PNG o WebP de hasta 8 MB. Solo se aceptan los dominios que MercaMesa tenga configurados: hay que enviarnos cuáles son. Mientras no estén, una llamada con fotos responde `DATOS_INVALIDOS`.',
      },
      {
        tipo: 'nuevo',
        donde: 'Idempotencia',
        detalle:
          '`clave_idempotencia` (8 a 120 caracteres, un UUID sirve) es obligatoria en las herramientas que escriben. La misma clave de la misma persona devuelve lo que ya se creó, con `repetido: true`.',
      },
      {
        tipo: 'nuevo',
        donde: 'Errores',
        detalle:
          '`DATOS_INVALIDOS`: falta algo o no cumple una regla (el mensaje dice qué decirle a la persona). `NO_PERMITIDO`: la persona no puede hacer eso (por ejemplo, un motivo de tienda sin ser de su equipo).',
      },
    ],
  },
  {
    version: '2.3.0',
    fecha: '2026-11-19',
    resumen:
      'Nuevas consultas: el pago de un pedido, las reglas de compra, las direcciones del comprador y qué le llega a cada una. `identificar_usuario` reconoce a logística y al patinador.',
    cambios: [
      {
        tipo: 'nuevo',
        donde: 'estado_pago',
        detalle:
          'El pago de un pedido del comprador (por su código o el de una parte): `estado` (pending, processing, approved, rejected, refunded, disputed), `estado_texto`, `que_hacer` con lo que se le dice al comprador en cada caso, `total`, `saldo_a_favor_usado` y `devoluciones` (por un caso o porque una tienda canceló su parte: `total`, `como` —saldo a favor o dinero—, `estado_texto` y `consignada`). `devolucion_en_curso` es `true` si hay dinero por consignar. Sin datos financieros.',
      },
      {
        tipo: 'nuevo',
        donde: 'reglas_de_compra',
        detalle:
          'Sin teléfono: `minimo_de_compra`, `maximo_tiendas_por_pedido`, `misma_plaza` (solo se juntan tiendas que despachan desde la misma plaza), `ofertas` y, por plaza, `como_sale` un pedido de varias tiendas. `plaza` es opcional.',
      },
      {
        tipo: 'nuevo',
        donde: 'listar_direcciones',
        detalle: 'Las direcciones guardadas del comprador, con su `id`, la predeterminada primero.',
      },
      {
        tipo: 'nuevo',
        donde: 'consultar_cobertura',
        detalle:
          'Con `direccion_id` (de listar_direcciones) y opcionalmente `valor`: por cada plaza o tienda con dirección propia, sus tiendas (`abierta` ahora y `horario`) y el `domicilio` hasta esa dirección. `domicilio: null` es un punto que no se pudo cotizar en ese momento.',
      },
      {
        tipo: 'nuevo',
        donde: 'identificar_usuario',
        detalle:
          '`perfil`: comprador, tendero, logistica, patinador, administrador o contador. Logística y patinador traen `plazas` (`nombre` y `como`). `rol` sigue igual.',
      },
      {
        tipo: 'nuevo',
        donde: 'buscar_productos',
        detalle: '`maximo_por_pedido`: el tope de la oferta vigente por pedido, o `null`. También en detalle_producto.',
      },
      {
        tipo: 'nuevo',
        donde: 'Errores',
        detalle: '`SIN_COTIZACION`: Pibox no pudo cotizar ningún domicilio para esa dirección en este momento. Se puede reintentar en unos minutos.',
      },
    ],
  },
  {
    version: '2.2.0',
    fecha: '2026-11-17',
    resumen: '`buscar_productos` encuentra aunque el comprador escriba con errores de ortografía.',
    cambios: [
      {
        tipo: 'cambio',
        donde: 'buscar_productos',
        detalle:
          '`texto` ya no tiene que estar escrito igual que el producto. Encuentra lo que suena igual («bino» → vino, «hagua» → agua, «aros» → arroz: b/v, h muda, s/z/c, ll/y, rr/r) y, si con eso no hay nada, los productos que más se parecen («aguacte» → aguacate). Cada palabra del texto se busca por separado. La respuesta tiene la misma forma; si llegaron por parecido, conviene confirmarle al comprador que es lo que buscaba.',
      },
    ],
  },
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
