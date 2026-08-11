# Webhooks

Los Webhooks permiten a un usuario suscribirse a eventos que se generan cada vez que se actualiza el estado de un pedido, paquete o pre-paquete. Cuando se activa uno de estos eventos, se envía una solicitud HTTP POST a la URL configurada para el webhook.

## Tipos de eventos

| Identificador del evento | Descripción |
|---|---|
| 0 | Actualización de estado de un pedido |
| 1 | Actualización de estado de un paquete |
| 2 | Actualización de estado de un pre-paquete |

---

## Crear un webhook

### HTTP Request
`POST https://turing.thetrancon.com/api/third/hooks`

### Headers
`Content-Type: application/json; charset=utf-8`

### Parámetros del webhook

| Parámetro | Tipo | Descripción |
|---|---|---|
| url | String | URL que va a ser llamada cada vez que se genere el evento |
| event_cd | Integer | Identificador del evento al cual se va a suscribir el usuario |
| headers | Hash | Headers del request especificados por el usuario, enviados al notificar el evento |

### Ejemplo cuerpo de petición
```json
{
  "hook": {
    "url": "https://www.api.test/hook/bookings",
    "event_cd": 0,
    "headers": {}
  }
}
```

### Ejemplo respuesta de petición
```json
{
  "_id": "5d7f23ec56c97100147bfba2",
  "url": "https://www.api.test/hook/bookings",
  "event_cd": 0,
  "headers": {}
}
```

Este servicio crea un nuevo webhook suscribiendo al usuario a un evento específico.

---

## Actualización de un pedido (event_cd: 0)

Una vez un usuario se suscribe a la actualización de un pedido y este evento es generado, se hace un llamado HTTP POST al URL especificado en el webhook, con información relevante del nuevo estado. Si el hook fue creado con headers, el servidor los enviará en el request.

### Atributos del llamado HTTP POST

| Atributo | Tipo | Descripción |
|---|---|---|
| booking_id | String | Identificador único del pedido actualizado |
| status_cd | Integer | Nuevo estado del pedido |
| event_cd | Integer | Identificador único del evento generado. En este caso 0 |
| created_at | String | Fecha de creación del evento en formato UTC |
| relaunched_to_id | String | Identificador del nuevo pedido en el que fue relanzado el actual (si fue cancelado por el conductor y requiere relanzamiento) |
| driver | Hash | Datos del piloto, si el pedido ya está asignado |
| vehicle | Hash | Datos del vehículo, si el pedido ya está asignado |

### Ejemplo del llamado al webhook
```json
{
  "booking_id": "5dec4d2321ec510019081c33",
  "status_cd": 101,
  "event_cd": 0,
  "created_at": "2019-12-08T01:08:52.280Z",
  "relaunched_to_id": null,
  "driver": {
    "id": "613a3ea7a585b2001e1eb92c",
    "name": "David",
    "phone": "301301629522"
  },
  "vehicle": {
    "plates": "POI123"
  }
}
```

---

## Actualización de un paquete (event_cd: 1)

Una vez un usuario se suscribe a la actualización de un paquete y este evento es generado, se hace un llamado HTTP POST al URL especificado en el webhook con información del nuevo estado. Si el hook fue creado con headers, el servidor los enviará en el request.

### Atributos del llamado HTTP POST

| Atributo | Tipo | Descripción |
|---|---|---|
| package_id | String | Identificador único del paquete actualizado |
| status_cd | Integer | Nuevo estado del paquete |
| event_cd | Integer | Identificador único del evento generado. En este caso 1 |
| created_at | String | Fecha de creación del evento en formato UTC |

### Ejemplo del llamado al webhook
```json
{
  "package_id": "5dec4d2321ec510019081c3e",
  "status_cd": 0,
  "event_cd": 1,
  "created_at": "2019-12-08T01:08:53.077Z"
}
```

---

## Actualización de un pre-paquete (event_cd: 2)

Una vez un usuario se suscribe a la actualización de un pre-paquete y este evento es generado (por cambio de estado o al agruparse el pre-paquete dentro de una ruta), se hace un llamado HTTP POST al URL especificado en el webhook, con información del pre-paquete y, si ya existe, del paquete físico asociado.

Si el hook fue creado con headers, el servidor los enviará en el request.

> ⚠️ **Importante:** el envío es asíncrono y de mejor esfuerzo (*at-most-once*). Si el endpoint destino falla o no responde, **no hay reintento automático**.

### Atributos del llamado HTTP POST

| Atributo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único del pre_paquete que originó el evento |
| prepackage_identification | String | Código legible del pre_paquete (usado para conciliación con la empresa) |
| reference | String | Referencia libre ingresada por la empresa al crear el pre_paquete |
| package | Object | Snapshot del paquete físico asociado. Si aún no existe, `package.id` y `package.status_cd` viajan como `null` |
| package.id | String | Identificador único del paquete asociado |
| package.status_cd | Integer | Código de estado del paquete asociado |
| origin_address | String | Dirección de recogida del pre_paquete |
| end_address | String | Dirección de entrega del pre_paquete |
| delivered_photo_url | String | URL de la foto de entrega. Solo se incluye cuando el paquete asociado está en estado `delivered` |
| event_cd | Integer | Identificador único del evento generado. En este caso 2 |
| created_at | String | Fecha de creación del pre_paquete en formato UTC (**no** es la fecha del cambio de estado que disparó el evento) |

### Ejemplo del llamado al webhook (sin paquete asociado aún)
```json
{
  "id": "665f1c2e4b3a9c0012ab34cd",
  "prepackage_identification": "PKG-2026-000123",
  "reference": "Factura #4521",
  "package": {
    "id": null,
    "status_cd": null
  },
  "origin_address": "Calle 123 #45-67, Bogotá",
  "end_address": "Carrera 89 #12-34, Bogotá",
  "event_cd": 2,
  "created_at": "2026-07-13T14:32:07.123Z"
}
```

### Ejemplo del llamado al webhook (pre-paquete `delivered`)
```json
{
  "id": "665f1c2e4b3a9c0012ab34cd",
  "prepackage_identification": "PKG-2026-000123",
  "reference": "Factura #4521",
  "package": {
    "id": "665f1c9a4b3a9c0012ab3501",
    "status_cd": 2
  },
  "origin_address": "Calle 123 #45-67, Bogotá",
  "end_address": "Carrera 89 #12-34, Bogotá",
  "delivered_photo_url": "https://cdn.picap.co/packages/delivered/abc123.jpg",
  "event_cd": 2,
  "created_at": "2026-07-13T14:32:07.123Z"
}
```

---

## Listar webhooks creados

### HTTP Request
`GET https://turing.thetrancon.com/api/third/hooks`

### Headers
`Content-Type: application/json; charset=utf-8`

Este servicio lista todos los webhooks de un usuario.

### Parámetros

| Atributo | Tipo | Descripción |
|---|---|---|
| id | String | Identificador único del webhook |
| url | String | URL que es llamada cada vez que se genera un evento |
| event_cd | Integer | Identificador del evento al cual está suscrito el usuario |
| headers | Hash | Headers del request especificados por el usuario |

### Ejemplo respuesta de petición
```json
[
  {
    "_id": "5d7f21a8c149a425b56a6f2c",
    "url": "https://api.test/hooks/bookings",
    "event_cd": 0,
    "headers": {}
  },
  {
    "_id": "5d7f23ec56c97100147bfba2",
    "url": "https://api.test/hooks/packages",
    "event_cd": 1,
    "headers": {}
  }
]
```

---

## Eliminar un webhook

### HTTP Request
`DELETE https://turing.thetrancon.com/api/third/hooks/{HOOK_ID}`

> `HOOK_ID` hace referencia al identificador único retornado al crearse un webhook.

### Headers
`Content-Type: application/json; charset=utf-8`

### Ejemplo respuesta de petición
```json
{
  "_id": "5d7f23ec56c97100147bfba2",
  "url": "https://www.api.test/hook/bookings",
  "event_cd": 0,
  "headers": {}
}
```

