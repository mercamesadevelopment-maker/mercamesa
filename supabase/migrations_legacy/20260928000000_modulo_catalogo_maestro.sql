-- Permiso propio para escribir en el catálogo maestro.
--
-- Las rutas de /api/products exigían `system-settings`, que es el módulo de la
-- pantalla de Parametrización. Funcionaba mientras `admin` lo tuviera, pero
-- 20260922030000_add_superadmin_role.sql se lo quitó para separar admin de
-- superadmin — y con eso dejó sin poder editar el catálogo a quien lo construyó:
-- la cuenta `admin` creó 2.971 de los 3.588 productos.
--
-- El síntoma era confuso porque el permiso de la imagen y el de la fila son
-- distintos: el bucket `products` pide `products.create`, que `admin` sí tiene,
-- así que la imagen se subía y solo después fallaba el guardado, con un 403 que
-- no deja rastro en los logs por ser una respuesta normal.
--
-- No se reusa el módulo `products` que ya existe, aunque ya le dé permiso a
-- `admin`: hay DOS módulos con esa clave —«Catálogo Maestro» (/admin/products) y
-- «Productos» (/seller/products)— y `has_permission` busca por clave, así que
-- acepta cualquiera de las dos. Gatear ahí le abriría el catálogo maestro a
-- sellers y store_owners. Renombrar la clave del módulo del tendero tampoco
-- sirve: la política de storage `products_upload` usa `products.create`, que es
-- justo lo que les deja subir las fotos de sus propios productos.

-- `where not exists` y no `on conflict`: el único de `modules` es
-- (parent_id, key) —por eso conviven dos filas con clave `products`— y con
-- `parent_id` nulo esa restricción no deduplica, porque en un índice único dos
-- nulos no son iguales. Así la migración sí es idempotente.
insert into public.modules (key, label, description, path, icon, sort_order, is_active)
select
  'master-catalog',
  'Catálogo maestro',
  'Permiso para crear, editar y borrar productos del catálogo maestro desde /api/products.',
  -- SIN path, a propósito. El proxy resuelve el módulo de una ruta con
  -- `.eq('path', pathname).maybeSingle()`: una segunda fila con /admin/products
  -- haría fallar ese maybeSingle, `moduleRow` llegaría nulo y el control fino se
  -- saltaría EN SILENCIO para esa ruta. La pantalla ya la protege el módulo
  -- «Catálogo Maestro»; este es solo para la API.
  null,
  null,
  0,
  true
where not exists (
  select 1 from public.modules where key = 'master-catalog'
);

-- Las cuatro acciones, para admin y superadmin. Es exactamente lo que `admin`
-- tenía antes del 22 de septiembre sobre el catálogo, ni más ni menos: no
-- recupera parametrización, documentos legales, módulos, precios ni dispersiones.
insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r
cross join public.modules m
cross join public.actions a
where r.name in ('admin', 'superadmin')
  and m.key = 'master-catalog'
  and a.name in ('create', 'read', 'update', 'delete')
on conflict do nothing;
