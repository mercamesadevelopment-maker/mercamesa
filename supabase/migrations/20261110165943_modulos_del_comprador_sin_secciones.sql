-- Productos, Tiendas y Plazas dejan de estar dentro de «Secciones».
--
-- El comprador veía en el menú «Secciones» con tres hijos (Productos, Tiendas
-- y Plazas, en `/sections/...`). Pasan a ser módulos de primer nivel, como los
-- demás, en `/products` y `/stores`. «Plazas» se unifica con la que ya estaba
-- en primer nivel (`/marketplaces`, ofertas del día y lista de plazas), así que
-- la de adentro se borra, y «Secciones» se queda sin hijos y también se borra.
--
-- Los enlaces viejos `/sections/...` redirigen (next.config.js). El proxy da
-- acceso por la `path` exacta del módulo, así que con esto `/products` y
-- `/stores` quedan para los mismos roles que tenían (los permisos van con el
-- módulo, no con la ruta).
--
-- Menú del comprador: Plazas · Tiendas · Productos · Promociones · Mis Órdenes · PQRSF.
-- Los módulos vienen de las migraciones: existen en cualquier base recién creada.

do $$
declare
  v_secciones uuid;
begin
  select id into v_secciones from public.modules where key = 'sections' and parent_id is null;

  update public.modules set parent_id = null, path = '/stores', sort_order = 2
  where key = 'allStores' and parent_id = v_secciones;

  update public.modules set parent_id = null, path = '/products', sort_order = 3
  where key = 'AllProducts' and parent_id = v_secciones;

  -- Sus permisos se van con él (`role_permissions` borra en cascada).
  delete from public.modules where key = 'AllMarketplaces' and parent_id = v_secciones;

  -- «Secciones», ya sin hijos. Si alguien le hubiera colgado otro, se queda.
  delete from public.modules m
  where m.id = v_secciones
    and not exists (select 1 from public.modules c where c.parent_id = m.id);
end $$;

-- El orden del resto del menú del comprador, después de Tiendas y Productos.
update public.modules set sort_order = 4 where key = 'promotions' and parent_id is null;
update public.modules set sort_order = 5 where key = 'myOrders' and parent_id is null;
update public.modules set sort_order = 6 where key = 'my-pqrs' and parent_id is null;
