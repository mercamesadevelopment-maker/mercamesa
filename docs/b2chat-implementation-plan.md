# Plan de Implementación: Integración API B2Chat con Control de Acceso basado en Roles (RBAC)

Este plan detalla cómo exponer de forma segura las APIs de Mercamesa para la integración con B2Chat. La solución implementará autenticación por token (JWT/Bearer) y validará los permisos en base a las tablas existentes de `roles` y `role_permissions` de Supabase.

---

## Respuestas a Preguntas de Negocio

1. **Creación de Pedidos**: Confirmado que para la integración con B2Chat **no se expondrá la creación de pedidos** ni la edición de estados desde el chat; la integración será estrictamente de **consulta de información** (lectura).
2. **Estructura de `modules` y Migraciones**: 
   - **No se requieren cambios estructurales ni migraciones de base de datos**, ya que la estructura actual de la tabla `modules` cuenta con la columna `key: text` única por padre, la cual coincide perfectamente con el diseño de validación propuesto.
   - Solo se requerirá configurar los registros correspondientes (semillas) de roles y permisos en la base de datos para habilitar el acceso a los módulos correspondientes.

---

## User Review Required

> [!IMPORTANT]
> **Autenticación por Token Bearer**: Dado que los desarrolladores externos y los flujos de chat consumirán la API mediante scripts o webhooks, implementaremos soporte para el encabezado `Authorization: Bearer <JWT>`. Los desarrolladores externos obtendrán este token mediante el endpoint existente `/api/auth/login`.
>
> **Configuración de Permisos (Semillas SQL)**: Para permitir el acceso, se debe garantizar que en la base de datos se asocien los permisos de lectura (`read`) del módulo a consultar al rol asignado para la integración. Más abajo se incluye un script SQL de ejemplo para facilitar esta inserción de datos de configuración.

---

## Proposed Changes

### Componente: Helpers de Autenticación y Autorización de API

Para evitar duplicación de código de verificación en cada endpoint, crearemos una utilidad en el servidor que autentica el Bearer token o las cookies de sesión y consulta los permisos del usuario en la base de datos.

#### [NEW] [auth-helpers.ts](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/lib/supabase/auth-helpers.ts)

Crea funciones reutilizables para:
- Extraer el token JWT de la cabecera `Authorization: Bearer <token>` o de las cookies del navegador.
- Validar la sesión con Supabase.
- Consultar las tablas `profiles`, `roles` y `role_permissions` para verificar que el rol del usuario tenga el permiso requerido en el módulo correspondiente.
- Permitir bypass automático si el rol del usuario es de sistema (`is_system = true`) o su nombre es `'admin'`.

---

### Componente: API Endpoints (B2Chat Integration)

Crearemos un subdirectorio exclusivo `/api/b2chat/` para separar la lógica de integración externa de las llamadas internas de la aplicación web. Al ser solo de lectura, todos los endpoints usarán únicamente el método `GET`.

#### [NEW] [route.ts (Products)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/products/route.ts)
- **Método**: `GET`
- **Descripción**: Permite listar los productos del catálogo con soporte para filtros por nombre y categoría.
- **Módulo / Acción**: `catalog_products` / `read`

#### [NEW] [route.ts (Categories)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/categories/route.ts)
- **Método**: `GET`
- **Descripción**: Lista las categorías activas.
- **Módulo / Acción**: `categories` / `read`

#### [NEW] [route.ts (Stores)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/stores/route.ts)
- **Método**: `GET`
- **Descripción**: Lista las tiendas (plazas/stores) activas.
- **Módulo / Acción**: `stores` / `read`

#### [NEW] [route.ts (Store Products & Stocks)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/stores/[storeId]/products/route.ts)
- **Método**: `GET`
- **Descripción**: Lista los productos disponibles en una tienda específica, detallando su stock, precio unitario y precio mayorista.
- **Módulo / Acción**: `store_products` / `read`

#### [NEW] [route.ts (Inventory Movements)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/stock-movements/route.ts)
- **Método**: `GET`
- **Descripción**: Consulta el historial de movimientos de inventario de los productos.
- **Módulo / Acción**: `product_stock_movements` / `read`

#### [NEW] [route.ts (Orders - List)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/orders/route.ts)
- **Método**: `GET`
- **Descripción**: Obtiene la lista de pedidos con soporte para filtros por cliente (`client_id` o `buyer_id`).
- **Módulo / Acción**: `orders` / `read`

#### [NEW] [route.ts (Orders - Detail)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/orders/[id]/route.ts)
- **Método**: `GET`
- **Descripción**: Obtiene los detalles completos de un pedido específico por su ID (incluyendo items de pedido y subpedidos por tienda).
- **Módulo / Acción**: `orders` / `read`

#### [NEW] [route.ts (Store Offers)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/offers/route.ts)
- **Método**: `GET`
- **Descripción**: Consulta las ofertas de descuento activas en productos por tienda (`store_offers`).
- **Módulo / Acción**: `store_offers` / `read`

---

### Componente: Documentación Técnica de Integración

Generaremos un archivo markdown estructurado y detallado explicando cómo interactuar con el sistema de autenticación y detallando la especificación técnica de cada endpoint.

#### [NEW] [README.md (Documentation)](file:///c:/Users/Daniel%20Felipe/Documents/Appsmartt/mercamesa/app/api/b2chat/README.md)
- Guía de autenticación mediante Bearer Tokens.
- Listado de endpoints con payloads de respuestas de éxito/error.
- Script SQL ejemplo para inicializar roles/permisos necesarios en base de datos.
- Explicación de los códigos de respuesta HTTP usuales (200, 401, 403, 500).

---

## SQL Semillas / Inicialización de Permisos (Ejemplo)

Para registrar los accesos del rol `b2chat_integration` en la base de datos, se ejecutaría una consulta similar a la siguiente:

```sql
-- 1. Crear el Rol de integración
INSERT INTO public.roles (name, label, description, is_system)
VALUES ('b2chat_integration', 'Integración B2Chat', 'Acceso de solo lectura para integraciones del chat', false)
ON CONFLICT (name) DO UPDATE SET label = EXCLUDED.label;

-- 2. Asegurar que las acciones existan
INSERT INTO public.actions (name, label)
VALUES ('read', 'Leer')
ON CONFLICT (name) DO NOTHING; -- O según constricciones de la tabla actions

-- 3. Asegurar que los módulos existan en public.modules
INSERT INTO public.modules (key, label, description, is_active)
VALUES 
  ('catalog_products', 'Productos Catálogo', 'Acceso a productos globales', true),
  ('categories', 'Categorías', 'Acceso a categorías del catálogo', true),
  ('stores', 'Tiendas', 'Acceso a tiendas', true),
  ('store_products', 'Productos Tienda', 'Acceso a stock y precios por tienda', true),
  ('orders', 'Pedidos', 'Consulta de pedidos', true),
  ('product_stock_movements', 'Movimientos Stock', 'Movimientos de inventario', true),
  ('store_offers', 'Ofertas Tienda', 'Ofertas y descuentos', true)
ON CONFLICT (parent_id, key) DO NOTHING;

-- 4. Asociar permisos en public.role_permissions
INSERT INTO public.role_permissions (role_id, module_id, action_id)
SELECT r.id, m.id, a.id
FROM public.roles r
CROSS JOIN public.modules m
CROSS JOIN public.actions a
WHERE r.name = 'b2chat_integration'
  AND m.key IN ('catalog_products', 'categories', 'stores', 'store_products', 'orders', 'product_stock_movements', 'store_offers')
  AND a.name = 'read'
ON CONFLICT (role_id, module_id, action_id) DO NOTHING;
```

---

## Verification Plan

### Automated & Manual Verification
Para verificar que los cambios funcionan correctamente y que el sistema de permisos bloquea/permite los accesos según la configuración, realizaremos las siguientes pruebas:

1. **Prueba de Autenticación sin Token**:
   - Ejecutar una consulta `GET /api/b2chat/products` sin cabeceras.
   - **Resultado esperado**: Status `401 Unauthorized`.
2. **Prueba con Token no Válido**:
   - Enviar cabecera `Authorization: Bearer token_falso`.
   - **Resultado esperado**: Status `401 Unauthorized`.
3. **Prueba de Permisos Insuficientes**:
   - Autenticarse con una cuenta de usuario que tenga un rol *sin* el permiso asignado para el módulo `catalog_products`.
   - Enviar `GET /api/b2chat/products`.
   - **Resultado esperado**: Status `403 Forbidden` con mensaje indicando falta de privilegios.
4. **Prueba de Permiso Exitoso**:
   - Autenticarse con una cuenta de usuario cuyo rol *tenga* permiso de lectura para `catalog_products`.
   - Enviar `GET /api/b2chat/products`.
   - **Resultado esperado**: Status `200 OK` retornando la lista de productos y URLs públicas de imágenes.
