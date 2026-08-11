||Expandir todos los ejemplos|||
||solución tecnológica. parámetro t. [https://turing.thetrancon.com/api/:url?t=TOKEN](https://turing.thetrancon.com/api/:url?t=TOKEN)  Debe remplazarse el parámetro [https://docs.picap.io/index.html#introducci-n|TOKEN|Introducción](https://docs.picap.io/index.html#introducci-n|TOKEN|Introducción) Bienvenido al API logístico de Picap. A través de nuestro API va a ser posible crear pedidos y verificar su estado en tiempo real, lo único necesario es conocimiento en servicios web RESTful. PiBox el servicio logístico de Picap esta innovando en el mercado de entrega haciendo uso de su flota de motos. En el siguiente documento se encuentra una guía detallada de como conectar su sistema con nuestra Autenticación Nuestro API utiliza tokens para permitir el acceso a los servicios REST. Todos los servicios deben ser accedidos haciendo uso de un con tu token personal. Respuesta 1/68|

|5/8/26, 10:39 p.m.|||||Picap Docs|
|---|---|---|---|---|---|
|Código 200 204 404 422 500 {|Errores|Códigos de respuesta Servicio no encontrado. Ejemplo de mensaje de error|El servicio funcionó como planeado. El servicio funcionó sin contenido de respuesta.|Descripción No pudimos procesar tu petición, verifica los parámetros. Error interno del servidor, tuvimos un problema procesando la petición.|El API utiliza códigos HTTP para indicar el estado de las peticiones. Esto incluye respuestas exitosas o fallidas.|
|"mssg": }|"Mensaje|de error"||||
|Atributo mssg 0 1 2 3|el error ocurrido. dimensiones de cada uno. Identificador|Nombre Muy pequeño Pequeño Mediano Grande [https://docs.picap.io/index.html#introducci-n|Descripción](https://docs.picap.io/index.html#introducci-n|Descripción) Mensaje describiendo la causa del error.|parámetro requerido fue omitido), y los códigos en el rango 5xx indica un error en nuestros servidores. Dimensiones Documentos, llaves, etc 20x20x20cm 30x30x30xcm 50x50x50cm|Por lo general se utiliza códigos HTTP. Todos los códigos en el rango 4xx indica un error causado por la información suministrada (ej. Un En caso de que haya un error al procesar tu petición el servidor responderá un JSON con código 422 que incluirá un mensaje describiendo Tamaños de un paquete Pibox maneja cuatro tamaños de paquete utilizados para buscar el conductor perfecto para tu pedido. La siguiente tabla describe las Volumen N/A 8,000 cm^3 27,000 cm^3 125,000 cm^3 2/68|

5/8/26, 10:39 p.m. Picap Docs

# Estados

Cada pedido y paquete hará la transición a través de diferentes estados durante su ciclo de vida. El significado de estos estados se describe en las tablas presentadas a continuación.

## Estados de un pedido

### Estado

|Identificador||
|---|---|
|0|Buscando conductor|
|1|Conductor en camino|
|5|Recogiendo paquete|
|6|Paquete a bordo|
|7|Entregando paquete|
|4|Pedido finalizado|
|100|Cancelado por conductor|
|102|Cancelado por pasajero|
|101|Expirado, no se encontró conductor|
|109|Programado|

## Estados de un paquete

|Identificador|Estado|
|---|---|
|0|Esperando recogida|
|1|Paquete recogido|
|2|Paquete entregado|
|3|Paquete cancelado|
|4|Paquete no recibido|
|5|Paquete devuelto|
|6 [https://docs.picap.io/index.html#introducci-n|En](https://docs.picap.io/index.html#introducci-n|En) bodega|

3/68

## Subestado razones por las cuales no se pudo recoger el paquete

### Identificador Razón

0 Producto no disponible

1 Dirección incorrecta

2 Cerrado

## Subestado razones por las cuales no se pudo entregar el paquete

### Razón

|Identificador||
|---|---|
|0|Ninguno|
|1|Dirección incorrecta|
|2|Rechazado por el cliente|
|3|Cliente ausente|
|4|Cliente no tiene dinero|

# Pedidos

## Estimar costo de un pedido

Ejemplo cuerpo de petición 39 líneas

{

|"booking":{|||||
|---|---|---|---|---|
||"address": "secondary_address":|"Cra. 61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|-74.108101, "return_to_origin": "scheduled_at": "stops":[|"requested_service_type_id": "requires_a_driver_with_base_money": null,|false,||
|{|"address": "lat": "lon": "customer": "name": "phone":|"Titan", "secondary_address": 4.695382, -74.085727, { "Cliente", "country_code":|"57", "30112345678",|"Diagonal al|

panadería",

"5c71b03a58b9ba10fa6393cf",

false,

centro comercial",

https://docs.picap.io/index.html#introducci-n 4/68

"email": "docs@picap.co" }, "packages":[ { "indications": "Indicaciones", "declared_value": { "sub_units": 210000, "currency": "COP" }, "reference": "Pedido 1", "counter_delivery": false, "size_cd": 1 }] }] } }

### Ejemplo respuesta de petición

{ "fare": { "subunits": 490000, "iso": "COP" }, "estimate_arrival": 835940 }

Este servicio calcula el costo estimado de un servicio de acuerdo con los parámetros especificados por el usuario.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/bookings/eta](https://turing.thetrancon.com/api/third/bookings/eta)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

address String Dirección del lugar de origen donde van a ser recogidos todos los paquetes

address3 number Dirección del lugar de origen donde van a ser recogidos todos los paquetes

Información complementaria del lugar de origen donde van a ser recogidos todos secondary_address String los paquetes (Opcional)

lat Float Latitud del lugar de origen donde van a ser recogidos todos los paquetes

lon Float Longitud del lugar de origen donde van a ser recogidos todos los paquetes

ID del tipo de servicio a ser solicitado. Para mensajería es utilizado requested_service_type_id String 5c71b03a58b9ba10fa6393cf

Determina si el conductor debe volver al lugar de origen una vez finalizadas las return_to_origin Boolean entregas

Determina si para el servicio se requiere un conductor con base de dinero igual o requires_a_driver_with_base_money Boolean menor a la suma del valor declarado total de todos los paquetes

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 5/68

### Parámetro Tipo Descripción

Si el pedido no es express, este atributo determina la fecha y hora en que se Date as scheduled_at debe empezar a buscar conductores. El formato de la fecha debe ser ISO 8601. string (Opcional)

stops Array Listado de paradas donde van a ser entregados los paquetes

**PARÁMETROS DE UNA PARADA**

### Parámetro Tipo Descripción

address String Dirección del lugar de destino donde va a ser entregado un grupo de paquetes

Información adicional a la dirección del lugar de destino donde va a ser entregado un grupo de secondary_address String paquetes (Opcional)

lat Float Latitud del lugar de destino donde va a ser entregado un grupo de paquetes

lon Float Longitud del lugar de destino donde va a ser entregado un grupo de paquetes

customer Object Cliente que recibe los paquetes (Opcional)

packages Array Listado de paquetes que van a ser entregados en la parada

**PARÁMETROS DEL CLIENTE**

### Parámetro Tipo Descripción

### name String Nombre del cliente

### email String Email del cliente

country_code String Código de teléfono del cliente

### phone String Teléfono del cliente

**PARÁMETROS DE UN PAQUETE**

### Parámetro Tipo Descripción

indications String Indicaciones de entrega del paquete

declared_value Hash Valor declarado del paquete en centavos y con un cunrrency especificado

reference String Número de pedido del paquete

counter_delivery Boolean Determina si el pago del paquete es a contra entrega

size_cd Integer Identificador del tamaño aproximado del paquete

 El declared_value es un Hash constituido por un entero representando el valor declarado en centavos (sub_units) y un String representando su código de moneda (currency)

 El estimate_arrival en la respuesta de la estimación es calculado en milisegundos, igualmente el subunits es dado en centavos

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 6/68

## Crear un pedido

### Ejemplo cuerpo de petición 44 líneas

{

|"booking":{|||||
|---|---|---|---|---|
|"address":|"Cra. "secondary_address":|61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|-74.108101, "sender_phone": "sender_country_code": "client_identification": "return_to_origin": "scheduled_at": "cost_center_id":|"requested_service_type_id": "requires_a_driver_with_base_money": null, null,|"3111234009", "57", false,||
|"stops":[|||||
|{|"address": "lat": "lon": "customer": "name": "phone": "email":|"Titan", "secondary_address": 4.695382, -74.085727, { "Cliente", "country_code": "fiscal_number":|"57", "30112345678", "docs@picap.co",|"Diagonal al "123456789"|
||}, "packages":[||||
||{|"indications": "declared_value": "sub_units": "currency":||"Indicaciones", { 210000, "COP"|
||},|"reference": "counter_delivery": "size_cd":|"Pedido 1|1", false,|
||}||||
||]||||
|}|||||
|]|||||
|}|||||

panadería",

"5a957e248af945001fbe678b", "5c71b03a58b9ba10fa6393cf",

false,

centro comercial",

}

Ejemplo cuerpo de petición para un pedido agendado 42 líneas

{

|"booking":{||||
|---|---|---|---|
||"Cra. "address": "secondary_address":|61 #23z-42", "Diagonal|a la|
|"lat":|4.653652,|||
|"lon":|-74.108101, "sender_phone": "sender_country_code": "client_identification": "requested_service_type_id": "return_to_origin": "scheduled_at":|"3111234009", "57", false, "requires_a_driver_with_base_money":|"2021-01-28T01:59:03+00:00",|
|"stops":[||||

panadería",

"5a957e248af945001fbe678b", "5c71b03a58b9ba10fa6393cf",

false,

https://docs.picap.io/index.html#introducci-n 7/68

|{||||
|---|---|---|---|
||"address": "lat": "lon":|"secondary_address": 4.695382, -74.085727, {"customer": "name": "country_code": "phone": "email":|"Titan", "Diagonal "Cliente", "57", "30112345678", "docs@picap.co"|
||},|"packages":[||
||{|"indications":|"declared_value": { 210000, "sub_units": "currency": "COP"|
|||}, "reference": "size_cd":|"Pedido "counter_delivery": 1|
||}|||
||]|||
|}||||
|]||||
|}||||

al centro comercial",

"Indicaciones",

1", false,

}

### Ejemplo respuesta de petición 81 líneas

{

|"_id":||"5dec2e6f5224e10015202540",||
|---|---|---|---|
||"created_at":||"2019-12-07T17:57:51.558Z",|
|"address":] }, },|"Cra. "secondary_address": "sender_phone": "sender_country_code": "origin_geojson": "type": "coordinates": -74.108103, 4.653659 "status_cd": "estimated_cost": "subunits": "COP" "iso": "trv_distance_str":|68b { "Point", [ "requested_service_type_id": 0, { 490000,|#24c-39", "Diagonal a "3111234009", "57", "-",|
|"driver":|null, "served_vehicle": "relaunched_to_id": "scheduled_at": "original_booking_id": "relaunched_to_id": "pickup_validation_code":|null, "estimated_traveled_distance": null,|null, null, null, "116237",|
|"stops": {|[ "customer": "name": "phone": "email":|{ "Cliente", "country_code":|"57", "30112345678", "docs@picap.co"|

la panadería",

"5c71b03a58b9ba10fa6393cf",

5261,

https://docs.picap.io/index.html#introducci-n 8/68

|},|||||
|---|---|---|---|---|
||"address": "secondary_address": "address_geojson": "type": "coordinates": -74.085727, 4.695382|"Titan", { "Point", [|"Diagonal|al|
|]|||||
|},|"finished": "is_return_stop": "packages":|false, [|false,||
|{|"_id": "iso":|"indications": "declared_value": "subunits": "COP"|"5dec2e6f5224e10015202542", "My { 210000,|indications",|
||}, "reference": "size_cd": "status_cd": "events":|"counter_delivery": 1, 0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141",|false, null, null, null,|
||{|"_id": "created_at": "status_cd":|1|"60595443ac1b98008a402b9c",|
||}||||
||],|"has_retry_attempt": "relaunched_to_id": "validation_code":|null|false, null,|
|}|||||
|]|||||
|}|||||
|]|||||

centro comercial",

"[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"),

null,

"2021-03-23T02:36:51.838Z",

}

Ejemplo cuerpo de petición para un pedido contra entrega con valor a recaudar 46 líneas

{

|"booking":{|||||
|---|---|---|---|---|
||"address": "secondary_address":|"Cra. 61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|-74.108101, "sender_phone": "sender_country_code": "client_identification": "return_to_origin": "scheduled_at": "stops":[|"requested_service_type_id": "requires_a_driver_with_base_money":|"3111234009", "57", false,|"2021-01-28T01:59:03+00:00",|
|{|"address": "lat":|"Titan", "secondary_address": 4.695382,||"Diagonal al|

panadería",

"5a957e248af945001fbe678b", "5c71b03a58b9ba10fa6393cf",

false,

centro comercial",

https://docs.picap.io/index.html#introducci-n 9/68

||"lon":|-74.085727,||
|---|---|---|---|
||"customer": "name": "phone": "email":|{ "country_code":|"Cliente", "57", "30112345678", "docs@picap.co"|
||}, "packages":[|||
||{|"indications":|{"declared_value": "sub_units": 210000, "COP" "currency":|
||},|"reference":|"Pedido "counter_delivery": "collected_value": { 200000, "sub_units": "currency": "COP"|
||},|"size_cd":|1|
||}|||
||]|||
|}||||
|]||||
|}||||

"Indicaciones",

1", true,

}

Ejemplo respuesta de petición de un pedido contra entrega con valor a recaudar 80 líneas

{

|"_id":||"5dec2e6f5224e10015202540",||
|---|---|---|---|
||"created_at":||"2019-12-07T17:57:51.558Z",|
|"address":] }, },|"Cra. "secondary_address": "sender_phone": "sender_country_code": "origin_geojson": "type": "coordinates": -74.108103, 4.653659 "status_cd": "estimated_cost": "subunits": "COP" "iso": "trv_distance_str":|68b { "Point", [ "requested_service_type_id": 0, { 490000,|#24c-39", "Diagonal a "3111234009", "57", "-",|
|"driver":|null, "served_vehicle": "relaunched_to_id": "scheduled_at": "original_booking_id": "pickup_validation_code":|null, "estimated_traveled_distance": null,|null, null, "116237",|
|"stops": {|[ "customer": "name": "phone": "email":|{ "Cliente", "country_code":|"57", "30112345678", "docs@picap.co"|
||},|||

la panadería",

"5c71b03a58b9ba10fa6393cf",

5261,

https://docs.picap.io/index.html#introducci-n 10/68

||"address":|"Titan",|||
|---|---|---|---|---|
|] }, {|"secondary_address": "address_geojson": "type": "coordinates": -74.085727, 4.695382 "finished": "is_return_stop": "packages": "_id": "iso":|{ "Point", [ false, [ "indications": "declared_value": "subunits": "COP"|"Diagonal false, "5dec2e6f5224e10015202542", "My { 210000,|al indications",|
||}, "reference": "size_cd": "status_cd": "events":|"counter_delivery": 1, 0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141",|true, null, null, null,|
||{|"_id": "created_at": "status_cd":|1|"60595443ac1b98008a402b9c",|
||}||||
|}] }]|],|"has_retry_attempt": "relaunched_to_id": "validation_code":|null|false, null,|

centro comercial",

"[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"),

null,

"2021-03-23T02:36:51.838Z",

}

Ejemplo cuerpo de petición para un pedido con conductor que requiere base 46 líneas

{

|"booking":{|||||
|---|---|---|---|---|
||"Cra. "address": "secondary_address":|61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|-74.108101, "sender_phone": "sender_country_code": "client_identification": "return_to_origin": "money_to_pay_for_package": "sub_units": "currency":|"requested_service_type_id": "requires_a_driver_with_base_money": 1500000, "COP"|"3111234009", "57", false,|{|
|},|"scheduled_at":|||"2021-01-28T01:59:03+00:00",|
|"stops":[|||||
|{|||||

panadería",

"5a957e248af945001fbe678b", "5c71b03a58b9ba10fa6393cf",

true,

https://docs.picap.io/index.html#introducci-n 11/68

||"address":||"Titan",|
|---|---|---|---|
||"lat": "lon":|"secondary_address": 4.695382, -74.085727, {"customer": "name": "country_code": "phone": "email":|"Diagonal "Cliente", "57", "30112345678", "docs@picap.co"|
||},|"packages":[||
||{|"indications":|"declared_value": { "sub_units": 210000, "COP" "currency":|
|||}, "reference": "size_cd":|"Pedido "counter_delivery": 1|
||}|||
||]|||
|}||||
|]||||
|}||||

al centro comercial",

"Indicaciones",

1", false,

}

Ejemplo respuesta de petición para un pedido con conductor que requiere base 85 líneas

{

|"_id":||"5dec2e6f5224e10015202540",|||
|---|---|---|---|---|
||"created_at":||"2019-12-07T17:57:51.558Z",||
|"address":] }, },|"Cra. "secondary_address": "sender_phone": "sender_country_code": "origin_geojson": "type": "coordinates": -74.108103, 4.653659 "requested_service_type_id": "status_cd": 0, "estimated_cost": "subunits": "iso": "COP" "trv_distance_str":|68b { "Point", [ { 490000,|#24c-39", "Diagonal "3111234009", "57", "-",|a la|
|"driver": },|null, "served_vehicle": "relaunched_to_id": "scheduled_at": "original_booking_id": "pickup_validation_code": "money_to_pay_for_package": "subunits": "iso": "COP"|null, "estimated_traveled_distance": null, "requires_a_driver_with_base_money": 1500000,|null, null, {|5261, "116237",|
|"stops": {|[ "customer": "name":|{ "Cliente",|||

panadería",

"5c71b03a58b9ba10fa6393cf",

true,

https://docs.picap.io/index.html#introducci-n 12/68

||"country_code":|"57",|||
|---|---|---|---|---|
|},] }, {|"phone": "email": "address": "secondary_address": "address_geojson": "type": "coordinates": -74.085727, 4.695382 "finished": "is_return_stop": "packages": "_id": "iso":|"30112345678", "docs@picap.co" "Titan", { "Point", [ false, [ "indications": "declared_value": "subunits": "COP"|"Diagonal false, "5dec2e6f5224e10015202542", "My { 210000,|al indications",|
||}, "reference": "size_cd": "status_cd": "events":|"counter_delivery": 1, 0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141",|false, null, null, null,|
||{|"_id": "created_at": "status_cd":|1|"60595443ac1b98008a402b9c",|
||}||||
|}] }]|],|"has_retry_attempt": "relaunched_to_id": "validation_code":|null|false, null,|

centro comercial",

"[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"),

null,

"2021-03-23T02:36:51.838Z",

}

Este servicio crea un nuevo pedido con un listado de paquetes a ser entregados en un grupo de paradas especificadas por el usuario.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/bookings](https://turing.thetrancon.com/api/third/bookings)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

address String Dirección del lugar de origen donde van a ser recogidos todos los paquetes

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 13/68

|Parámetro|Tipo|Descripción|
|---|---|---|
|secondary_address|String|Información complementaria del lugar de origen donde van a ser recogidos todos los paquetes (Opcional)|
|lat|Float|Latitud del lugar de origen donde van a ser recogidos todos los paquetes|
|lon|Float|Longitud del lugar de origen donde van a ser recogidos todos los paquetes|
|sender_phone|String|Se emplea cuando la entrega es coordinada por un tercero quien es el responsable de entregar el producto al repartidor en el punto de origen, de esta manera el conductor y responsable se pueden comunicar directamente. (Opcional)|
|sender_country_code|String|Código de área para el sender phone. (Opcional)|
|client_identification|String|Token adicional que identifica los servicios cómo pertenecientes a un cliente. (Opcional)|
|requested_service_type_id|String|ID del tipo de servicio a ser solicitado. Para mensajería se utiliza 5c71b03a58b9ba10f a6393cf. Si requieres un vehículo de carga, consulta el ID en la sección Servicios de carga.|
|return_to_origin|Boolean|Determina si el conductor debe volver al lugar de origen una vez finalizadas las entregas|
|requires_a_driver_with_base_money|Boolean|Determina si para el servicio se requiere un conductor con base de dinero igual o menor a la suma del valor declarado total de todos los paquetes|
|money_to_pay_for_package|Hash|Indica el dinero base requerido al conductor para tomar el servicio. Este campo debe ir cuando requires_a_driver_with_base_money es true. Se envía como un Hash con el monto en centavos ( sub_units) y el código de moneda ( currency).|
|scheduled_at|Date as string|Si el pedido no es express, este atributo determina la fecha y hora en que se debe empezar a buscar conductores. El formato de la fecha debe ser ISO 8601. (Opcional)|
|stops|Array|Listado de paradas donde van a ser entregados los paquetes|
|city_code|String|En caso de no especificar lat y lon Picap hará su mejor esfuerzo para realizar un proceso de geocode sobre el campo address, para eso es necesario especificar el código de la ciudad a la que pertenece la dirección proporcionada. Los posibles códigos disponibles en el momento son ‘bogota’, ‘medellin’, ‘barranquilla’, ‘cali’, ‘bucaramanga’ y ‘guatemala’. (Opcional)|
|cost_center_id|String|Identificador del centro de costo al que pertenece el pedido. Para conocer los centros de costo, consulta la sección mis centros de costo y utiliza el campo _id de cada registro. (Opcional)|
|requires_parking_fee|Boolean|Indica si el servicio incluye un valor adicional como bonificación para el conductor, por ejemplo para cubrir gastos de parqueo. Para utilizarlo, la tarifa debe estar previamente configurada en tu cuenta. Envía este campo en true cuando aplique. (Opcional)|
|requires_service_assistant_fare|Boolean|Indica si el servicio requiere un auxiliar. Si necesitas apoyo adicional durante la entrega, envía este campo en true. Ten en cuenta que aplica únicamente para servicios de carga y requiere que la tarifa de auxiliar esté previamente configurada en tu cuenta. (Opcional)|

**PARÁMETROS DE UNA PARADA**

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 14/68

### Parámetro Tipo Descripción

address String Dirección del lugar de destino donde va a ser entregado un grupo de paquetes

Información adicional a la dirección del lugar de destino donde va a ser entregado un grupo de secondary_address String paquetes (Opcional)

lat Float Latitud del lugar de destino donde va a ser entregado un grupo de paquetes

lon Float Longitud del lugar de destino donde va a ser entregado un grupo de paquetes

customer Object Cliente que recibe los paquetes (Opcional)

packages Array Listado de paquetes que van a ser entregados en la parada

**PARÁMETROS DEL CLIENTE**

### Parámetro Tipo Descripción

name String Nombre del cliente

email String Email del cliente

country_code String Código de teléfono del cliente

phone String Teléfono del cliente

 En caso de no enviar lat y lon para una parada Picap hará su mejor esfuerzo para realizar un proceso de geocode sobre el campo address, para eso es necesario especificar el código de la ciudad a la que pertenece la dirección proporcionada con el campo city_code mencionado anteriormente en los parámetros de la petición.

**PARÁMETROS DE UN PAQUETE**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|indications|String|Indicaciones de entrega del paquete|
|declared_value|Hash|Valor declarado del paquete en centavos y con un cunrrency especificado|
|reference|String|Número de pedido del paquete|
|counter_delivery|Boolean|Determina si el pago del paquete es a contra entrega Campo obligatorio si el counter_delivery es true, nos indica cual es el valor que debe recaudar el|
|collected_value|Hash|conductor del paquete (en centavos y con un currency especificado) Si el counter delivery es false, el collected_value se manda en null|
|size_cd|Integer|Identificador del tamaño aproximado del paquete|

 Los campos de la respuesta del servicio son explicados en el detalle de un pedido

## Detalle de un pedido

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 15/68

Ejemplo respuesta petición de un pedido buscando conductor 79 líneas

{

|"_id":||"5dec2e6f5224e10015202540",|||
|---|---|---|---|---|
||"created_at":||"2019-12-07T17:57:51.558Z",||
|"address":] }, },|"Cra. "secondary_address": "origin_geojson": "type": "coordinates": -74.108103, 4.653659 "requested_service_type_id": "scheduled_at": 0, "status_cd": "estimated_cost": "subunits": "COP" "iso": "trv_distance_str":|68b { "Point", [ null, { 490000, "-",|#24c-39", "Diagonal|a la panadería",|
|"driver":|null, "served_vehicle": "relaunched_to_id": "original_booking_id": "relaunched_to_id": "pickup_validation_code":|null, "estimated_traveled_distance":|null, null, null,|5261, "116237",|
|"stops": {|[ "customer": "name": "phone": "email":|{ "Cliente", "country_code":|"57", "30112345678", "docs@picap.co"||
||}, "address": "type":|"Titan", "secondary_address": "address_geojson": "Point", "coordinates": -74.085727, 4.695382|{ [|"Diagonal al|
||]||||
||}, "finished": "packages":|false, "is_return_stop": [|false,||
||{|"_id": "indications": "declared_value": "subunits": "iso":|"My "COP"|"5dec2e6f5224e10015202542", indications", { 210000,|
||},|"reference": "counter_delivery": "size_cd": "status_cd": "tracking_link": "events":|1, 0, "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141", false, null, null, null,|
|||{|||

"5c71b03a58b9ba10fa6393cf",

centro comercial",

"https://pibox.app/tracking/5dec2e6f5224e10015202542",

null,

https://docs.picap.io/index.html#introducci-n 16/68

"60595443ac1b98008a402b9c",

|||"_id": "created_at": 1 "status_cd":|
|---|---|---|
||}],|"has_retry_attempt": "relaunched_to_id": null, null "validation_code":|
||}||
|]|||
|}|||
|]|||

"2021-03-23T02:36:51.838Z",

false,

}

Ejemplo respuesta petición de un pedido finalizado 96 líneas

{

|"_id":||"5dec38c421ec510016081bc4",||
|---|---|---|---|
|"created_at":|||"2019-12-07T18:41:57.439Z",|
|"address":|"Cra. "secondary_address": "origin_geojson":|68b {|#24c-39", "Diagonal a|
|"type":] },|"Point", "coordinates": -74.108103, 4.653659 "requested_service_type_id":|[||
|"scheduled_at":||null,||
|"status_cd":|4, "trv_distance_str":|"0.1|kms",|
|"driver":|{|||
|"name":|"Juan|Perez",||
|"phone": },|"served_vehicle":|"30123456789" {||
|"plates":||"ABC123",||
|"color":|"Gris",|||
|"make":] }, } },|"Yamaha", "reference": "loc_geojson": "type": "coordinates": -74.1080569, 4.6537175 "tracking_data": "unit_number": "latitude": "longitude": "timestamp": "relaunched_to_id": "estimated_traveled_distance":|"BC 123", { "Point", [ { null,|"ABC123", 4.6537175, -74.1080569, "2025-11-24T14:28:00.755Z"|
|"final_cost":|{ "subunits":|490000,||
|"iso": },|"COP"|||
|"stops": {|[ "address": "secondary_address":|"Titan",|"Diagonal|

la panadería",

"5c71b03a58b9ba10fa6393cf",

5261,

al centro comercial",

https://docs.picap.io/index.html#introducci-n 17/68

||"address_geojson":|{||
|---|---|---|---|
|] },|"type": "coordinates": -74.085727, 4.695382 "customer": "name": "country_code": "phone":|"Point", [ { "Cliente", "57", "30112345678",||
|},|"email": "finished": "is_return_stop":|"docs@picap.co" true,|false,|
|{|"packages": "_id": "iso":|[ "indications": "declared_value": "subunits": "COP"|"5dec38c421ec510016081bc6", "My indications", { 210000,|
||}, "reference": "status_cd": "size_cd": "events":|"counter_delivery": 2, 0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141", false, null,|
||{|"_id": "created_at": "status_cd":|"60595443ac1b98008a402b9c", 1|
||}|||
||],|"has_retry_attempt":|false,|
|}] }]||"relaunched_to_id":|null|

"[https://pibox.app/tracking/5dec38c421ec510016081bc6"](https://pibox.app/tracking/5dec38c421ec510016081bc6"), "[https://s3.amazonaws.com/static.picap.co/packages/6102d23e9d528c001d8a18xe7/pickup_photos/1627574913231.jpg"](https://s3.amazonaws.com/static.picap.co/packages/6102d23e9d528c001d8a18xe7/pickup_photos/1627574913231.jpg"), "[https://s3.amazonaws.com/static.picap.co/packages/6102d23e9d528c001d8a18xe7/deliver_photos/1627574971466.jpg"](https://s3.amazonaws.com/static.picap.co/packages/6102d23e9d528c001d8a18xe7/deliver_photos/1627574971466.jpg"), null,

"2021-03-23T02:36:51.838Z",

}

Ejemplo respuesta petición de un pedido buscando conductor con valor a recaudar 78 líneas

{

|"_id":||"5dec2e6f5224e10015202540",|
|---|---|---|
|]|"created_at": "address": "secondary_address": "origin_geojson": "type": "coordinates": 4.653659|"2019-12-07T17:57:51.558Z", "Cra. 68b #24c-39", "Diagonal { "Point", [ -74.108103,|
|},|"scheduled_at": "status_cd": "estimated_cost":|"requested_service_type_id": null, 0, {|

a la panadería",

"5c71b03a58b9ba10fa6393cf",

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 18/68

||"subunits":|490000,|||
|---|---|---|---|---|
|"iso": },|"COP" "trv_distance_str":|"-",|||
|"driver":|null, "served_vehicle": "relaunched_to_id": "estimated_traveled_distance": "original_booking_id": "pickup_validation_code":|null, null, null,|null,|5261,|
|"stops": { },|[ "customer": "name": "country_code": "phone": "email": "address": "secondary_address": "address_geojson": "type": "coordinates": 4.695382|{ "Cliente", "57", "30112345678", "docs@picap.co" "Titan", { "Point", [ -74.085727,|"Diagonal|al|
||]||||
|},|"finished": "is_return_stop": "packages":|false, [|false,||
||{ "_id":|"indications": "declared_value": "subunits": "COP" "iso":|"5dec2e6f5224e10015202542", "My { 210000,|indications",|
||}, "size_cd": "events":|"reference": "counter_delivery": 1, 0, "status_cd": "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141",|true, null, null, null,|
||{|"_id": "status_cd":|"created_at":|"60595443ac1b98008a402b9c", 1|
||}||||
||],|"has_retry_attempt": "relaunched_to_id": "validation_code":|null|false, null,|
||}||||
|]|||||
|}|||||
|]|||||

centro comercial",

"[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"),

null,

"2021-03-23T02:36:51.838Z",

}

Este servicio retorna el detalle de un pedido donde se especifica la información mas relevante de este.

**HTTP REQUEST**

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 19/68

GET [https://turing.thetrancon.com/api/third/bookings/{BOOKING_ID}](https://turing.thetrancon.com/api/third/bookings/{BOOKING_ID})

 BOOKING_ID hace referencia al identificador único retornado al crear un pedido

**HEADERS**

Content-Type:application/json; charset=utf-8

**ATRIBUTOS DE UN PEDIDO**

|Atributo|Tipo|Descripción|
|---|---|---|
|id|String|Identificador único del pedido|
|created_at|String|Fecha de creación del pedido en formato UTC|
|address|String|Dirección del lugar de origen donde se recogen todos los paquetes|
|secondary_address|String|Información complementaria del lugar de origen donde van a ser recogidos todos los paquetes (Opcional)|
|sender_phone|String|Se emplea cuando la entrega es coordinada por un tercero quien es el responsable de entregar el producto al repartidor en el punto de origen, de esta manera el conductor y responsable se pueden comunicar directamente. (Opcional)|
|sender_country_code|String|Código de área para el sender phone. (Opcional)|
|origin_geojson|Hash|Objeto que contiene las coordenadas (latitud, longitud) del lugar de origen|
|requested_service_type_id|String|ID del tipo de servicio a ser solicitado. Para mensajería es utilizado 5c71b03a58b9ba10fa6393cf|
|status_cd|Integer|Identificador del estado del pedido|
|estimated_cost|Hash|Costo estimado del pedido constituido por un entero representando el valor en centavos (sub_units) y un String representando su código de moneda (currency). Solo visible cuando el pedido no ha sido finalizado|
|final_cost|Hash|Costo final del pedido constituido por un entero representando el valor en centavos (sub_units) y un String representando su código de moneda (currency). Solo visible cuando el pedido ha sido finalizado|
|trv_distance_str|String|Distancia total recorrida por el conductor del pedido una vez ha sido finalizado|
|driver|Hash|{:name=>“Nombre del conductor”, :phone=>“Teléfono del conductor”}|
|served_vehicle|Hash|Información del vehículo que tomo el pedido|
|relaunched_to_id|String|Identificador único del pedido nuevo que fue generado en caso de que el pedido actual fuera cancelado por el conductor|
|estimated_traveled_distance|Integer|Distancia total estimada del recorrido en metros|
|stops|Array|Listado de paradas donde son entregados los paquetes|
|original_booking_id|String|Identificador único del pedido original, antes de haber sido relanzado|
|pickup_validation_code|String|Código de validación que se debe compartir al conductor en el origen del servicio|

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 20/68

 El estimated_cost y final_cost es un Hash constituido por un entero representando el valor en centavos (sub_units) y un String representando su código de moneda (iso)

 El costo y distancia estimados son valores calculados a partir de la información inicial del servicio, sin embargo, pueden diferir del costo final y distancia total dadas las circunstancias reales del pedido

 En caso de que el servicio sea tomado por un conductor y sucesivamente cancelado por el mismo, se procederá a finalizar el pedido en estado cancelado por conductor y un nuevo pedido con las mismas características pero identificador único diferente será creado. Este nuevo identificador único será almacenado en el atributo relaunched_to_id

**ATRIBUTOS DEL VEHÍCULO**

### Atributo Tipo Descripción

plates String Placas del vehículo

color String Color del vehículo

make String Marca del vehículo

reference String Referencia del vehículo

Objeto que contiene las coordenadas (latitud, longitud) de la ultima posición conocida del loc_geojson Hash vehículo

tracking_data Hash Datos de rastreo GPS

tracking_data.unit_number String Identificador de unidad

tracking_data.latitude Float Coordenada de latitud

tracking_data.longitude Float Coordenada de longitud

tracking_data.timestamp DateTime Fecha y hora de última actualización GPS

**ATRIBUTOS DEL CONDUCTOR**

### Atributo Tipo Descripción

name String Nombre del conductor

phone String Teléfono del conductor

**ATRIBUTOS DE UNA PARADA**

### Atributo Tipo Descripción

address String Dirección del lugar de destino donde es entregado un grupo de paquetes

Información adicional a la dirección del lugar de destino donde va a ser entregado un grupo de secondary_address String paquetes (Opcional)

Objeto que contiene las coordenadas (latitud, longitud) del lugar de destino donde es entregado un address_geojson Hash grupo de paquetes

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 21/68

### Atributo Tipo Descripción

finished Boolean Determina si una parada ya ha sido completada

is_return_stop Boolean Determina si una parada representa la vuelta a origen del conductor

packages Array Listado de paquetes que van a son entregados en la parada

**ATRIBUTOS DE UN PAQUETE**

|Atributo|Tipo|Descripción|
|---|---|---|
|id|String|Identificador único del paquete|
|status_cd|Integer|Estado actual del paquete|
|indications|String|Indicaciones de entrega del paquete|
|declared_value|Hash|Valor declarado del paquete en centavos y con un cunrrency especificado|
|reference|String|Número de pedido del paquete|
|counter_delivery|Boolean|Determina si el pago del paquete es a contra entrega|
|size_cd|Integer|Identificador del tamaño aproximado del paquete|
|tracking_link|String|Link de seguimiento para el paquete|
|picked_up_photo_url|String|Link de evidencia de cuando se recogio el paquete (Se debe habilitar para poder ver el url)|
|delivered_photo_url|String|Link de evidencia de cuando se entrego el paquete (Se debe habilitar para poder ver el url)|
|canceled_pickup_reason_cd|Integer|Subestado razón por la cual no se pudo recoger el paquete|
|not_received_reason_cd|Integer|Subestado razón por las cuale no se pudo entregar el paquete|
|events|Array|Histórico de los eventos generados para un paquete|
|has_retry_attempt|Boolean|Determina si el paquete tendra un segundo intento de entrega en el futuro.|
|relaunched_to_id|String|En caso de que el paquete sea tomado por un conductor y sucesivamente cancelado por el mismo, se procederá a marcar el paquete en estado cancelado y un nuevo paquete con las mismas características pero identificador único diferente será creado. Este nuevo identificador único será almacenado en el atributo relaunched_to_id|
|validation_code|String|Código de validación que se debe compartir al conductor en cada entrega, si la empresa tiene la opción habilitada|

**ATRIBUTOS DE UN EVENTO GENERADO A UN PAQUETE**

### Descripción

|Atributo|Tipo||
|---|---|---|
|_id|String|Identificador único del evento|
|created_at|Integer|Fecha y hora en la que se generó el evento en UTC|
|status_cd [https://docs.picap.io/index.html#introducci-n|Integer|Estado](https://docs.picap.io/index.html#introducci-n|Integer|Estado) que fue generado|

22/68

 El declared_value es un Hash constituido por un entero representando el valor declarado en centavos (sub_units) y un String representando su código de moneda (currency)

## Cancelar un pedido

### Ejemplo respuesta de petición 75 líneas

{

|"_id":||"5dec2e6f5224e10015202540",||
|---|---|---|---|
||"created_at":||"2019-12-07T17:57:51.558Z",|
|"address":] }, },|"Cra. "secondary_address": "origin_geojson": "type": "coordinates": -74.108103, 4.653659 "requested_service_type_id": "scheduled_at": "status_cd": "estimated_cost": "subunits": "iso": "COP" "trv_distance_str":|68b { "Point", [ null, 102, { 490000,|#24c-39", "Diagonal a "-",|
|"driver":|null, "served_vehicle": "relaunched_to_id":|null, "estimated_traveled_distance":|null,|
|"stops": {|[ "address": "type":|"Titan", "secondary_address": "address_geojson": "Point", "coordinates": -74.085727, 4.695382|"Diagonal { [|
||]|||
||}, "customer": "name": "phone": "email":|{ "Cliente", "country_code":|"57", "30112345678", "docs@picap.co"|
||}, "finished": "packages":|false, "is_return_stop": [|false,|
||{|"_id": "indications": "declared_value": "subunits": "iso":|"5dec2e6f5224e10015202542", "My { 210000, "COP"|
||},|"reference": "counter_delivery":|"12124141",|

la panadería",

"5c71b03a58b9ba10fa6393cf",

5261,

al centro comercial",

indications",

false,

https://docs.picap.io/index.html#introducci-n 23/68

||"size_cd":|1,||
|---|---|---|---|
||"events":|"status_cd": 0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|null, null, null,|
||{|"_id": "created_at": "status_cd":|"60595443ac1b98008a402b9c", 1|
||}|||
||],|"has_retry_attempt": "relaunched_to_id":|false, null|
||}|||
|]||||
|}||||
|]||||

"[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"),

null,

"2021-03-23T02:36:51.838Z",

}

Este servicio cancela un pedido activo por parte del usuario.

**HTTP REQUEST**

PATCH [https://turing.thetrancon.com/api/third/bookings/{BOOKING_ID}/cancel](https://turing.thetrancon.com/api/third/bookings/{BOOKING_ID}/cancel)

 BOOKING_ID hace referencia al identificador único retornado al crear un pedido

**HEADERS**

Content-Type:application/json; charset=utf-8

 Los campos de la respuesta del servicio son explicados en el detalle de un pedido

## Listar todos mis pedidos

### Ejemplo respuesta de petición 85 líneas

{

|"page":|1,|||
|---|---|---|---|
|"pages":|1,|||
|"data": {|[ "_id": "created_at": "address": "type":|"Cra. "secondary_address": "origin_geojson": "coordinates": -74.108103, 4.653659|"5dec2e6f5224e10015202540", 68b { "Point", [|
||]|||
||},|||

"2019-12-07T17:57:51.558Z", #24c-39", "Diagonal a la panadería",

https://docs.picap.io/index.html#introducci-n 24/68

"5c71b03a58b9ba10fa6393cf",

||"requested_service_type_id":||||
|---|---|---|---|---|
||"scheduled_at": 0, "status_cd": "estimated_cost": "subunits": "COP" "iso":|null, { 490000,|||
|},|"trv_distance_str":|"-",|||
|"driver":|null, "served_vehicle": "relaunched_to_id": "original_booking_id": "relaunched_to_id": "pickup_validation_code":|null, "estimated_traveled_distance":|null, null, null,|5261, "116237",|
|"stops":|[||||
|{|"address": "type":|"Titan", "secondary_address": "address_geojson": "Point", "coordinates": -74.085727, 4.695382|{ [|"Diagonal al|
||]||||
||}, "customer": "name": "phone": "email":|{ "Cliente", "country_code":|"57", "30112345678", "docs@picap.co"||
||}, "finished": "packages":|false, "is_return_stop": [|false,||
||{|"_id": "indications": "declared_value": "subunits": "iso":|"My "COP"|"5dec2e6f5224e10015202542", indications", { 210000,|
||},|"reference": "counter_delivery": "size_cd": "status_cd": "tracking_link": "events":|1, 0, "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd": [|"12124141", false, null, null, null,|
|||{|"_id": "created_at": "status_cd":|"60595443ac1b98008a402b9c", 1|
|||}|||
||],|"has_retry_attempt": "relaunched_to_id": "validation_code":||false, null, null|
||}||||
||]||||
|}|||||
|]|||||
|}|||||

centro comercial",

"https://pibox.app/tracking/5dec2e6f5224e10015202542",

null,

"2021-03-23T02:36:51.838Z",

https://docs.picap.io/index.html#introducci-n 25/68

||5/8/26, 10:39 p.m.|||Picap Docs|
|---|---|---|---|---|
||]||||
|}|||||
|GET HEADERS page page pages data [|HTTP REQUEST PARÁMETROS QUERY Parámetro status_cd ini_date end_date ATRIBUTOS DEL LISTADO Atributo|Content-Type:application/json; Tipo Integer Integer Array|Tipo Integer Integer String String Ejemplo respuesta de petición 19 líneas|Este servicio lista todos los pedidos de un usuario de forma paginada. Por medio de parámetros query es posible filtrar el listado por estado para lograr una búsqueda detallada en caso de ser necesario. https://turing.thetrancon.com/api/third/bookings charset=utf-8 Descripción Página del listado de pedidos requerida Identificador del estado del pedido por el cual se quiere filtrar el listado (Opcional) Fecha inicial por la cual se quiere filtrar el listado (Opcional) Fecha final por la cual se quiere filtrar el estado (Opcional) Descripción Página actual del listado de pedidos Número total de páginas del listado de pedidos Listado de pedidos de la página actual  Cada página contiene máximo 10 entradas de datos  Los campos de la respuesta del servicio son explicados en el detalle de un pedido Listar todos mis centros de costos|
||{ "_id": "name":|"archived": "company_id": "created_at": "updated_at":|false, "Producción",|"626fe30a5b97fd001eae7161", "61c34efacedfc8001f523dfd", "2022-05-02T13:56:26.044Z", "2022-05-02T13:56:26.044Z"|
||},||https://docs.picap.io/index.html#introducci-n|26/68|

{ "_id": "626fe30f5b97fd001eae7164", "archived": false, "company_id": "61c34efacedfc8001f523dfd", "created_at": "2022-05-02T13:56:31.967Z", "name": "Compras", "updated_at": "2022-05-02T13:56:31.967Z" }]

Este servicio lista todos los centros de costos no archivados de una compañía.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/bookings/cost_centers](https://turing.thetrancon.com/api/third/bookings/cost_centers)

**HEADERS**

Content-Type:application/json; charset=utf-8

## Servicios de carga

A continuación se listan los tipos de carga disponibles. Al momento de crear un pedido, debes especificar el tipo de vehículo de carga que necesitas enviando su identificador en el campo requested_service_type_id.

|Tipo de carga|Service type id|
|---|---|
|Carga Carry|62e2ae08790a6a0004ab0a3b|
|Carga Trailer|62e2ae08790a6a0004ab0a3f|
|Carga NPR|62e2ae08790a6a0004ab0a3e|
|Carga NKR|62e2ae08790a6a0004ab0a3d|
|Carga NHR|62e2ae08790a6a0004ab0a3c|
|Carga moto-vagon|62e2ae08790a6a0004ab0a3|
|Carga NHR Refrigerada|6654a335f8f2586515b6bb51|
|Carro mensajería|6453e0394a73fe93b95e7fbe|

## Sedes

### Ejemplo respuesta de petición 23 líneas

{

|"page":|"1",|
|---|---|
|"pages":|1,|
|"data": {|[ "_id": "name":|

"668c7a760512060021d5db91", "Pibox principal",

https://docs.picap.io/index.html#introducci-n 27/68

"teusaquillo",

||"address":|
|---|---|
||"lat": "lon": "city_id":|
|},||
|{|"_id": "name": "address": "lat": "lon": "city_id":|
|}||
|]||

4.582604251055874, -74.1913879796183, "62bdcc7e3a8453369ccc136e" "66d70f31c113776e654376f7", "Bodega", "KR 8 75 19",
4.658379727455184, -74.05439834896443, "5924ac03496a9d56d364bd1b"
}

Este servicio lista las sedes de una compañía. Si deseas que un pedido quede asociado a una sede específica, las coordenadas de origen del pedido deben coincidir exactamente con las de la sede. Consulta este endpoint para obtener los valores de lat y lon de cada sede y úsalos en el campo correspondiente al crear un pedido, si es el caso.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/company_areas?page=1&per_page=10](https://turing.thetrancon.com/api/third/company_areas?page=1&per_page=10)

**HEADERS**

Content-Type:application/json; charset=utf-8

# Paquetes

## Enrutar listado de paquetes

### Ejemplo cuerpo de petición 41 líneas

{

||"routing_group":|{|||
|---|---|---|---|---|
||"address":|"Cra. 61|#23z-42",||
|"lat":|4.653652,||||
|"lon": {|"deliveries": "address": "lat": "lon": "package":|-74.108101, "requested_service_type_id": [ 4.695382, -74.085727, { "indications": "declared_value": "sub_units": "currency":|"Titan",|{ 210000, "COP"|
||},|"reference": "counter_delivery": "size_cd":|1|"Pedido|
||}||||
|},|||||
|{|"address": "lat": "lon":|4.692698, -74.086413,|"Titan|2",|

"5c71b03a58b9ba10fa6393cf",

"Indicaciones",

1", false,

https://docs.picap.io/index.html#introducci-n 28/68

"Indicaciones",

||"package":|{ "indications": {"declared_value": "sub_units": 200000, "COP" "currency":|
|---|---|---|
||}, "size_cd":|"reference": "Pedido "counter_delivery": 1|
||}||
|}|||
|]|||
|}|||

2", true,

}

### Ejemplo respuesta de petición

{ "booking_ids": [ "5dec4d1b21ec510019081c19"] }

Este servicio crea una serie de pedidos a partir de un listado de paquetes minimizando el número de entregas al agrupar las más cercanas.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/routing_groups](https://turing.thetrancon.com/api/third/routing_groups)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE UN GRUPO DE ENRUTAMIENTO**

### Parámetro Tipo Descripción

|address||String|Dirección del lugar de origen donde se deben recoger todos los paquetes|
|---|---|---|---|
|lat||Float|Latitud del lugar de origen donde se deben recoger todos los paquetes|
|lon||Float|Longitud del lugar de origen donde se deben recoger todos los paquetes|
|requested_service_type_id||String|ID del tipo de servicio a ser solicitado. Para mensajería es utilizado 5c71b03a58b9ba10fa6393cf|
|deliveries||Array|Listado de paquetes junto con la dirección donde deben ser recogidos|
|Atributo|Tipo|||
|booking_ids|Array|||

**ATRIBUTOS DE RESPUESTA A LA CREACIÓN DE UN GRUPO DE ENRUTAMIENTO**

### Descripción

Listado de todos los pedidos creados a partir del listado de paquetes

 La forma de especificar la información de un paquete es detallada en el servicio de crear un pedido

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 29/68

## Listar todos mis paquetes

### Ejemplo respuesta de petición 59 líneas

{ "page": 1, "pages": 1, "data": [ { "_id": "5d780ad5c149a449309dc004", "indications": "Indicaciones", "declared_value": { "subunits": 210000, "iso": "COP" }, "reference": "Pedido 2", "counter_delivery": false, "size_cd": 1, "status_cd": 0, "tracking_link": "https://pibox.app/tracking/5d780ad5c149a449309dc004", "picked_up_photo_url": null, "delivered_photo_url": null, "canceled_pickup_reason_cd": null, "not_received_reason_cd": null, "events": [ { "_id": "60595443ac1b98008a402b9c", "created_at": "2021-03-23T02:36:51.838Z", "status_cd": 1 }], "has_retry_attempt": false, "relaunched_to_id": null }, { "_id": "5d780ad2c149a449309dbffc", "indications": "Indicaciones", "declared_value": { "subunits": 210000, "iso": "COP" }, "reference": "Pedido 1", "counter_delivery": false, "size_cd": 1, "status_cd": 0, "tracking_link": "https://pibox.app/tracking/5d780ad2c149a449309dbffc", "picked_up_photo_url": null, "delivered_photo_url": null, "canceled_pickup_reason_cd": null, "not_received_reason_cd": null, "events": [ { "_id": "60595443ac1b98008a402b9c", "created_at": "2021-03-23T02:36:51.838Z", "status_cd": 1 }], "has_retry_attempt": false, "relaunched_to_id": null }] }

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 30/68

Este servicio lista todos los paquetes de un usuario de forma paginada. Por medio de parámetros query es posible filtrar el listado por estado para lograr una búsqueda detallada en caso de ser necesario.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/packages](https://turing.thetrancon.com/api/third/packages)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS QUERY**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|page|Integer|Página del listado de paquetes requerida|
|status_cd|Integer|Identificador del estado del paquete por el cual se quiere filtrar el listado (Opcional)|
|Atributo|Tipo||
|page|Integer|Página actual del listado de paquetes|
|pages|Integer|Número total de páginas del listado de paquetes|
|data|Array|Listado de paquetes de la página actual|

**ATRIBUTOS DEL LISTADO**

### Descripción

 Cada página contiene máximo 10 entradas de datos

 La forma de especificar la información de un paquete es detallada en el servicio de crear un pedido

## Detalle de un paquete

### Ejemplo respuesta de petición 27 líneas

{

|"_id":||"5d780ad2c149a449309dbffc",|
|---|---|---|
||"indications": "declared_value": "subunits":|"Indicaciones", { 210000,|
|"iso": },|"COP"||
|"reference":|"Pedido "counter_delivery":|1", false,|
|"size_cd":|1,||
|"status_cd":|0, "tracking_link": "picked_up_photo_url": "delivered_photo_url": "canceled_pickup_reason_cd": "not_received_reason_cd":|null, null, null,|
|"events": {|[ "_id":|"60595443ac1b98008a402b9c",|

"https://pibox.app/tracking/5d780ad2c149a449309dbffc",

null,

https://docs.picap.io/index.html#introducci-n 31/68

||5/8/26, 10:39 p.m.||||Picap Docs||
|---|---|---|---|---|---|---|
|||"created_at": "status_cd":|1|"2021-03-23T02:36:51.838Z",|||
||}||||||
||],|"has_retry_attempt":|false,||||
|}||"relaunched_to_id":|null||||
|GET HEADERS id|HTTP REQUEST indications declared_value reference size_cd|Content-Type:application/json; ATRIBUTOS DE UN PAQUETE Atributo counter_delivery|Tipo String String Hash String Boolean Integer representando su código de moneda (currency) [https://docs.picap.io/index.html#introducci-n|Este](https://docs.picap.io/index.html#introducci-n|Este) servicio retorna el detalle de un paquete donde se especifica la información mas relevante de este. [https://turing.thetrancon.com/api/third/packages/{PACKAGE_ID}](https://turing.thetrancon.com/api/third/packages/{PACKAGE_ID})  PACKAGE_ID hace referencia al identificador único retornado al crearse un paquete charset=utf-8 Identificador único del paquete Indicaciones de entrega del paquete Número de pedido del paquete Determina si el pago del paquete es a contra entrega Identificador del tamaño aproximado del paquete  Antes de integrar, valida con tu KAM (Key Account Manager) que tu compañía tenga habilitado el feature este acceso habilitado, los endpoints de Prepaquetes no funcionarán para tu compañía.  La autenticación se realiza mediante el token de sesión enviado como query param|Descripción Valor declarado del paquete en centavos y con un cunrrency especificado  El declared_value es un Hash constituido por un entero representando el valor declarado en centavos (sub_units) y un String Prepaquetes t (ej. ?t=<session_token>).  Los cambios de estado de un pre_paquete (incluida su agrupación en una ruta) generan también una notificación de webhook|delivery_routes. Sin pr 32/68|

epackage_updated. Ver la sección Webhooks — Actualización de un pre-paquete.

## Crear pre_paquetes

### Ejemplo cuerpo de petición 28 líneas

{ "pre_package": { "reference": "100000002", "indications": "Test002", "origin_secondary_addres": "", "end_secondary_address": "", "size_cd": 0, "counter_delivery": false, "collected_value": null, "origin_address": "Calle de la Concepción, El Santuario, Mexico City, CDMX, Mexico", "origin_lat": 19.3541687, "origin_lon":-99.092707, "end_address": "Metro Coyoacán-L3, Av. Universidad, Benito Juárez", "end_lat": 19.3614557, "end_lon":-99.17079319999999, "declared_value": { "cents": 1000000, "currency_iso": "MXN" }, "customer":{ "name": "Test002", "country_code": "52", "phone": "5510101002", "email": "vurquides+002@pibox.app" } } }

Ejemplo cuerpo de petición enviando solo dirección (sin coordenadas), resuelta por geocodificación 25 líneas

{ "pre_package": { "reference": "100000002", "indications": "Test002", "origin_secondary_addres": "", "end_secondary_address": "", "size_cd": 0, "counter_delivery": false, "collected_value": null, "origin_address": "Calle de la Concepción, El Santuario, Mexico City, CDMX, Mexico", "city_code": "cdmx", "end_address": "Metro Coyoacán-L3, Av. Universidad, Benito Juárez", "declared_value": { "cents": 1000000, "currency_iso": "MXN" }, "customer":{ "name": "Test002", "country_code": "52", "phone": "5510101002", "email": "vurquides+002@pibox.app" }

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 33/68

} }

 Si se envíaorigin_address / end_address sin sus respectivas coordenadas, el servicio geocodifica la dirección usando city_code y/o postal_code (y opcionalmente state_code) como referencia. city_code / state_code / postal_code aplican como referencia general para resolver tanto origin_address como end_address cuando falten coordenadas. Si no se envía ninguno de los dos, o la geocodificación falla, el servicio responde 422.

 En caso de no especificarlat y lon, Picap hará su mejor esfuerzo para realizar un proceso de geocode sobre el campo addres s; para eso es necesario especificar el código de la ciudad a la que pertenece la dirección proporcionada. Los posibles códigos disponibles en el momento son bogota, medellin, barranquilla, cali, bucaramanga y guatemala.

### Ejemplo respuesta de petición 44 líneas

{ "id": "6517220994ecb2650284d6ab", "prepackage_identification": "35347668-ba13-4355-b631-244b7b4f2895", "company_id": "5fff9eb162af100031caf969", "passenger_id": "6459596b6bc259003104ae09", "indications": "Test002", "declared_value": { "subunits": 1000000, "iso": "MXN" }, "collected_value": null, "reference": "100000002", "counter_delivery": false, "choosed_at": null, "size_cd": 0, "origin_address": "Calle de la Concepción, El Santuario, Mexico City, CDMX, Mexico", "origin_secondary_address": null, "origin_address_geojson": { "type": "Point", "coordinates": [ -99.092707,

19.3541687
] }, "end_address": "Metro Coyoacán-L3, Av. Universidad, Benito Juárez", "end_secondary_address": "", "end_address_geojson": { "type": "Point", "coordinates": [ -99.17079319999999,

19.3614557
] }, "customer_info": { "_id": "6517220994ecb2650284d6aa", "name": "Test002", "email": "vurquides+002@pibox.app", "country_code": "52", "phone": "5510101002", "fiscal_number": null },

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 34/68

"status": "pooled" }

Crea un nuevo paquete preestablecido. Si es exitoso, devuelve el paquete preestablecido creado en formato JSON. Si no es exitoso, devuelve un objeto JSON con detalles completos del error y un estado de 422 Entidad no procesable.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/pre_packages](https://turing.thetrancon.com/api/third/pre_packages)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE UN PRE_PAQUETE**

|Parámetro|Tipo||
|---|---|---|
|indications|String||
|reference|String||
|counter_delivery|String||
|origin_address|String||
|origin_secondary_address|String||
|origin_lat|Float||
|origin_lon|Float||
|end_address|String||
|end_secondary_address|String||
|end_lat|Float||
|end_lon|Float||
|city_code|String||
|state_code|String||
|postal_code|String||
|size_cd|String||
|payment_method_cd|String||
|requires_a_driver_with_base_money|Boolean||
|money_to_pay_for_package|Object||
|declared_value|String||

|||Descripción|
|---|---|---|
|||Indicaciones para el paquete. Referencia del paquete. Información de entrega contra reembolso. Dirección de origen. Dirección secundaria de origen. Latitud de origen. Requerida salvo que se resuelva por geocodificación. Longitud de origen. Requerida salvo que se resuelva por geocodificación. Dirección de destino. Dirección secundaria de destino. Latitud de destino. Requerida salvo que se resuelva por geocodificación. Longitud de destino. Requerida salvo que se resuelva por geocodificación. Código de ciudad usado como referencia para geocodificar origin_address / end_addr ess cuando no se envían coordenadas. Requerido (junto con o en vez de postal_co de ) en ese caso. Código de estado/departamento que refuerza la geocodificación por ciudad. Opcional. Código postal usado como referencia para geocodificar origin_address / end_address cuando no se envían coordenadas. Requerido (junto con o en vez de city_code) en ese caso. Tamaño del paquete. Código del método de pago. Opcional. Indica si el pedido requiere un conductor con dinero base. Opcional. Monto a pagar por el paquete (centavos y código de moneda). Opcional. Valor declarado del paquete (centavos y código de moneda).|

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 35/68

### Parámetro Tipo Descripción

collected_value String Valor recolectado del paquete (centavos y código de moneda).

Detalles del cliente (nombre, código de país, teléfono, correo electrónico, número customer Object fiscal).

**ATRIBUTOS DE RESPUESTA A LA CREACIÓN DE UN PRE_PAQUETE**

### Atributo Tipo Descripción

pre_package_id Object listado de pre_paquetes

 La forma de especificar la información de un pre_paquete es detallada en el servicio de crear un pedido

**ERRORES POSIBLES**

### Descripción

|Atributo||
|---|---|
|422|Addon delivery_routes no habilitado para la compañía.|
|422|La compañía del pasajero está inactiva.|
|422|No se envió el parámetro raíz pre_package.|
|422|Falló alguna validación del modelo (ej. campos requeridos faltantes).|
|422|Se envió una dirección sin coordenadas y sin city_code / postal_code de referencia.|
|422|No fue posible geocodificar la dirección enviada con la referencia dada.|

## Listar todos los pre_paquetes por empresa

Ejemplo respuesta de petición 91 líneas

{

|"page":|1,|||
|---|---|---|---|
|"pages":|1,|||
|"data": {|[ "id": "company_id": "passenger_id": "indications": "iso":|"prepackage_identification": "declared_value": "subunits": "MXN"|"6517014d94ecb223635b40d5", "5fff9eb162af100031caf969", "6459596b6bc259003104ae09", "Test001", { 1000000,|
||}, "reference": "choosed_at": "size_cd":|"collected_value": "counter_delivery": null, 0, "origin_address":|null, "100000001", false, "Calle de la|

"b12550ef-3b7b-4a68-985b-e4b44463094e",

Concepción, El Santuario, Mexico City, CDMX, Mexico",

https://docs.picap.io/index.html#introducci-n 36/68

"origin_secondary_address": null, "origin_address_geojson": { "type": "Point", "coordinates": [ -99.092707,

19.3541687
] }, "end_address": "Coyoacán, CDMX, Mexico", "end_secondary_address": "", "end_address_geojson": { "type": "Point", "coordinates": [ -99.1561883,

19.3437444
] }, "customer_info": { "_id": "6517014d94ecb223635b40d4", "name": "Test001", "email": "vurquides+001@pibox.app", "country_code": "52", "phone": "5510000001", "fiscal_number": null } }, { "id": "6517026b94ecb223635b40d7", "prepackage_identification": "544037d4-b1b2-4898-9805-3d57043caa08", "company_id": "5fff9eb162af100031caf969", "passenger_id": "6459596b6bc259003104ae09", "indications": "Test002", "declared_value": { "subunits": 1000000, "iso": "MXN" }, "collected_value": null, "reference": "100000002", "counter_delivery": false, "choosed_at": null, "size_cd": 0, "origin_address": "Calle de la Concepción, El Santuario, Mexico City, CDMX, Mexico", "origin_secondary_address": null, "origin_address_geojson": { "type": "Point", "coordinates": [ -99.092707,

19.3541687
] }, "end_address": "Metro Coyoacán-L3, Av. Universidad, Benito Juárez", "end_secondary_address": "", "end_address_geojson": { "type": "Point", "coordinates": [ -99.17079319999999,

19.3614557
] }, "customer_info": { "_id": "6517026b94ecb223635b40d6", "name": "Test002", "email": "vurquides+002@pibox.app", "country_code": "52", "phone": "5510101002", "fiscal_number": null } } https://docs.picap.io/index.html#introducci-n 37/68

] }

Este servicio lista todos los pre_paquetes de una empresa de forma paginada. Por medio de parámetros query es posible filtrar el listado por estado para lograr una búsqueda detallada en caso de ser necesario.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/pre_packages/company_pre_packages](https://turing.thetrancon.com/api/third/pre_packages/company_pre_packages)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS QUERY**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|page|Integer|Página del listado de pre_paquetes requerida|
|status_cd|Integer|Identificador del estado del paquete por el cual se quiere filtrar el listado (Opcional)|
|Atributo|Tipo||
|page|Integer|Página actual del listado de pre_paquetes|
|pages|Integer|Número total de páginas del listado de pre_paquetes|
|data|Array|Listado de pre_paquetes de la página actual|

**ATRIBUTOS DEL LISTADO**

### Descripción

 Cada página contiene máximo 10 entradas de datos

 La forma de especificar la información de un pre_paquete es detallada en el servicio de crear un pedido

## Listar todos los pre_paquetes por usuario

### Ejemplo respuesta de petición 91 líneas

{

|"page":|1,||
|---|---|---|
|"pages":|1,||
|"data": {|[ "id": "company_id": "passenger_id": "indications": "declared_value": "iso":|"6517014d94ecb223635b40d5", "prepackage_identification": "5fff9eb162af100031caf969", "6459596b6bc259003104ae09", "Test001", { 1000000, "subunits": "MXN"|
||},||

"b12550ef-3b7b-4a68-985b-e4b44463094e",

https://docs.picap.io/index.html#introducci-n 38/68

||"collected_value":|null,||
|---|---|---|---|
|"reference":|"counter_delivery":|"100000001",|false,|
|"choosed_at":||null,||
|"size_cd":] },|0, "origin_address": "origin_secondary_address": "origin_address_geojson": "type": "coordinates": -99.092707, 19.3541687|"Calle "Point", [|de la {|
|] }, } }, {|"end_address": "end_secondary_address": "end_address_geojson": "type": "coordinates": -99.1561883, 19.3437444 "customer_info": "_id": "name": "email": "country_code": "phone": "fiscal_number":|"Coyoacán, "Point", [ { "Test001", "52", "5510000001",|CDMX, "", { "6517014d94ecb223635b40d4", "vurquides+001@pibox.app", null|
|"id":|"prepackage_identification":|"6517026b94ecb223635b40d7",||
|"company_id": },|"passenger_id": "indications": "declared_value": "subunits": "MXN" "iso": "collected_value":|"Test002", { 1000000, null,|"5fff9eb162af100031caf969", "6459596b6bc259003104ae09",|
|"reference":|"counter_delivery":|"100000002",|false,|
|"choosed_at":||null,||
|"size_cd":] },|0, "origin_address": "origin_secondary_address": "origin_address_geojson": "type": "coordinates": -99.092707, 19.3541687|"Calle "Point", [|de la {|
|] },|"end_address": "end_secondary_address": "end_address_geojson": "type": "coordinates": 19.3614557 "customer_info": "_id": "name":|"Metro "Point", [ -99.17079319999999, { "Test002",|Coyoacán "", { "6517026b94ecb223635b40d6",|

Concepción, El Santuario, Mexico City, CDMX, Mexico", null,

Mexico",

"544037d4-b1b2-4898-9805-3d57043caa08",

Concepción, El Santuario, Mexico City, CDMX, Mexico", null,

-L3, Av. Universidad, Benito Juárez",

https://docs.picap.io/index.html#introducci-n 39/68

"email": "vurquides+002@pibox.app", "country_code": "52", "phone": "5510101002", "fiscal_number": null } }] }

Este servicio lista todos los pre_paquetes de un usuario de forma paginada. Por medio de parámetros query es posible filtrar el listado por estado para lograr una búsqueda detallada en caso de ser necesario.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/pre_packages/passenger_pre_packages](https://turing.thetrancon.com/api/third/pre_packages/passenger_pre_packages)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS QUERY**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|page|Integer|Página del listado de pre_paquetes requerida|
|status_cd|Integer|Identificador del estado del paquete por el cual se quiere filtrar el listado (Opcional)|
|Atributo|Tipo||
|page|Integer|Página actual del listado de pre_paquetes|
|pages|Integer|Número total de páginas del listado de pre_paquetes|
|data|Array|Listado de pre_paquetes de la página actual|

**ATRIBUTOS DEL LISTADO**

### Descripción

 Cada página contiene máximo 10 entradas de datos

 La forma de especificar la información de un pre_paquete es detallada en el servicio de crear un pedido

## Detalle de un pre_paquete

### Ejemplo respuesta de petición 44 líneas

{

|"id":|||"65171e2994ecb2650284d6a7",|
|---|---|---|---|
||"company_id": "passenger_id": "indications": "declared_value": "subunits":|"prepackage_identification":|"5fff9eb162af100031caf969", "Test002", { 1000000,|

"fa7b822f-5c36-4df1-b18a-584352cc3aec",

"6459596b6bc259003104ae09",

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 40/68

|"iso":|"MXN"|||
|---|---|---|---|
|},|"collected_value":|null,||
|"reference":|"counter_delivery":|"100000002", false,||
|"choosed_at":||null,||
|"size_cd":] },|0, "origin_address": "origin_secondary_address": "origin_address_geojson": "type": "coordinates": -99.092707, 19.3541687|"Calle "Point", [|de la {|
|"end_address":] },|"end_secondary_address": "end_address_geojson": "type": "coordinates": 19.3614557 "customer_info":|"Metro "Point", [ -99.17079319999999, {|Coyoacán "", {|
|"_id": },|"name": "email": "country_code": "phone": "fiscal_number":|"Test002", "52", "5510101002", null|"65171e2994ecb2650284d6a6", "vurquides+002@pibox.app",|
|"status":|"cancelled"|||

Concepción, El Santuario, Mexico City, CDMX, Mexico", null,

-L3, Av. Universidad, Benito Juárez",

}

Este servicio retorna el detalle de un pre_paquete donde se especifica la información mas relevante de este.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/pre_packages/{PRE_PACKAGE_ID}](https://turing.thetrancon.com/api/third/pre_packages/{PRE_PACKAGE_ID})

 PRE_PACKAGE_ID hace referencia al identificador único retornado al crearse un pre_paquete

**HEADERS**

Content-Type:application/json; charset=utf-8

**ATRIBUTOS DE UN PRE_PAQUETE**

### Descripción

|Atributo|Tipo||
|---|---|---|
|id|String|Identificador único del pre_paquete|
|indications|String|Indicaciones de entrega del pre_paquete|
|declared_value|Hash|Valor declarado del pre_paquete en centavos y con un cunrrency especificado|
|reference|String|Número de pedido del pre_paquete|
|counter_delivery [https://docs.picap.io/index.html#introducci-n|Boolean|Determina](https://docs.picap.io/index.html#introducci-n|Boolean|Determina) si el pago del pre_paquete es a contra entrega|

41/68

### Atributo Tipo Descripción

size_cd Integer Identificador del tamaño aproximado del pre_paquete

 El declared_value es un Hash constituido por un entero representando el valor declarado en centavos (sub_units) y un String representando su código de moneda (currency)

## Actualizacion de un pre_paquete

### Ejemplo cuerpo de petición 28 líneas

{ "pre_package": { "reference": "100000002", "indications": "Test002", "origin_secondary_addres": "", "end_secondary_address": "", "size_cd": 0, "counter_delivery": false, "collected_value": null, "origin_address": "Calle de la Concepción, El Santuario, Mexico City, CDMX, Mexico", "origin_lat": 19.3541687, "origin_lon":-99.092707, "end_address": "Metro Coyoacán-L3, Av. Universidad, Benito Juárez", "end_lat": 19.3614557, "end_lon":-99.17079319999999, "declared_value": { "cents": 1000000, "currency_iso": "MXN" }, "customer":{ "name": "Test002", "country_code": "52", "phone": "5510101002", "email": "vurquides+002@pibox.app" } } }

### Ejemplo respuesta de petición 44 líneas

{

|"id":||"6517220994ecb2650284d6ab",|
|---|---|---|
||"prepackage_identification":||
|"company_id":||"5fff9eb162af100031caf969",|
|"passenger_id":||"6459596b6bc259003104ae09",|
|"indications":|"declared_value": "subunits":|"Test002", { 1000000,|
|"iso": },|"MXN" "collected_value":|null,|
|"reference":|"counter_delivery":|"100000002", false,|
|"choosed_at":|null,||
|"size_cd":|0, "origin_address":|"Calle de la|

"35347668-ba13-4355-b631-244b7b4f2895",

Concepción, El Santuario, Mexico City, CDMX, Mexico",

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 42/68

null,

||"origin_secondary_address":|||
|---|---|---|---|
||"origin_address_geojson": "type": "coordinates": -99.092707, 19.3541687|"Point", [|{|
|]||||
|},||||
||"end_address": "end_secondary_address": "end_address_geojson": "type": "coordinates": 19.3614557|"Metro "Point", [ -99.17079319999999,|Coyoacán "", {|
|]||||
|},|"customer_info": "_id": "name": "email": "country_code": "phone": "fiscal_number":|{ "Test002", "52", "5510101002", null|"6517220994ecb2650284d6aa", "vurquides+002@pibox.app",|
|},||||
|"status":|"pooled"|||

-L3, Av. Universidad, Benito Juárez",

}

Actualiza un paquete preestablecido existente según los parámetros proporcionados.

**HTTP REQUEST**

PUT [https://turing.thetrancon.com/api/third/pre_packages/{PRE_PACKAGE_ID}](https://turing.thetrancon.com/api/third/pre_packages/{PRE_PACKAGE_ID})

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE ACTUALIZACIÓN DE UN PRE_PAQUETE**

### Parámetro Descripción

||Tipo||
|---|---|---|
|indications|String|Indicaciones para el paquete.|
|reference|String|Referencia del paquete.|
|counter_delivery|String|Información de entrega contra reembolso.|
|origin_address|String|Dirección de origen.|
|origin_secondary_address|String|Dirección secundaria de origen.|
|origin_lat|Float|Latitud de origen. Requerida salvo que se resuelva por geocodificación.|
|origin_lon|Float|Longitud de origen. Requerida salvo que se resuelva por geocodificación.|
|end_address|String|Dirección de destino.|
|end_secondary_address|String|Dirección secundaria de destino.|
|end_lat|Float|Latitud de destino. Requerida salvo que se resuelva por geocodificación.|
|end_lon|Float|Longitud de destino. Requerida salvo que se resuelva por geocodificación.|
|[https://docs.picap.io/index.html#introducci-n|||](https://docs.picap.io/index.html#introducci-n|||)

43/68

|Parámetro|Tipo|Descripción|
|---|---|---|
|city_code|String|Código de ciudad usado como referencia para geocodificar origin_address / end_addr ess cuando no se envían coordenadas. Requerido (junto con o en vez de postal_co de ) en ese caso.|
|state_code|String|Código de estado/departamento que refuerza la geocodificación por ciudad. Opcional.|
|postal_code|String|Código postal usado como referencia para geocodificar origin_address / end_address cuando no se envían coordenadas. Requerido (junto con o en vez de city_code) en ese caso.|
|size_cd|String|Tamaño del paquete.|
|payment_method_cd|String|Código del método de pago. Opcional.|
|requires_a_driver_with_base_money|Boolean|Indica si el pedido requiere un conductor con dinero base. Opcional.|
|money_to_pay_for_package|Object|Monto a pagar por el paquete (centavos y código de moneda). Opcional.|
|declared_value|String|Valor declarado del paquete (centavos y código de moneda).|
|collected_value|String|Valor recolectado del paquete (centavos y código de moneda).|
|customer|Object|Detalles del cliente (nombre, código de país, teléfono, correo electrónico, número fiscal).|

**ATRIBUTOS DE RESPUESTA A LA ACTUALIZACIÓN DE UN PRE_PAQUETE**

### Atributo Tipo Descripción

pre_package_id Object listado de pre_paquetes

 La forma de especificar la información de un pre_paquete es detallada en el servicio de crear un pedido

## Cancelación de un pre_paquete

Ejemplo cuerpo de petición

{ "pre_package_id": "65171e2994ecb2650284d6a7" }

Ejemplo respuesta de petición 44 líneas

{ "id": "65171e2994ecb2650284d6a7", "prepackage_identification": "fa7b822f-5c36-4df1-b18a-584352cc3aec", "company_id": "5fff9eb162af100031caf969", "passenger_id": "6459596b6bc259003104ae09", "indications": "Test002", "declared_value": { "subunits": 1000000,

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 44/68

|"iso":|"MXN"|||
|---|---|---|---|
|},|"collected_value":|null,||
|"reference":|"counter_delivery":|"100000002", false,||
|"choosed_at":||null,||
|"size_cd":] },|0, "origin_address": "origin_secondary_address": "origin_address_geojson": "type": "coordinates": -99.092707, 19.3541687|"Calle "Point", [|de la {|
|"end_address":] },|"end_secondary_address": "end_address_geojson": "type": "coordinates": 19.3614557 "customer_info":|"Metro "Point", [ -99.17079319999999, {|Coyoacán "", {|
|"_id": },|"name": "email": "country_code": "phone": "fiscal_number":|"Test002", "52", "5510101002", null|"65171e2994ecb2650284d6a6", "vurquides+002@pibox.app",|
|"status":|"cancelled"|||

Concepción, El Santuario, Mexico City, CDMX, Mexico", null,

-L3, Av. Universidad, Benito Juárez",

}

Cancela un paquete preestablecido existente según los parámetros proporcionados.

**HTTP REQUEST**

PUT [https://turing.thetrancon.com/api/third/pre_packages/cancel_pre_package](https://turing.thetrancon.com/api/third/pre_packages/cancel_pre_package)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE CANCELACIÓN DE UN PRE_PAQUETE**

### Parámetro Tipo Descripción

### pre_package_id String Identificador del pre_paquete

**ATRIBUTOS DE RESPUESTA A LA CANCELACIÓN DE UN PRE_PAQUETE**

### Atributo Tipo Descripción

### pre_package_id String listado de pre_paquetes

 La forma de especificar la información de un pre_paquete es detallada en el servicio de crear un pedido

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 45/68

# Reservas

Servicios relacionados con la gestión de reservas.

## Reservas v2

Nueva versión de la API de reservas, con endpoints dedicados e independientes de los de pedidos ( bookings). **Es la versión** **recomendada para integraciones nuevas.**

 Antes de integrar, valida con tu KAM (Key Account Manager) que tu compañía tenga habilitado el acceso a la funcionalidad de reservas mediante la nueva API ( booking_reservation_api). Sin este acceso habilitado, los endpoints de Reservas v2 no funcionarán para tu compañía.

**CREAR RESERVA**

Crea una nueva reserva agendada que asigna un conductor dedicado exclusivamente a la compañía durante el tiempo especificado.

### Ejemplo cuerpo de petición

{

|"booking":|{||
|---|---|---|
|"address":|"Carulla "secondary_address":|Express "",|
|"lat":|4.69457077,||
|"lon":|-74.06186216, "city_code": "scheduled_at": "hours_dedicated": "requested_service_type_id": "payment_method_cd":|"bogota", "2026-05-29T09:15:00-05:00", 8, 1,|
|}|"use_wallet_balance":|true|

Pasadena, Calle 106 #51-19, Suba, Bogotá",

"5c71b03a58b9ba10fa6393cf",

}

### Ejemplo respuesta de petición 26 líneas

{

|"_id":||"6a1970e046ccc953602e61d6",|
|---|---|---|
|"created_at":||"2026-05-29T10:56:34.296Z",|
|"updated_at":||"2026-05-29T10:56:35.497Z",|
|"address":|"Carulla "secondary_address": "origin_geojson":|Express "", {|
|"type":] },|"Point", "coordinates": -74.06186216, 4.69457077 "requested_service_type_id":|[|
|"status_cd":|109, "scheduled_at": "hours_dedicated":|"2026-05-29T14:15:00.000Z", 8.0,|

Pasadena, Calle 106 #51-19, Suba, Bogotá, Pasadena (Suba)",

"5c71b03a58b9ba10fa6393cf",

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 46/68

||true, "use_wallet_balance":|
|---|---|
|"cost_center":|null,|
|"delivery_cost":|{|
|"subunits":|1430000,|
|"iso":|"COP"|
|},|"original_booking_reservation_id":|

"6a1970e346ccc953602e61e9" }

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/booking_reservations](https://turing.thetrancon.com/api/third/booking_reservations)

**HEADERS**

Content-Type:application/json; charset=utf-8

**VER RESERVA**

Retorna el detalle de una reserva específica. El parámetro :id en la URL corresponde al _id retornado al crear la reserva.

### Ejemplo respuesta de petición 26 líneas

{ "_id": "6a1970e046ccc953602e61d6", "created_at": "2026-05-29T10:56:34.296Z", "updated_at": "2026-05-29T13:29:00.412Z", "address": "Carulla Express Pasadena, Calle 106 #51-19, Suba, Bogotá, Pasadena (Suba)", "secondary_address": "", "origin_geojson": { "type": "Point", "coordinates": [ -74.06186216,

4.69457077
] }, "requested_service_type_id": "5c71b03a58b9ba10fa6393cf", "status_cd": 14, "scheduled_at": "2026-05-29T14:15:00.000Z", "hours_dedicated": 8.0, "use_wallet_balance": true, "cost_center": null, "delivery_cost": { "subunits": 1430000, "iso": "COP" }, "original_booking_reservation_id": "6a1970e346ccc953602e61e9" }

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/booking_reservations/:id](https://turing.thetrancon.com/api/third/booking_reservations/:id)

**HEADERS**

Content-Type:application/json; charset=utf-8

**LISTAR RESERVAS EN PROGRESO**

Lista, de forma paginada, las reservas que actualmente se encuentran en progreso (con un conductor ya asignado y en ejecución), junto con los pedidos ( booking_ids) generados dentro de cada una.

### Ejemplo respuesta de petición 20 líneas

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 47/68

{

|"page":|1,||
|---|---|---|
||"total_items": "total_pages":|1, 1,|
|{|"reservations": "id": "status_cd": "scheduled_at": "finish_at": "extra_hours":|[ "6a1970e046ccc953602e61d6", 1, "hours_dedicated": null,|
|] }]|"booking_ids":|[ "6a1994dff34484d0f42e61ef", "6a1997b046ccc953602e6204"|

"2026-05-29T14:15:00.000Z", "2026-05-29T21:29:00.146Z",

8.0,
}

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/running_reservations](https://turing.thetrancon.com/api/third/running_reservations)

**HEADERS**

Content-Type:application/json; charset=utf-8

**AGREGAR TAREAS A RESERVA EN PROGRESO**

Asigna una nueva tarea (pedido) a una reserva en progreso. El parámetro :booking_reservation_id en la URL corresponde al _id de la reserva. El servicio será atendido exclusivamente por el conductor asignado a esa reserva.

### Ejemplo cuerpo de petición 39 líneas

{

|"booking":|{|||
|---|---|---|---|
|"address":|"secondary_address":|"Carulla Express "",|Pasadena,|
|"lat":|4.69457077,|||
|"lon":|-74.06186216, "requested_service_type_id": "payment_method_cd": "use_wallet_balance": "requires_parking_fee":|1, "requires_a_driver_with_base_money":|true, false,|
|"stops": {|[|||
||"address": "secondary_address": "lat": "lon": "customer": "name": "phone":|"Otra 4.82457077, -74.10186216, { "Juan Pérez", "3001234567",|Direccion, Bogotá", "",|
|},|"country_code": "packages":|[|"57"|
||{ "size_cd": "reference":|0, "counter_delivery": "indications": "declared_value": "sub_units": "currency":|false, "Entregar en "REF-001", { 100000, "COP"|

Calle 106 #51-19, Suba, Bogotá",

"5c71b03a58b9ba10fa6393cf",

false,

portería",

https://docs.picap.io/index.html#introducci-n 48/68

} }] }] } }

### Ejemplo respuesta de petición 53 líneas

{

|"id":||"6a199d8e1f991a60dde42b95",||
|---|---|---|---|
|"created_at":|||"2026-05-29T14:07:30.073Z",|
|"updated_at":|||"2026-05-29T14:07:50.288Z",|
|"address":|"origin_geojson":|"Carulla {|Express|
|"type":] },|"coordinates": -74.06186216, 4.69457077|"Point", [||
|"status_cd":|"booking_reservation_id": "type_of_pibox_service":|15,|null,|
|"stops": {|[|||
|] }, {|"address": "address_geojson": "type": "coordinates": 4.82457077 "finished": "is_return_stop": "packages": "_id": "size_cd": "iso":|"Otra "secondary_address": "Point", [ -74.10186216, false, [ 0, "status_cd": "counter_delivery": "indications": "reference": "declared_value": "subunits": "COP"|Direccion, "", { false, "6a199d911f991a60dde42b97", 0, "Entregar "REF-001", { 100000,|
|}], } }]|}, "customer": "name": "country_code": "phone":|"tracking_link": "validation_code": { "Juan "3001234567"|null pérez", "57",|

Pasadena, Calle 106 #51-19, Suba, Bogotá, Pasadena (Suba)",

"6a1970e346ccc953602e61e9",

Bogotá",

false, en portería",

"[https://piboxweb-dev.netlify.app/tracking/6a199d911f991a60dde42b97"](https://piboxweb-dev.netlify.app/tracking/6a199d911f991a60dde42b97"),

}

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/booking_reservations/:booking_reservation_id/tasks](https://turing.thetrancon.com/api/third/booking_reservations/:booking_reservation_id/tasks) [https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 49/68

**HEADERS**

Content-Type:application/json; charset=utf-8

## Reservas v1 (Deprecado)

 Estos endpoints están **deprecados**. Las compañías deben migrar a Reservas v2 para continuar usando el servicio de reservas; no se garantiza soporte a largo plazo sobre esta versión.

**CREAR UNA RESERVA** Ejemplo cuerpo de petición para un pedido agendado 43 líneas

{

|"booking":{|||||
|---|---|---|---|---|
||"address": "secondary_address":|"Cra. 61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|"sender_phone": "sender_country_code": "return_to_origin": "scheduled_at": "hours_dedicated": "stops":[|-74.108101, "client_identification": "requested_service_type_id": "requires_a_driver_with_base_money":|"3111234009", "57", false, 4,|"2026-05-15T23:50:00-05:00",|
|{|"address": "lat": "lon": "customer": "name":|"secondary_address": 4.695382, -74.085727, { "country_code": "phone": "email":|"Titan", "Cliente", "57", "30112345678", "docs@picap.co"|"Diagonal al|
||},|"packages":[|||
||{|"indications":|"declared_value": "sub_units": "currency":|"Indicaciones", { 210000, "COP"|
|||}, "reference": "size_cd":|"counter_delivery": 1|"Pedido 1", false,|
||}||||
||]||||
|}|||||
|]|||||
|}|||||

panadería",

"5a957e248af945001fbe678b", "5c71b03a58b9ba10fa6393cf",

false,

centro comercial",

}

Este servicio crea una reserva agendada que asigna un conductor dedicado exclusivamente a ti durante el tiempo especificado. Utiliza el mismo endpoint de crear un pedido con los siguientes campos adicionales:

scheduled_at : fecha y hora de inicio del servicio en formato ISO 8601. [https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 50/68

hours_dedicated : cantidad de horas que el conductor trabajará dedicado a tu operación. El valor mínimo es 4 y el máximo es 12.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/bookings](https://turing.thetrancon.com/api/third/bookings)

**HEADERS**

Content-Type:application/json; charset=utf-8

**MIS RESERVAS** Ejemplo respuesta de petición 39 líneas

[ { "_id": "6a07d4df0cb6fb5766b35c0c", "origin_coordinates": [ -75.526541,

5.0788717
], "created_at": "2026-05-16T02:22:23.394Z", "scheduled_at": "2026-05-16T03:24:12.000Z", "hours_dedicated": 4.0, "finish_at": "2026-05-16T06:26:19.502Z", "driver": { "_id": "650a27ac8e699900204f0e7b", "name": "Edward Susa", "phone": "41312312", "rating_as_driver": 4.12, "photo_url": "https://static.picap.co/form_field_solutions/650a27ac8e699900204f0e7b/CAP4589580090205338805.jpg", "app_version": "5.40.33" }, "vehicle_plate": "MAS328", "consumed_percentage": 3.72, "remaining_time": "2h 55min", "finished_services": 0, "booking": { "id": "6a07d4de0cb6fb5766b35bf9", "address": "Cra. 7 #8-35, Manizales, Caldas", "status_cd": 14, "lat": 5.0788717, "lon":-75.526541, "requested_service_type_id": "5c71b03a58b9ba10fa6393cf", "scheduled_at": "2026-05-15T22:24:12.000Z", "estimated_cost": { "subunits": 927000, "iso": "COP" } } }]

Este servicio lista las reservas activas de tu cuenta. Úsalo para identificar a qué reserva deseas asignarle tareas, es decir, servicios que serán atendidos exclusivamente por el conductor asignado a esa reserva. De esta forma puedes organizar y dirigir pedidos específicos directamente al conductor dedicado con el id de la reserva.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/bookings/booking_reservations](https://turing.thetrancon.com/api/third/bookings/booking_reservations)

**HEADERS**

Content-Type:application/json; charset=utf-8

**CREAR TAREAS DE UNA RESERVA**

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 51/68

Este servicio permite asignar tareas a una reserva activa. Utiliza el mismo endpoint de crear un pedido incluyendo el campo booking_reserv ation_id con el identificador de la reserva a la que deseas vincular el pedido. El servicio será atendido exclusivamente por el conductor asignado a esa reserva.

### Ejemplo cuerpo de petición 41 líneas

{

|"booking":{|||||
|---|---|---|---|---|
||"address": "secondary_address":|"Cra. 61|#23z-42", "Diagonal|a la|
|"lat":|4.653652,||||
|"lon":|"return_to_origin": "scheduled_at": "cost_center_id": "stops":[|-74.108101, "requested_service_type_id": "requires_a_driver_with_base_money": null, "booking_reservation_id":|false, null,||
|{|"address": "lat": "lon": "customer": "name":|"secondary_address": 4.695382, -74.085727, { "country_code": "phone": "email":|"Titan", "Cliente", "57", "30112345678", "docs@picap.co"|"Diagonal al|
||},|"packages":[|||
||{|"indications":|"declared_value": "sub_units": "currency":|"Indicaciones", { 210000, "COP"|
|||}, "reference": "size_cd":|"counter_delivery": 1|"Pedido 1", false,|
||}||||
||]||||
|}|||||
|]|||||
|}|||||

panadería",

"5c71b03a58b9ba10fa6393cf",

false,

"6a07d4df0cb6fb5766b35c0c",

centro comercial",

}

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/bookings](https://turing.thetrancon.com/api/third/bookings)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

Identificador de la reserva a la que se le asignará la tarea. Obtenlo desde el endpoint **Mis reservas** booking_reservation_id String usando el campo _id.

 Para obtener el id de la reserva consulta el endpoint Mis reservas.

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 52/68

**TAREAS DE UNA RESERVA**

### Ejemplo respuesta de petición

[ { "id": "6a07e6eafc5bb369ad9b3b0e", "address": "CAI El Cable, Manizales, Caldas, Colombia", "created_at": "2026-05-15T22:39:23.051-05:00", "status_cd": 0 }]

Este servicio lista todas las tareas (pedidos) asignadas a una reserva. El parámetro BOOKING_ID en la URL corresponde al id del pedido de la reserva, no al id de la reserva en sí. Puedes obtenerlo desde el endpoint **Mis reservas** en el campo booking.id.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/booking_reservations/{BOOKING_ID}/reserve_tasks](https://turing.thetrancon.com/api/third/booking_reservations/{BOOKING_ID}/reserve_tasks)

**HEADERS**

Content-Type:application/json; charset=utf-8

# Comodatos

Servicios relacionados con la gestión de comodatos.

## Crear un comodato

### Ejemplo cuerpo de petición 17 líneas

{

|||"commodate_loan":|{||
|---|---|---|---|---|
|||"driver_phone_number": "commodates_attributes":|||
||{|"category_cd": "description":||"0",|
|||},|||
||{|"category_cd": "description":||"1",|
||}||||
|}|],|"return_date":||"14-06-2026"|

"31316191", [

"Description articulo datafono"

"Description articulo canastilla"

}

Este servicio crea un comodato asignando artículos a un conductor activo de la compañía. El parámetro COMPANY_ID en la URL corresponde al identificador único de tu empresa.

**HTTP REQUEST**

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 53/68

POST [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

Número de teléfono del conductor al que se le entregan los commodate_loan.driver_phone_number String artículos en comodato.

commodate_loan.commodates_attributes Array Lista de artículos entregados en comodato.

Código de categoría del artículo. Los valores posibles son: 0 = commodate_loan.commodates_attributes[].category_cd String Datáfono, 1 = Canastilla.

### commodate_loan.commodates_attributes[].description String Descripción del artículo entregado.

Fecha de devolución de los artículos en formato DD-MM-YYYY. No commodate_loan.return_date String puede ser menor al día actual.

## Listar mis comodatos

### Ejemplo respuesta de petición 97 líneas

{ "page": "1", "pages": 3, "data": [ { "_id": "6a2b76db4a455caff719ef8f", "created_at": "12/06/2026 03:02:51 AM", "borrower": { "_id": "64b70e0ca415380032147f1f", "name": "Edward Susa", "phone": "+5731316191" }, "commodates_amount": 2, "commodates": [ { "_id": "6a2b76db4a455caff719ef90", "status": { "code": 1, "name": "En préstamo" }, "category": { "code": 0, "name": "Datáfono" }, "description": "Description articulo datafono", "incidents": [], "receivable": false }, { "_id": "6a2b76db4a455caff719ef91", "status": { "code": 1, "name": "En préstamo" },

https://docs.picap.io/index.html#introducci-n 54/68

"category": { "code": 1, "name": "Cesta" }, "description": "Description articulo canastilla", "incidents": [], "receivable": false }], "return_date": "15/06/2026", "status": { "code": 1, "name": "Aceptación pendiente" } }, { "_id": "6a2b76bc94758e75cd29012b", "created_at": "12/06/2026 03:02:20 AM", "borrower": { "_id": "64b70e0ca415380032147f1f", "name": "Edward Susa", "phone": "+5731316191" }, "commodates_amount": 2, "commodates": [ { "_id": "6a2b76bc94758e75cd29012c", "status": { "code": 8, "name": "Cancelado" }, "category": { "code": 0, "name": "Datáfono" }, "description": "Description articulo datafono", "incidents": [], "receivable": false }, { "_id": "6a2b76bc94758e75cd29012d", "status": { "code": 8, "name": "Cancelado" }, "category": { "code": 1, "name": "Cesta" }, "description": "Description articulo canastilla", "incidents": [], "receivable": false }], "return_date": "15/06/2026", "status": { "code": 8, "name": "Cancelado" } }] }

Este servicio retorna el listado de comodatos de la compañía de forma paginada.

**HTTP REQUEST**

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 55/68

GET [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

per_page Integer Cantidad de registros a retornar por página.

page Integer Número de página a consultar. Comienza desde 1.

created_at String Filtra los comodatos por fecha de creación en formato DD-MM-YYYY. Parámetro opcional.

status_cd Integer Filtra los comodatos por estado. Ver sección **Estados** para los valores posibles. Parámetro opcional.

return_date String Filtra los comodatos por fecha de devolución en formato DD-MM-YYYY. Parámetro opcional.

id String Filtra por el identificador único del comodato. Parámetro opcional.

borrower String Filtra por el identificador único del conductor que tiene el préstamo activo. Parámetro opcional.

## Detalle de un comodato

### Ejemplo respuesta de petición 46 líneas

{ "_id": "6a2b76db4a455caff719ef8f", "created_at": "12/06/2026 03:02:51 AM", "borrower": { "_id": "64b70e0ca415380032147f1f", "name": "Edward Susa", "phone": "+5731316191" }, "commodates_amount": 2, "commodates": [ { "_id": "6a2b76db4a455caff719ef90", "status": { "code": 1, "name": "En préstamo" }, "category": { "code": 0, "name": "Datáfono" }, "description": "Description articulo datafono", "incidents": [], "receivable": false }, { "_id": "6a2b76db4a455caff719ef91", "status": { "code": 1, "name": "En préstamo" }, "category": { "code": 1,

https://docs.picap.io/index.html#introducci-n 56/68

||"Cesta" "name":|
|---|---|
||}, "description": "incidents": [], "receivable":|
|}||
|],|"15/06/2026", "return_date":|
|"status":|{ 1, "code": "Aceptación "name":|
|}||

"Description articulo canastilla",

false

pendiente"

}

Este servicio retorna el detalle de un comodato específico. El parámetro COMMODATE_LOAN_ID en la URL corresponde al _id del comodato.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID})

**HEADERS**

Content-Type:application/json; charset=utf-8

## Editar un comodato

### Ejemplo cuerpo de petición

{ "commodate_loan": { "return_date": "17-06-2026" } }

Este servicio actualiza un comodato existente. Retorna 200 si la actualización fue exitosa. El parámetro COMMODATE_LOAN_ID en la URL corresponde al _id del comodato.

**HTTP REQUEST**

PATCH [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID})

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

commodate_loan.return_date String Nueva fecha de devolución en formato DD-MM-YYYY. No puede ser menor al día actual.

## Cancelar un comodato

Este servicio cancela un comodato activo. No requiere cuerpo en la petición. Retorna 200 si la cancelación fue exitosa. El parámetro COMMO DATE_LOAN_ID en la URL corresponde al _id del comodato.

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 57/68

**HTTP REQUEST**

PATCH [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/cancel](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/cancel)

**HEADERS**

Content-Type:application/json; charset=utf-8

## Listar conductores con préstamos

### Ejemplo respuesta de petición 17 líneas

{

||"borrower_list": [|
|---|---|
|{|"_id": "name":|
|},||
|{|"_id": "name":|
|},||
|{|"_id": "name":|
|}||
|]||

"64b70e0ca415380032147f1f", "Edward Susa"

"6583579b51a5d100254e1f65", "Edward Susa"

"65b3c97b8e59520028e4d355", "Edward Susa"

}

Este servicio retorna la lista de conductores que tienen al menos un comodato activo en la compañía.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/borrower_list](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/borrower_list)

**HEADERS**

Content-Type:application/json; charset=utf-8

## Enviar recordatorio de devolución

Este servicio envía una notificación al conductor para recordarle que debe devolver los artículos del comodato. No requiere cuerpo en la petición. Retorna 200 si el recordatorio fue enviado exitosamente. El parámetro COMMODATE_LOAN_ID en la URL corresponde al _id del comodato.

**HTTP REQUEST**

PATCH [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/deliver_reminder](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/deliver_reminder)

**HEADERS**

Content-Type:application/json; charset=utf-8

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 58/68

## Dar como recibido un comodato

### Ejemplo cuerpo de petición

{

|||"commodates":||
|---|---|---|---|
||{|||
||||"id": "ack":|
||}|||
|]||||

[

"65c3900d82f9b000254348ca", true

}

Este servicio marca uno o más artículos del comodato como recibidos por el prestador. El parámetro COMMODATE_LOAN_ID en la URL corresponde al _id del comodato.

**HTTP REQUEST**

PATCH [https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/lender_ack](https://turing.thetrancon.com/api/third/companies/{COMPANY_ID}/commodate_loans/{COMMODATE_LOAN_ID}/lender_ack)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|commodates|Array|Lista de artículos a marcar como recibidos.|
|commodates[].id|String|Identificador único del artículo ( _id dentro del array commodates).|
|commodates[].ack|Boolean|Indica si el artículo fue recibido. Enviar true para marcarlo como recibido.|

## Artículos

Categorías de artículos disponibles para asignar en un comodato.

|category_cd|Categoría|
|---|---|
|0|Datáfono|
|1|Canastilla|
|2|Maleta|
|3|Otro|

## Estados

Estados posibles de un comodato para usar como filtro en el parámetro status_cd. [https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 59/68

||5/8/26, 10:39 p.m.||Picap Docs|
|---|---|---|---|
|1 2 3 4 5 6 7 8 10 11 0 1 2 {|status_cd "hook": { "url": "event_cd":|Prestado Devuelto Caducado Cancelado Sin devolución Tipos de eventos Identificador del evento Crear un webhook Ejemplo cuerpo de petición 0, [https://docs.picap.io/index.html#introducci-n|Estado](https://docs.picap.io/index.html#introducci-n|Estado) Aceptación pendiente Parcialmente prestado Recepción pendiente Parcialmente devuelto Devolución incompleta Webhooks Los Webhooks permite a un usuario suscribirse a eventos que se generan cada vez que se actualiza el estado de un pedido o paquete. Cuando se activa uno de estos eventos, se envía una solicitud HTTP POST a la URL configurada para el webhook. La siguiente tabla presenta un listado con los posibles eventos a los cuales un usuario puede suscribirse. Descripción Actualización de estado de un pedido Actualización de estado de un paquete Actualización de estado de un pre-paquete "[https://www.api.test/hook/bookings"](https://www.api.test/hook/bookings"), 60/68|

"headers": {} } }

### Ejemplo respuesta de petición

{ "5d7f23ec56c97100147bfba2",

||"_id":||
|---|---|---|
||"url": "event_cd": "headers":||

"[https://www.api.test/hook/bookings"](https://www.api.test/hook/bookings"), 0, {} }

Este servicio crea un nuevo webhook suscribiendo al usuario a un evento específico.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/hooks](https://turing.thetrancon.com/api/third/hooks)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE UN WEBHOOKS**

### Descripción

|Parámetro|Tipo||
|---|---|---|
|url|String|URL que va a ser llamado cada vez que se genere el evento|
|event_cd|Integer|Identificador del evento al cual se va a suscribir el usuario|
|headers|Hash|Headers del request especificados por el usuario que serán enviados a la hora de notificar el evento|

## Actualización de un pedido

Ejemplo del llamado al webhook 16 líneas

{ "5dec4d2321ec510019081c33",

|"booking_id":||
|---|---|
|"status_cd":|101,|
|"event_cd":|0,|
|"created_at":|"relaunched_to_id":|
|"driver":|{|
|"id":|"613a3ea7a585b2001e1eb92c"|
|"name":|"David",|
|"phone":|"301301629522"|
|},||
|"vehicle":|{|
|"plates":|"POI123"|
|}||

"2019-12-08T01:08:52.280Z", null,

}

Una vez un usuario se suscribe a la actualización de un pedido y este evento es generado, se hará un llamado HTTP POST al URL especificado en el webhook conteniendo información relevante del nuevo estado. Si el hook fue creado con headers el servidor los enviara en el HTTP request al momento de realizar la notificación.

**ATRIBUTOS DEL LLAMADO HTTP POST** [https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 61/68

||5/8/26, 10:39 p.m.|||||Picap Docs|
|---|---|---|---|---|---|---|
|driver {|Atributo booking_id status_cd event_cd created_at relaunched_to_id vehicle "package_id": "status_cd": "event_cd":|0, 1,|Hash Hash Ejemplo del llamado al webhook|Tipo String Integer Integer String String Actualización de un paquete "5dec4d2321ec510019081c3e",|Identificador único del pedido actualizado Nuevo estado del pedido por el conductor y requerir de relanzamiento|Descripción Identificador único del evento que fue generado. En este caso 0 Fecha de creación del evento en formato UTC Identificador único del nuevo pedido en el que fue relanzado el pedido actual en caso de ser cancelado En caso de que el pedido ya este asignado, este campo serán los datos del piloto. En caso de que el pedido ya este asignado, este campo serán los datos del vehículo.|
|}|"created_at":|||"2019-12-08T01:08:53.077Z"|||
|{|Atributo package_id status_cd event_cd created_at "id":|ATRIBUTOS DEL LLAMADO HTTP POST String String "prepackage_identification": [https://docs.picap.io/index.html#introducci-n|Tipo](https://docs.picap.io/index.html#introducci-n|Tipo) Integer Integer Ejemplo del llamado al webhook "665f1c2e4b3a9c0012ab34cd",|en el HTTP request al momento de realizar la notificación.|Identificador único del paquete actualizado Nuevo estado del paquete Fecha de creación del evento en formato UTC Actualización de un pre-paquete "PKG-2026-000123",|Una vez un usuario se suscribe a la actualización de un paquete y este evento es generado, se hará un llamado HTTP POST al URL especificado en el webhook conteniendo información relevante del nuevo estado. Si el hook fue creado con headers el servidor los enviara Descripción Identificador único del evento que fue generado. En este caso 1 62/68|

"reference": "Factura #4521", "package": { "id": null, "status_cd": null }, "origin_address": "Calle 123 #45-67, Bogotá", "end_address": "Carrera 89 #12-34, Bogotá", "event_cd": 2, "created_at": "2026-07-13T14:32:07.123Z" }

Ejemplo del llamado al webhook (Actualización de estado de un pre-paquete, delivered)

{ "id": "665f1c2e4b3a9c0012ab34cd", "prepackage_identification": "PKG-2026-000123", "reference": "Factura #4521", "package": { "id": "665f1c9a4b3a9c0012ab3501", "status_cd": 2 }, "origin_address": "Calle 123 #45-67, Bogotá", "end_address": "Carrera 89 #12-34, Bogotá", "delivered_photo_url": "[https://cdn.picap.co/packages/delivered/abc123.jpg"](https://cdn.picap.co/packages/delivered/abc123.jpg"), "event_cd": 2, "created_at": "2026-07-13T14:32:07.123Z" }

Una vez un usuario se suscribe a la actualización de un pre-paquete y este evento es generado (por cambio de estado o al agruparse el pre-paquete dentro de una ruta), se hará un llamado HTTP POST al URL especificado en el webhook conteniendo información relevante del pre-paquete y, si ya existe, del paquete físico asociado. Si el hook fue creado con headers el servidor los enviara en el HTTP request al momento de realizar la notificación. El envío es asíncrono y de mejor esfuerzo (*at-most-once*): si el endpoint destino falla o no responde no hay reintento automático.

**ATRIBUTOS DEL LLAMADO HTTP POST**

### Atributo Tipo Descripción

id String Identificador único del pre_paquete que originó el evento

prepackage_identification String Código legible del pre_paquete (el mismo usado para conciliación con la empresa)

reference String Referencia libre ingresada por la empresa al crear el pre_paquete

Snapshot del paquete físico actualmente asociado al pre_paquete. Si aún no existe un paquete package Object ligado, package.id y package.status_cd viajan como null.

package.id String Identificador único del paquete asociado

package.status_cd Integer Código de estado del paquete asociado. Ver la sección Estados de un paquete.

origin_address String Dirección de recogida del pre_paquete

end_address String Dirección de entrega del pre_paquete

URL de la foto de entrega. Solo se incluye cuando el paquete asociado está en estado delivere delivered_photo_url String

d.
event_cd Integer Identificador único del evento que fue generado. En este caso 2

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 63/68

### Atributo Tipo Descripción

Fecha de creación del pre_paquete en formato UTC (no es la fecha del cambio de estado que created_at String disparó el evento)

## Listar webhooks creados

### Ejemplo respuesta de petición

[

|{|||
|---|---|---|
|||"_id": "url": "event_cd": "headers":|
||},||
|{||"_id": "url": "event_cd": "headers":|
|}|||

"5d7f21a8c149a425b56a6f2c", "https://api.test/hooks/bookings", 0, {}

"5d7f23ec56c97100147bfba2", "https://api.test/hooks/packages", 1, {}

]

Este servicio lista todos los webhooks de un usuario.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/hooks](https://turing.thetrancon.com/api/third/hooks)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE UN WEBHOOKS**

### Descripción

|Atributo|Tipo||
|---|---|---|
|id|String|Identificador único del webhook|
|url|String|URL que es llamado cada vez que se genera un evento|
|event_cd|Integer|Identificador del evento al cual esta suscrito el usuario|
|headers|Hash|Headers del request especificados por el usuario que serán enviados a la hora de notificar el evento|

## Eliminar un webhook

### Ejemplo respuesta de petición

{ "_id": "5d7f23ec56c97100147bfba2", "url": "[https://www.api.test/hook/bookings"](https://www.api.test/hook/bookings"),

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 64/68

"event_cd": 0, "headers": {} }

Este servicio elimina un webhook creado por un usuario previamente.

**HTTP REQUEST**

DELETE [https://turing.thetrancon.com/api/third/hooks/{HOOK_ID}](https://turing.thetrancon.com/api/third/hooks/{HOOK_ID})

 HOOK_ID hace referencia al identificador único retornado al crearse un webhook

**HEADERS**

Content-Type:application/json; charset=utf-8

# Bodegaje

## Crear agendado de paquetes

### Ejemplo cuerpo de petición 31 líneas

{ "packages": [ { "address": "Cra. 61 #23z-42", "lat": 4.656780, "lon":-74.111349, "indications": "Indicaciones", "reference": "TEST1", "size_cd": 0, "counter_delivery": false, "declared_value": { "subunits": 1000000, "iso": "COP" } }, { "address": "Cra. 61 #23z-42", "lat": 4.656780, "lon":-74.111349, "indications": "Indicaciones", "reference": "TEST2", "size_cd": 0, "counter_delivery": false, "declared_value": { "subunits": 1000000, "iso": "COP" } }] }

### Ejemplo respuesta de petición 47 líneas

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 65/68

{

|"packages":|[|||
|---|---|---|---|
|{|"_id": "address": "lat": "lon": "reference": "size_cd":|"Cra. 4.65678, -74.111349, "indications": 0, "counter_delivery": "declared_value": "subunits": "COP" "iso":|"5fd2fa7e0be4445d1cd2e9d7", 61 "Indicaciones", "TEST1", false, { 1000000,|
|}, {|}, "status_cd": "driver": "vehicle": "_id": "address": "lat": "lon": "reference": "size_cd":|"tracking_link": "picked_up_photo_url": "delivered_photo_url": null, null, "booking_id": "Cra. 4.65678, -74.111349, "indications": 0, "counter_delivery": "declared_value": "subunits": "COP" "iso":|null, null, null "5fd2fa7e0be4445d1cd2e9d9", 61 "Indicaciones", "TEST2", false, { 1000000,|
|}]|}, "status_cd": "driver": "vehicle":|"tracking_link": "picked_up_photo_url": "delivered_photo_url": null, null, "booking_id":|null, null, null|

#23z-42",

null, null,

#23z-42",

null, null,

}

Este servicio crea un agendamiento a partir de un listado de paquetes.

**HTTP REQUEST**

POST [https://turing.thetrancon.com/api/third/storage_bookings](https://turing.thetrancon.com/api/third/storage_bookings)

**HEADERS**

Content-Type:application/json; charset=utf-8

**PARÁMETROS DE LA PETICIÓN**

### Parámetro Tipo Descripción

address String Dirección del lugar de entrega del paquete

lat Float Latitud del lugar de entrega del paquete

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 66/68

### Parámetro Tipo Descripción

lon Float Longitud del lugar de entrega del paquete

 La forma de especificar la información de un paquete es detallada en el servicio de crear un pedido

## Detalle de un paquete agendado

Ejemplo respuesta de petición cuando no hay conductor asignado 22 líneas

{

|"_id":||"5fd2f1390be4445d1cd2e9d5",|
|---|---|---|
|"address":|"Cra.|61|
|"lat":|4.65678,||
|"lon":|-74.111349, "indications":|"Indicaciones",|
|"reference":||"TEST1",|
|"size_cd": },|0, "counter_delivery": "declared_value": "subunits": "iso": "COP"|false, { 1000000,|
|"status_cd":|"tracking_link": "picked_up_photo_url": "delivered_photo_url":|null, null,|
|"driver":|null,||
|"vehicle":|null, "booking_id":||

#23z-42",

null, null,

"5fd2e32de77237002f50eff2" }

Ejemplo respuesta de petición cuando hay conductor asignado 41 líneas

{ "_id": "5fd2f1390be4445d1cd2e9d5", "address": "Cra. 61 #23z-42", "lat": 4.65678, "lon":-74.111349, "indications": "Indicaciones", "reference": "TEST1", "size_cd": 0, "counter_delivery": false, "declared_value": { "subunits": 1000000, "iso": "COP" }, "status_cd": 3, "tracking_link": "[https://pibox.app/tracking/5dec2e6f5224e10015202542"](https://pibox.app/tracking/5dec2e6f5224e10015202542"), "picked_up_photo_url": null, "delivered_photo_url": null, "driver": { "_id": "5f349f26ff720d004bb71a93", "name": "Driver", "phone": "301301301301", "photo_url": null }, "vehicle": { [https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 67/68

"5d570b88fb6abf0043f562c5",

|"_id":|||
|---|---|---|
||"plates": "color": "make": "reference": "loc_geojson": "type":|"ASD123", "negro", "Test", "Test", { "Point", ["coordinates": -74.052785, 4.70511|
||]||
|},|||
|}, "booking_id":|"loc_course":|-1.0|

"5fd2e32de77237002f50eff2" }

Este servicio retorna el detalle de un paquete agendado previamente.

**HTTP REQUEST**

GET [https://turing.thetrancon.com/api/third/storage_packages/{PACKAGE_ID}](https://turing.thetrancon.com/api/third/storage_packages/{PACKAGE_ID})

**HEADERS**

Content-Type:application/json; charset=utf-8

 PACKAGE_ID hace referencia al identificador único retornado al agendar los paquetes

**ATRIBUTOS DEL LISTADO**

### Descripción

|Atributo|Tipo||
|---|---|---|
|address|String|Dirección del lugar de entrega del paquete|
|lat|Float|Latitud del lugar de entrega del paquete|
|lon|Float|Longitud del lugar de entrega del paquete|

 Los campos de la respuesta de un paquete son explicados en el detalle de un paquete.

[https://docs.picap.io/index.html#introducci-n](https://docs.picap.io/index.html#introducci-n) 68/68
