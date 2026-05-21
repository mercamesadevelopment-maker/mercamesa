# Instrucciones de Integración: Pasarela de Pago Zonapagos

Actúa como un desarrollador backend experto. Tu tarea es implementar el consumo de la API REST de Zonapagos para iniciar una transacción ("Inicio de Pago"). Debes construir el payload JSON y procesar la respuesta siguiendo estrictamente la información técnica descrita a continuación.

## 1. Detalles del Endpoint
* [cite_start]**Ruta de la API:** `https://www.zonapagos.com/Apis_CicloPago/api/InicioPago`[cite: 100].
* **Método HTTP:** POST.

## 2. Estructura del Payload (Parámetros de Entrada)
El cuerpo de la petición debe incluir los siguientes objetos y listas.

### Objeto: `Informacion Pago`
[cite_start]Contiene los detalles de la venta y del cliente[cite: 103]:
* [cite_start]`flt_total_con_iva` (Numérico, **Obligatorio**): Total a pagar con IVA incluido[cite: 105].
* `flt_valor_iva` (Numérico, **Opcional**): Total IVA. [cite_start]Si no aplica, enviar 0[cite: 105].
* [cite_start]`str_id_pago` (Alfanumérico, **Obligatorio**, máx 30 char): Identificador interno único del pago o factura[cite: 105].
* [cite_start]`str_descripcion_pago` (Alfanumérico, **Obligatorio**): Concepto o descripción del pago[cite: 120].
* [cite_start]`str_email` (Alfanumérico, **Opcional**): Correo del cliente[cite: 120].
* [cite_start]`str_id_cliente` (Alfanumérico, **Obligatorio para PSE**): Número de documento del cliente[cite: 120].
* [cite_start]`str_tipo_id` (Alfanumérico, **Obligatorio para PSE**): Equivalente al tipo de documento (ej. `1` para CC, `2` para CE, `3` para NIT)[cite: 120].
* [cite_start]`str_nombre_cliente`, `str_apellido_cliente`, `str_telefono_cliente` (Alfanuméricos, **Opcionales**): Datos personales del cliente[cite: 120].
* [cite_start]`str_opcional1` a `str_opcional5` (Alfanuméricos, **Opcionales**): Campos extra informativos[cite: 126].

### Objeto: `Informacion Seguridad`
[cite_start]Credenciales para autenticar la petición[cite: 138]:
* [cite_start]`int_id_comercio` (Numérico, **Obligatorio**): Identificador único del comercio[cite: 140].
* [cite_start]`str_usuario` (Alfanumérico, **Obligatorio**): Usuario validador entre el comercio y Zonapagos[cite: 140].
* [cite_start]`str_clave` (Alfanumérico, **Obligatorio**): Clave de validación asignada al comercio[cite: 140].
* [cite_start]`int_modalidad` (Numérico, **Obligatorio**): Siempre se debe enviar `-1`[cite: 140]. *(Nota: Algunos ejemplos heredados usan `1`[cite: 578], pero la tabla de parámetros exige `-1`)*.

### Listas: `Adicionales Pago` y `Adicionales Configuracion`
Arreglos de objetos para configuraciones específicas de la pasarela[cite: 157, 161]:
* [cite_start]Se componen de los campos `int_codigo` y `str_valor`[cite: 159, 162].
* [cite_start]**Código `50`** (**Obligatorio si se usa PSE**): Define el Código de servicio Principal[cite: 181].
* [cite_start]**Código `104`** (**Opcional**): Define la URL de Retorno Cliente para redirigirlo en cualquier ciclo del pago[cite: 181].

## 3. Estructura de la Respuesta (Parámetros de Retorno)
[cite_start]Al consumir la API, recibirás un objeto con los siguientes campos[cite: 256]:
* [cite_start]`int_codigo`: `1` indica que se ejecutó correctamente, `2` indica que ejecutó con error[cite: 257].
* [cite_start]`str_cod_error`: `-1` si hubo error en validaciones o `0` si se encontraron pagos[cite: 257].
* [cite_start]`str_descripcion_error`: Detalle en texto del error presentado[cite: 257].
* [cite_start]`str_url`: URL generada a la que se debe redireccionar el navegador del usuario pagador[cite: 257]. [cite_start]Esta ruta contiene el identificador alfanumérico único asignado por Zonapagos para procesar el pago[cite: 270, 272, 273].

---

## 4. Ejemplos de Consumo JSON

### Ejemplo de Petición (Request JSON)
```json
{
  "Informacion Pago": {
    "flt_total_con_iva": 83000,
    "flt_valor_iva": 833,
    "str_id_pago": "180924",
    "str_descripcion_pago": "camisa",
    "str_email": "soporte9@zonavirtual.com",
    "str_id_cliente": "123456789",
    "str_tipo_id": "1",
    "str_nombre_cliente": "Elsa",
    "str_apellido_cliente": "Pito",
    "str_telefono_cliente": "319632555648",
    "str_opcional1": "opcion 11",
    "str_opcional2": "opcion 12",
    "str_opcional3": "opcion 13",
    "str_opcional4": "opcion 14",
    "str_opcional5": "opcion 15"
  },
  "Informacion Seguridad": {
    "int_id_comercio": 678,
    "str_usuario": "Usuario",
    "str_clave": "Agosto17",
    "int_modalidad": 1
  },
  "Adicionales Pago": [
    {
      "int_codigo": 111,
      "str_valor": "0"
    },
    {
      "int_codigo": 112,
      "str_valor": "0"
    }
  ],
  "Adicionales Configuracion": [
    {
      "int_codigo": 50,
      "str_valor": "2701"
    },
    {
      "int_codigo": 100,
      "str_valor": "1"
    },
    {
      "int_codigo": 104,
      "str_valor": "[https://www.google.com.co/](https://www.google.com.co/)"
    }
  ]
}