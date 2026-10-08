# Integración con Pibox (Picap)

Pibox es la API logística de Picap: MercaMesa la usa para cotizar el domicilio en la canasta y para pedir un mensajero en moto que lleve cada pedido de la tienda al comprador. La documentación del proveedor está en `docs/picap.MD` y `docs/webhooksPicap.MD` (carpeta local, fuera de git).

## Recorrido de un pedido

1. **Canasta: cotizar.** `POST /api/checkout/quote` arma la misma reserva que se haría al despachar (`loadQuoteContext` → `buildBookingPayload`) y la manda a `POST /bookings/eta`. No crea nada ni contacta a nadie.
2. **Tienda: «Listo Recogida».** Al cambiar el estado a `at_collection`, el navegador llama `POST /api/pibox/bookings` (`src/features/orders/services/update-order-status.service.ts`). La ruta:
   - exige que quien llama sea de la tienda o admin;
   - **exige el pago aprobado**: no hay contraentrega;
   - no crea una segunda reserva si ya hay una vigente;
   - crea la reserva (`POST /bookings`) y guarda la respuesta en `pibox_bookings`.

   Si algo falla, el estado igual cambia y el motivo queda en el historial del pedido.
3. **Pibox avisa: webhook.** `POST /api/pibox/webhook` recibe los eventos 0 (pedido) y 1 (paquete), autenticados con el encabezado `x-pibox-secret`. Con cada evento:
   - actualiza la reserva y, si corresponde, el estado del pedido;
   - descarta los eventos atrasados (`last_event_at`);
   - el estado del pedido solo avanza, nunca retrocede.
4. **Red de seguridad: cron.** `pibox_sync` corre cada 10 minutos (`POST /api/pibox/sync`, con `CRON_SECRET`). Vuelve a consultar en Pibox las reservas vigentes y aplica la misma traducción de estados. Existe porque Pibox no promete reintentar un webhook que falle.
5. **Pantallas.** El comprador, la tienda y el admin ven el domicilio en el detalle del pedido (`DeliveryTracking`). Leen `GET /api/pibox/bookings`, que recorta los campos según quién pregunta, y vuelven a consultar cada 30 s mientras el mensajero está en camino.

## Cómo se traduce el estado

| Pibox | Pedido en MercaMesa | Se ve |
|---|---|---|
| 0 Buscando conductor, 109 Programado | sigue en Listo Recogida | «Buscando conductor» |
| 1 Conductor en camino, 5 Recogiendo | sigue en Listo Recogida | conductor, placa, «Llamar», «Seguir en el mapa» |
| 6 Paquete a bordo, 7 Entregando, paquete 1 Recogido | Despachado | igual, paso «En camino» |
| 4 Finalizado, paquete 2 Entregado | Entregado | «Pedido entregado» |
| paquete 4 No recibido, 5 Devuelto | Devuelto | — |
| 101 Sin conductor, 102 Cancelado | **sigue en Listo Recogida** | aviso; la tienda ve «Solicitar otro domiciliario» |
| 100 Canceló el conductor | sigue en Listo Recogida | Pibox relanza solo: el webhook enlaza la reserva nueva (`relaunched_to_id`) |

Cancelar el mensajero (`PATCH /api/pibox/bookings/{id}`) cancela solo el domicilio, nunca la compra. Una reserva sin conductor o cancelada queda en `is_active = false`, y por eso se puede pedir otra.

Los estados de Pibox son más finos que los del pedido: el detalle completo queda en las notas del historial (`buildBookingStatusNote`).

## Quién ve qué

`GET /api/pibox/bookings` acepta `store_order_id`, para la tienda y el admin, o `order_id` + `store_id`, para el comprador. Nunca devuelve `raw`.

| | Comprador | Tienda | Admin |
|---|---|---|---|
| Estado, conductor, teléfono, placa, enlace de seguimiento | sí | sí | sí |
| Costo del domicilio | no | sí | sí |
| Código de recogida (`pickup_validation_code`) | no | sí | sí |
| Código de entrega (`validation_code`) | sí | no | sí |
| Historial de reservas del pedido | no | no | sí |

La tabla `pibox_bookings` solo la puede leer el comprador del pedido, la tienda o un admin (política RLS). Las escrituras las hace únicamente el servidor, con la llave de servicio.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `PIBOX_ENABLED` | Interruptor general. En `false`, las rutas responden 503 y no se pide nada. |
| `PIBOX_API_TOKEN` | Token de la cuenta. Viaja como `?t=` en la URL, no en un encabezado. |
| `PIBOX_API_URL` | Por defecto `https://turing.thetrancon.com/api/third`. |
| `PIBOX_SERVICE_TYPE_ID` | Por defecto, mensajería en moto (`5c71b03a58b9ba10fa6393cf`). |
| `PIBOX_DEFAULT_PACKAGE_SIZE_CD` | Tamaño del paquete (0 a 3). Por defecto 2, mediano. |
| `PIBOX_WEBHOOK_SECRET` | Lo que Pibox reenvía en `x-pibox-secret`. Sin él, el webhook rechaza todo. |
| `PIBOX_DRY_RUN` | Solo local o staging: se cotiza de verdad, la reserva se simula (`SIMULADO-…`). |

## Webhooks

La cuenta de Picap no tiene pantalla para administrarlos; solo existen por API:

```
pnpm pibox:hooks list
pnpm pibox:hooks register https://<dominio de producción>
pnpm pibox:hooks sync https://<dominio de producción>   # borra y recrea
```

Hay que registrar los dos eventos, 0 y 1, con la URL de producción y el secreto. El 2 (pre-paquetes) no se usa.

## Probar en local, sin mensajero real

Con `PIBOX_DRY_RUN=true` y un `PIBOX_WEBHOOK_SECRET` propio en `.env.local`:

1. Crea un pedido y págalo: `pnpm local:pay <código del pedido>`.
2. Como tendero, márcalo «Listo Recogida». Se crea una reserva `SIMULADO-…`.
3. Avanza el domicilio con eventos de ejemplo, con la forma exacta de la documentación:

```
pnpm local:pibox MM-2026-001090-1 buscando
pnpm local:pibox MM-2026-001090-1 asignado        # conductor, placa, enlace y códigos de ejemplo
pnpm local:pibox MM-2026-001090-1 recogido        # → Despachado
pnpm local:pibox MM-2026-001090-1 entregado       # → Entregado
pnpm local:pibox MM-2026-001090-1 sin-conductor   # → aviso y «Solicitar otro domiciliario»
pnpm local:pibox MM-2026-001090-1 relanzado       # canceló el conductor y Pibox relanzó
pnpm local:pibox MM-2026-001090-1 atrasado        # evento viejo: no debe cambiar nada
```

El script se niega a correr contra una base que no sea la local y no toca reservas reales.

## Diferencias entre la documentación y la API real

- **Dinero**: en las peticiones va `{ sub_units, currency }`; en las respuestas llega `{ subunits, iso }`. Siempre en centavos (`toSubUnits` y `fromSubUnits`).
- **`/bookings/eta`** responde además `flat_rate_amount`, que no está documentado.
- **El teléfono de ejemplo** de la documentación (`30112345678`) no es un celular colombiano válido. Nosotros partimos el número guardado en formato internacional (E.164) en indicativo y número.
- **`city_code`** solo cubre Bogotá, Medellín, Barranquilla, Cali, Bucaramanga y Guatemala. Por eso las direcciones se marcan en el mapa: sin coordenadas, una entrega en Sabaneta o Envigado no se puede despachar, y se rechaza antes de pagar.

## Por confirmar con Picap

- **`validation_code` del paquete**: la documentación no explica para qué es. Lo tratamos como el código que el comprador le da al mensajero al recibir, y por eso solo lo ven el comprador y el admin.
- **Reintentos de los webhooks 0 y 1**: la documentación solo dice que el evento 2 no se reintenta. Asumimos que ninguno se reintenta, y para eso está el cron.
- **Orden de llegada de los eventos**: no está garantizado; se descartan los atrasados con `last_event_at`.
- **`indications` del paquete**: hoy va «Pedido Mercamesa» o la nota del pedido. Las indicaciones del comprador viajan en `secondary_address` de la parada, junto con el barrio.

## Lo que no se puede probar sin un mensajero real

- Que Pibox asigne conductor y mande los webhooks a la URL de producción.
- El enlace de seguimiento y los códigos reales (en local son de ejemplo).
- La cancelación por `PATCH` contra Pibox (en local se simula).

La primera prueba en producción conviene hacerla con un pedido propio y pequeño, después de confirmar con `pnpm pibox:hooks list` que los dos webhooks apuntan a producción.
