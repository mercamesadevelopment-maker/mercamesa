-- RLS en las tablas que no la tenían (revisión de la base, 20 de octubre de 2026).
--
-- Tercer y último paso. Los anteriores ya quitaron la escritura desde afuera
-- (20261020182323_seguridad_permisos_escritura.sql) y movieron al servidor lo que
-- lee datos de otras personas. Aquí cada sesión ve solo lo suyo:
--
--   - catálogo, tiendas, plazas y ofertas: lo activo es público; lo inactivo lo
--     ven su tienda y el admin;
--   - pedidos, partes, productos del pedido, pagos y direcciones: el comprador,
--     la tienda de esa parte y la plataforma;
--   - perfiles y clientes: el propio, y los de quien compró en la tienda o
--     trabaja en ella;
--   - invitaciones y miembros de plaza: solo el servidor.
--
-- «La plataforma» es admin, superadmin y la integración de B2Chat, que lee
-- pedidos. No se usa `has_permission('orders', 'read')` porque la clave `orders`
-- está repetida: también la tiene el tendero sobre `/seller/orders`, y vería los
-- pedidos de todas las tiendas.
--
-- Las funciones de abajo son `security definer` para que una política no
-- dependa de la RLS de otra tabla (y no se llamen en círculo). Las políticas
-- comparan además la fila directo (`buyer_id = auth.uid()`): una función no ve la
-- fila que se está insertando, y sin eso un `insert … returning` del dueño falla.


-- ============================================================== funciones

create or replace function public.es_lector_de_plataforma()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active
      and r.name in ('admin', 'superadmin', 'b2chat_integration')
  );
$$;

create or replace function public.tienda_de_producto(p_store_product uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select store_id from store_products where id = p_store_product;
$$;

-- El comprador del pedido, una tienda con una parte en él, o la plataforma.
create or replace function public.puede_ver_pedido(p_order uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from orders o where o.id = p_order and o.buyer_id = auth.uid())
      or exists (select 1 from store_orders so where so.order_id = p_order and is_store_member(so.store_id))
      or es_lector_de_plataforma();
$$;

-- La parte de una tienda: su comprador, esa tienda o la plataforma.
create or replace function public.puede_ver_parte(p_store_order uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
           select 1 from store_orders so join orders o on o.id = so.order_id
           where so.id = p_store_order and (o.buyer_id = auth.uid() or is_store_member(so.store_id))
         )
      or es_lector_de_plataforma();
$$;

-- Un producto de un pedido: el comprador o la tienda de ese producto (no las
-- otras tiendas del mismo pedido), o la plataforma.
create or replace function public.puede_ver_producto_de_pedido(p_order uuid, p_store_product uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from orders o where o.id = p_order and o.buyer_id = auth.uid())
      or is_store_member(tienda_de_producto(p_store_product))
      or es_lector_de_plataforma();
$$;

-- Una dirección: su dueño, una tienda con un pedido para esa dirección, o la plataforma.
create or replace function public.puede_ver_direccion(p_address uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from delivery_addresses d where d.id = p_address and d.buyer_id = auth.uid())
      or exists (
           select 1 from orders o join store_orders so on so.order_id = o.id
           where o.delivery_address_id = p_address and is_store_member(so.store_id)
         )
      or es_lector_de_plataforma();
$$;

-- Un perfil: el propio; el de quien compró en mi tienda, trabaja en ella o
-- cambió el estado de una de sus partes; o la plataforma.
create or replace function public.puede_ver_perfil(p_profile uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select p_profile = auth.uid()
      or es_lector_de_plataforma()
      or exists (
           select 1 from orders o join store_orders so on so.order_id = o.id
           where o.buyer_id = p_profile and is_store_member(so.store_id)
         )
      or exists (
           select 1 from store_members suyo join store_members mio on mio.store_id = suyo.store_id
           where suyo.user_id = p_profile and mio.user_id = auth.uid()
         )
      or exists (
           select 1 from store_order_status_history h join store_orders so on so.id = h.store_order_id
           where h.changed_by = p_profile and is_store_member(so.store_id)
         );
$$;

-- Un cliente de mostrador: la tienda con un pedido suyo, la que puede ver al
-- comprador con cuenta que es ese cliente, o la plataforma.
create or replace function public.puede_ver_cliente(p_client uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select es_lector_de_plataforma()
      or exists (
           select 1 from orders o join store_orders so on so.order_id = o.id
           where o.client_id = p_client and is_store_member(so.store_id)
         )
      or exists (
           select 1 from clients c
           where c.id = p_client and c.profile_id is not null and puede_ver_perfil(c.profile_id)
         );
$$;

-- Las políticas se evalúan con el rol de quien consulta, también `anon` (la
-- vitrina), así que todos pueden ejecutar estas funciones. Solo responden sí o
-- no sobre quien pregunta.


-- ============================================================== catálogo, tiendas y plazas

alter table public.stores enable row level security;
create policy stores_select on public.stores for select to anon, authenticated
  using (is_active or is_store_member(id) or es_lector_de_plataforma());
create policy stores_insert on public.stores for insert to authenticated
  with check (is_platform_admin());
create policy stores_update on public.stores for update to authenticated
  using (is_store_member(id) or is_platform_admin())
  with check (is_store_member(id) or is_platform_admin());
create policy stores_delete on public.stores for delete to authenticated
  using (is_platform_admin());

alter table public.marketplaces enable row level security;
create policy marketplaces_select on public.marketplaces for select to anon, authenticated
  using (
    is_active or es_lector_de_plataforma()
    or exists (select 1 from stores s where s.marketplace_id = marketplaces.id and is_store_member(s.id))
  );
create policy marketplaces_write on public.marketplaces for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

-- El catálogo maestro no tiene datos sensibles: se lee completo (el carrito y
-- los pedidos muestran el nombre aunque el producto ya no esté activo).
alter table public.catalog_products enable row level security;
create policy catalog_products_select on public.catalog_products for select to anon, authenticated
  using (true);
create policy catalog_products_insert on public.catalog_products for insert to authenticated
  with check (has_permission('catalog', 'create'));
create policy catalog_products_update on public.catalog_products for update to authenticated
  using (has_permission('catalog', 'update')) with check (has_permission('catalog', 'update'));
create policy catalog_products_delete on public.catalog_products for delete to authenticated
  using (has_permission('catalog', 'delete'));

alter table public.store_categories enable row level security;
create policy store_categories_select on public.store_categories for select to anon, authenticated
  using (true);
create policy store_categories_write on public.store_categories for all to authenticated
  using (is_platform_admin()) with check (is_platform_admin());

alter table public.store_category_links enable row level security;
create policy store_category_links_select on public.store_category_links for select to anon, authenticated
  using (true);
create policy store_category_links_write on public.store_category_links for all to authenticated
  using (is_store_member(store_id) or is_platform_admin())
  with check (is_store_member(store_id) or is_platform_admin());

-- Una oferta activa es pública; una pendiente o rechazada la ven su tienda y la plataforma.
alter table public.store_offers enable row level security;
create policy store_offers_select on public.store_offers for select to anon, authenticated
  using (status = 'active' or is_store_member(tienda_de_producto(store_product_id)) or es_lector_de_plataforma());
create policy store_offers_write on public.store_offers for all to authenticated
  using (is_store_member(tienda_de_producto(store_product_id)) or is_platform_admin())
  with check (is_store_member(tienda_de_producto(store_product_id)) or is_platform_admin());


-- ============================================================== pedidos
-- Ninguna sesión escribe aquí (lo hace el servidor): solo hay políticas de lectura.

alter table public.orders enable row level security;
create policy orders_select on public.orders for select to authenticated
  using (buyer_id = auth.uid() or puede_ver_pedido(id));

alter table public.store_orders enable row level security;
create policy store_orders_select on public.store_orders for select to authenticated
  using (puede_ver_parte(id));

alter table public.order_items enable row level security;
create policy order_items_select on public.order_items for select to authenticated
  using (puede_ver_producto_de_pedido(order_id, store_product_id));

alter table public.payments enable row level security;
create policy payments_select on public.payments for select to authenticated
  using (
    exists (select 1 from orders o where o.id = payments.order_id and o.buyer_id = auth.uid())
    or es_lector_de_plataforma()
  );

alter table public.delivery_addresses enable row level security;
create policy delivery_addresses_select on public.delivery_addresses for select to authenticated
  using (buyer_id = auth.uid() or puede_ver_direccion(id));
create policy delivery_addresses_insert on public.delivery_addresses for insert to authenticated
  with check (buyer_id = auth.uid());
create policy delivery_addresses_update on public.delivery_addresses for update to authenticated
  using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy delivery_addresses_delete on public.delivery_addresses for delete to authenticated
  using (buyer_id = auth.uid());

drop policy if exists "Allow read access to authenticated users" on public.store_order_status_history;
drop policy if exists "Allow insert access to authenticated users" on public.store_order_status_history;
create policy store_order_status_history_select on public.store_order_status_history for select to authenticated
  using (puede_ver_parte(store_order_id));

-- «Mis órdenes» la lee el servidor (`/api/orders/my-orders`) filtrando por el
-- comprador. La vista no pasa por la RLS de sus tablas: con ella, un pedido de
-- una tienda o un producto desactivados desaparecería del historial del comprador.
revoke select on public.orders_detail_view from authenticated;


-- ============================================================== personas

drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (puede_ver_perfil(id));

drop policy if exists "Permitir lectura a usuarios autenticados" on public.clients;
drop policy if exists "Permitir inserción a usuarios autenticados" on public.clients;
drop policy if exists "Permitir edición a usuarios autenticados" on public.clients;
create policy clients_select on public.clients for select to authenticated
  using (puede_ver_cliente(id));

drop policy if exists "Allow read to authenticated" on public.product_stock_movements;
drop policy if exists "Allow insert to authenticated" on public.product_stock_movements;
create policy product_stock_movements_select on public.product_stock_movements for select to authenticated
  using (is_store_member(store_id) or es_lector_de_plataforma());
create policy product_stock_movements_insert on public.product_stock_movements for insert to authenticated
  with check (is_store_member(store_id) or is_platform_admin());


-- ============================================================== solo el servidor

alter table public.invitations enable row level security;
alter table public.marketplace_members enable row level security;
alter table public.marketplace_delivery_users enable row level security;


-- ============================================================== vistas públicas

-- Con los permisos de quien consulta: la vitrina y las plazas muestran lo que
-- la RLS de sus tablas deja ver (lo activo). La vitrina une categorías y
-- unidades, que hasta hoy solo se leían con sesión: son catálogo público.
create policy categories_select_anon on public.categories for select to anon using (true);
create policy measurement_units_select_anon on public.measurement_units for select to anon using (true);
alter view public.marketplaces_detail set (security_invoker = true);
alter view public.vitrina_productos set (security_invoker = true);
