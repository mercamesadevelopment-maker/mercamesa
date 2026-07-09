# Documentación de Integración de API - B2Chat

Esta API proporciona una interfaz de integración segura para que sistemas de chat externos (como B2Chat) consulten información sobre catálogos de productos, inventarios, tiendas, ofertas y estado de los pedidos en Mercamesa.

---

## 1. Autenticación y Autorización

### Paso 1: Iniciar Sesión (Obtener JWT)
Para interactuar con la API, primero debe iniciar sesión con las credenciales asignadas al rol de integración (ej: `b2chat_integration`).

* **Endpoint**: `/api/auth/login`
* **Método**: `POST`
* **Cuerpo de la Solicitud (JSON)**:
  ```json
  {
    "email": "integracion.b2chat@mercamesa.com",
    "password": "wYEa}Nrv.RVuIxw6oG8(rQPq2c??y6)Kr"
  }
  ```
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "user": { ... },
    "session": {
      "access_token": "eyJhbGciOi...",
      "token_type": "bearer",
      "expires_in": 3600,
      "refresh_token": "...",
      "user": { ... }
    },
    "profile": { ... }
  }
  ```

### Paso 2: Autorizar Solicitudes Subsiguientes
Debe adjuntar el `access_token` en todas las llamadas a la API dentro de la cabecera HTTP `Authorization`:

```http
Authorization: Bearer <su_access_token>
```

---

## 2. Endpoints de Consulta (Solo Lectura)

### 2.1 Productos del Catálogo Maestro
Obtiene la lista de productos globales del catálogo.

* **Endpoint**: `/api/b2chat/products`
* **Método**: `GET`
* **Parámetros de Consulta (Opcionales)**:
  * `search` (string): Buscar productos cuyo nombre coincida.
  * `category_id` (UUID): Filtrar por el ID de una categoría específica.
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "name": "Tomate Chonto",
        "slug": "tomate-chonto",
        "description": "Tomate chonto fresco de plaza",
        "image_url": "imgs/product-id/img.jpg",
        "imagePublicUrl": "https://...",
        "is_active": true,
        "categories": { "name": "Fruver" },
        "measurement_units": { "abbreviation": "kg" }
      }
    ]
  }
  ```

### 2.2 Categorías del Catálogo
Obtiene la lista jerárquica de categorías.

* **Endpoint**: `/api/b2chat/categories`
* **Método**: `GET`
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
        "parent_id": null,
        "name": "Fruver",
        "slug": "fruver",
        "description": "Frutas y verduras frescas",
        "sort_order": 1,
        "is_active": true
      }
    ]
  }
  ```

### 2.3 Tiendas / Plazas Activas
Obtiene el listado de las tiendas o plazas de mercado habilitadas en el sistema.

* **Endpoint**: `/api/b2chat/stores`
* **Método**: `GET`
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "6789abcd-ef01-2345-6789-abcdef012345",
        "name": "Plaza de Mercado Paloquemao",
        "slug": "paloquemao",
        "description": "Plaza de mercado Paloquemao Bogotá",
        "logo_url": "stores/paloquemao-logo.jpg",
        "logo_public_url": "https://...",
        "cover_public_url": "https://...",
        "phone": "3001234567",
        "is_active": true
      }
    ]
  }
  ```

### 2.4 Productos, Precios y Stock por Tienda
Consulta el inventario y los precios vigentes de los productos en una tienda determinada.

* **Endpoint**: `/api/b2chat/stores/[storeId]/products`
* **Método**: `GET`
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
        "store_id": "6789abcd-ef01-2345-6789-abcdef012345",
        "catalog_product_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        "price_per_unit": 3500.00,
        "stock": 150.500,
        "min_order_qty": 1.000,
        "wholesale_price": 3100.00,
        "wholesale_min_qty": 10.000,
        "is_active": true,
        "catalog_products": {
          "name": "Tomate Chonto",
          "image_url": "imgs/product-id/img.jpg",
          "description": "Tomate chonto fresco",
          "category_id": "e5f67a8b-9c0d-1e2f-3a4b-5c6d7e8f9a0b",
          "categories": { "name": "Fruver" }
        },
        "measurement_units": {
          "name": "Kilogramo",
          "abbreviation": "kg"
        },
        "imagePublicUrl": "https://..."
      }
    ]
  }
  ```

### 2.5 Historial de Movimientos de Inventario
Consulta las entradas, salidas y ajustes manuales en el stock de los productos.

* **Endpoint**: `/api/b2chat/stock-movements`
* **Método**: `GET`
* **Parámetros de Consulta (Opcionales)**:
  * `store_id` (UUID): Filtrar movimientos por tienda.
  * `store_product_id` (UUID): Filtrar movimientos por producto específico.
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "01234567-89ab-cdef-0123-456789abcdef",
        "store_product_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
        "store_id": "6789abcd-ef01-2345-6789-abcdef012345",
        "type": "entry",
        "quantity": 50.000,
        "reference_type": "adjustment_manual",
        "notes": "Abastecimiento matutino",
        "created_at": "2026-07-09T02:00:00Z",
        "registered_by": "...",
        "profiles": {
          "full_name": "Juan Perez",
          "email": "juan@mercamesa.com"
        }
      }
    ]
  }
  ```

### 2.6 Listado General de Pedidos
Permite listar pedidos realizados en la plataforma.

* **Endpoint**: `/api/b2chat/orders`
* **Método**: `GET`
* **Parámetros de Consulta (Opcionales)**:
  * `client_document` (string): Buscar pedidos asociados al número de cédula/documento del cliente.
  * `status` (string): Filtrar por el estado del pedido (`pending`, `accepted`, `delivered`, `cancelled`).
  * `limit` (número, default 50): Límite de paginación.
  * `offset` (número, default 0): Desplazamiento de paginación.
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "bbccdde7-8b23-403f-a60e-b3e96dbd6abe",
        "consecutive": 1024,
        "subtotal": 35000.00,
        "delivery_fee": 5000.00,
        "total": 40000.00,
        "status": "pending",
        "payment_status": "pending",
        "created_at": "2026-07-09T01:30:00Z",
        "clients": {
          "id": "c1c2c3c4-d5d6-7788-99aa-bbccddeeff11",
          "document_number": "1023456789",
          "full_name": "Carlos Gomez",
          "email": "carlos@gomez.com",
          "phone": "3159999999"
        },
        "order_items": [
          {
            "id": "dd11ee22-ff33-44aa-bbcc-ddeeff001122",
            "catalog_name": "Tomate Chonto",
            "unit_name": "kg",
            "quantity": 10.000,
            "unit_price": 3500.00,
            "total_price": 35000.00
          }
        ]
      }
    ],
    "pagination": {
      "total": 1,
      "limit": 50,
      "offset": 0
    }
  }
  ```

### 2.7 Detalle de Pedido por ID
Obtiene los detalles del pedido, incluyendo subpedidos por tienda, ítems individuales y transacciones de pago.

* **Endpoint**: `/api/b2chat/orders/[id]`
* **Método**: `GET`
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": {
      "id": "bbccdde7-8b23-403f-a60e-b3e96dbd6abe",
      "consecutive": 1024,
      "subtotal": 35000.00,
      "delivery_fee": 5000.00,
      "total": 40000.00,
      "status": "pending",
      "payment_status": "pending",
      "created_at": "2026-07-09T01:30:00Z",
      "clients": {
        "id": "c1c2c3c4-d5d6-7788-99aa-bbccddeeff11",
        "document_number": "1023456789",
        "full_name": "Carlos Gomez",
        "email": "carlos@gomez.com",
        "phone": "3159999999"
      },
      "order_items": [
        {
          "id": "dd11ee22-ff33-44aa-bbcc-ddeeff001122",
          "store_product_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
          "catalog_name": "Tomate Chonto",
          "unit_name": "kg",
          "quantity": 10.000,
          "unit_price": 3500.00,
          "total_price": 35000.00
        }
      ],
      "store_orders": [
        {
          "id": "99aa88bb-77cc-66dd-55ee-44ff33221100",
          "store_id": "6789abcd-ef01-2345-6789-abcdef012345",
          "status": "pending",
          "subtotal": 35000.00,
          "has_refrigerated": false,
          "stores": {
            "name": "Plaza de Mercado Paloquemao"
          }
        }
      ],
      "payments": [
        {
          "id": "eeff0011-2233-44aa-55bb-66cc77dd88ee",
          "provider": "zonapagos",
          "status": "pending",
          "amount": 40000.00,
          "payment_url": "https://..."
        }
      ]
    }
  }
  ```

### 2.8 Ofertas por Tienda
Consulta las ofertas de descuento vigentes asociadas a productos y tiendas.

* **Endpoint**: `/api/b2chat/offers`
* **Método**: `GET`
* **Parámetros de Consulta (Opcionales)**:
  * `store_id` (UUID): Filtrar ofertas por tienda específica.
* **Respuesta Exitosa (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "87654321-abcd-ef01-2345-6789abcdef01",
        "store_product_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
        "discount_pct": 10.00,
        "special_price": 3150.00,
        "label": "Descuento del Día",
        "starts_at": "2026-07-09T00:00:00Z",
        "ends_at": "2026-07-15T23:59:59Z",
        "is_active": true,
        "store_products": {
          "id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
          "store_id": "6789abcd-ef01-2345-6789-abcdef012345",
          "catalog_products": {
            "name": "Tomate Chonto",
            "image_url": "imgs/product-id/img.jpg"
          }
        },
        "imagePublicUrl": "https://..."
      }
    ]
  }
  ```

---

## 3. Códigos de Respuesta HTTP

La API utiliza los siguientes códigos estándar HTTP para indicar el resultado de cada solicitud:

* **`200 OK`**: La consulta se ejecutó con éxito.
* **`400 Bad Request`**: Parámetros incorrectos, faltantes o error interno del proveedor.
* **`401 Unauthorized`**: El token JWT falta, es inválido o ha expirado.
* **`403 Forbidden`**: El usuario está autenticado pero no tiene permisos RBAC asignados para el módulo (falta asignar permisos de lectura `'read'` en `role_permissions`).
* **`404 Not Found`**: El recurso consultado (tienda, pedido o producto) no existe.
* **`500 Internal Server Error`**: Ocurrió un error no controlado en el servidor.
