# Guía de Implementación: Tokenización de Pagos con Zonapagos

## 1. Contexto y Estado Actual
La integración básica con Zonapagos ya se encuentra realizada. El objetivo de este documento es implementar la funcionalidad de **Tokenización (Pagos Recurrentes / Inicio de Pago-Tokenización NC)** según el documento técnico oficial de Zonapagos v1.0.

Actualmente contamos con la siguiente tabla en PostgreSQL:

```sql
create table public.buyer_payment_methods (
  id uuid not null default gen_random_uuid (),
  buyer_id uuid not null,
  type text not null default 'card'::text,
  label text not null,
  brand text null,
  last4 text null,
  exp text null,
  is_default boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint buyer_payment_methods_pkey primary key (id),
  constraint buyer_payment_methods_buyer_id_fkey foreign KEY (buyer_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;
```

## 2. Modificaciones Requeridas en la Base de Datos
Zonapagos notificará un `str_token` (alfanumérico, máx. 50 caracteres) que representará el método de pago del comprador para futuros cobros.

**Acción requerida:** Debes generar una migración para alterar la tabla actual e incluir un campo donde se almacene el token asociado y el ID que se reporta a Zonapagos.

```sql
ALTER TABLE public.buyer_payment_methods
ADD COLUMN zonapagos_token varchar(50) NULL,
ADD COLUMN zonapagos_cliente_id text NULL; -- Para enlazar el str_id_cliente que enviamos con el buyer_id
```

---

## 3. Flujo de Implementación de Tokenización

La implementación consta de tres partes fundamentales que debes integrar en nuestro backend:

### Fase A: Modificar el "Inicio de Pago" para solicitar el Token
En el consumo actual del API de Inicio de Pago (`/Apis_CicloPago/api/InicioPago`), debes asegurarte de enviar los parámetros de configuración adicionales para que Zonapagos genere el token.

En el payload JSON que enviamos a Zonapagos, dentro de la lista `AdicionalesConfiguracion`, debes inyectar obligatoriamente:
- `int_codigo`: 200
- `str_valor`: "1" (Indica que es modalidad tokenización)

**Ejemplo del fragmento a agregar:**
```json
"AdicionalesConfiguracion": [
  {
    "int_codigo": 200,
    "str_valor": "1"
  }
]
```
*Nota importante:* Asegúrate de enviar correctamente el `str_id_cliente` (puede ser el documento del usuario o nuestro `buyer_id` en string), ya que Zonapagos nos devolverá este mismo identificador cuando nos notifique el token.

### Fase B: Crear Endpoint Webhook (Notificar Token)
Zonapagos ejecutará un POST hacia nuestro servidor para entregarnos el token generado. 
Debes exponer y publicar un nuevo endpoint (ruta sugerida por Zonapagos: `/ApiToken/api/Notificar`).

**Método:** POST
**Content-Type:** application/json

**Estructura del Request que recibiremos:**
```json
{
  "int_id_comercio": 1234,
  "str_usuario": "usuario_comercio",
  "str_clave": "clave_comercio",
  "str_id_cliente": "El identificador del cliente enviado en la Fase A",
  "str_token": "1842154537000000001169"
}
```

**Lógica a implementar en el endpoint:**
1. Validar credenciales (`int_id_comercio`, `str_usuario`, `str_clave`).
2. Buscar en la base de datos a qué `buyer_id` corresponde el `str_id_cliente`.
3. Hacer un `INSERT` (o `UPDATE` si ya existe) en la tabla `public.buyer_payment_methods`:
   - `buyer_id` = (El UUID del comprador)
   - `type` = 'card'
   - `zonapagos_token` = `str_token` del request.
   - `is_default` = true
4. Retornar un response síncrono exactamente con esta estructura:

**Estructura del Response a retornar (Status 200 OK):**
```json
{
  "int_cod_estado": 0,
  "str_mensaje": "Se recibió exitosamente el token"
}
```
*(Si hay fallas, retornar `int_cod_estado`: 1 (no se pudo recibir), 2 (error seguridad), 99 (error inesperado)).*

### Fase C: Consumir API para Pagos Recurrentes
Cuando necesitemos cobrar a un cliente de forma automática (recurrencia), ya no se envían datos de tarjeta ni se redirecciona al usuario. Se usa el API de Pagos con Token.

**Endpoint a consumir (Producción):** `https://zonapagos.com/ApisToken/api/PagoAPTC`
**Método:** POST

**Payload de ejemplo a enviar:**
```json
{
  "int_id_comercio": 1234,
  "str_usuario": "usuario_comercio",
  "str_clave": "clave_comercio",
  "str_tipo_identificador": "1", // Siempre debe ser "1"
  "str_identificador": "{valor_almacenado_en_zonapagos_token}",
  "str_id_pago": "Tu_ID_Interno_de_Orden_o_Factura",
  "str_total_con_iva": "50000",
  "str_valor_iva": "0",
  "int_no_cuotas": 1,
  "str_descripcion_pago": "Cobro de suscripcion mensual",
  "str_direccion_ip_cliente": "192.168.0.10"
}
```

**Manejo de la Respuesta:**
Debes evaluar el parámetro `int_estado_transaccion`:
- `1`: Aprobada. (Puedes marcar tu orden interna como pagada).
- `2`: Rechazada/Negada (Hubo error o fondos insuficientes).
- `3`: Pendiente/Indeterminada (Debes programar un Job para consultar el estado del pago más tarde usando el API de Verificación).

## 4. Recomendaciones Adicionales
- Para consultar el estado final de una transacción que haya quedado en estado 3 (Pendiente), utiliza el endpoint de Verificación de Pagos (`/Apis_CicloPago/api/VerificacionPago`) enviando el `str_id_pago`.
- El webhhok de Notificar Token (`Fase B`) debe ser rápido para evitar timeouts por parte de Zonapagos. Almacena el token de inmediato.
- A futuro, puedes actualizar los campos `brand` (franquicia) y `last4` en `buyer_payment_methods` llamando a la API de Verificación de pago, en la cual Zonapagos retorna los parámetros `str_franquicia` (ej. "Visa") e `int_numero_tarjeta` (los últimos 4 dígitos) si el medio de pago utilizado fue el 32 (Tarjeta de Crédito).
