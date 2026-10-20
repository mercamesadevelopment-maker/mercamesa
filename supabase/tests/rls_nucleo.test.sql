-- Quién ve qué en las tablas núcleo: catálogo y tiendas públicos en lo activo;
-- pedidos, pagos, direcciones, perfiles y clientes solo para quien corresponde.
-- Migración: 20261020213006_rls_tablas_nucleo.sql

begin;
\ir _helpers/fixtures.inc
select plan(35);

-- ---------------------------------------------------------------------------
-- Datos: una tienda inactiva, productos, un pedido del comprador en las dos
-- tiendas (con dirección, pago e historial), una venta de mostrador de la
-- tienda A a un cliente, y un cliente sin relación con nadie.
-- ---------------------------------------------------------------------------
insert into public.stores (id, marketplace_id, name, slug, is_active)
values ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000100', 'Tienda C', 'tienda-c', false);

insert into public.measurement_units (id, name, abbreviation)
values ('00000000-0000-0000-0000-000000000500', 'Unidad de prueba', 'upr');
insert into public.catalog_products (id, name, slug, siigo_id)
values ('00000000-0000-0000-0000-000000000501', 'Papa de prueba', 'papa-de-prueba', 'PRUEBA1');
insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values
  ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000500', 1000),
  ('00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000500', 1000);
insert into public.store_offers (store_product_id, starts_at, status, discount_pct)
values
  ('00000000-0000-0000-0000-000000000510', now(), 'pending', 10),
  ('00000000-0000-0000-0000-000000000520', now(), 'active', 10);

insert into public.delivery_addresses (id, buyer_id, address_line, latitude, longitude, delivery_instructions)
values ('00000000-0000-0000-0000-000000000600', '00000000-0000-0000-0000-000000000001', 'Calle 1', 4.65, -74.05, 'Torre 2, apto 301');

insert into public.orders (id, buyer_id, consecutive, delivery_address_id)
values ('00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000001', 999701, '00000000-0000-0000-0000-000000000600');
insert into public.store_orders (id, order_id, store_id)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000102');
insert into public.order_items (order_id, store_product_id, catalog_name, unit_name, quantity, unit_price, total_price)
values
  ('00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000510', 'Papa', 'upr', 1, 1000, 1000),
  ('00000000-0000-0000-0000-000000000700', '00000000-0000-0000-0000-000000000520', 'Papa', 'upr', 1, 1000, 1000);
insert into public.payments (order_id, str_id_pago, amount)
values ('00000000-0000-0000-0000-000000000700', 'pago-de-prueba', 2000);
insert into public.store_order_status_history (store_order_id, status, changed_by)
values ('00000000-0000-0000-0000-000000000701', 'packing', '00000000-0000-0000-0000-000000000002');

insert into public.clients (id, document_number, full_name)
values
  ('00000000-0000-0000-0000-000000000800', '900800', 'Cliente de mostrador'),
  ('00000000-0000-0000-0000-000000000801', '900801', 'Cliente de otra parte');
insert into public.orders (id, client_id, consecutive)
values ('00000000-0000-0000-0000-000000000710', '00000000-0000-0000-0000-000000000800', 999710);
insert into public.store_orders (order_id, store_id)
values ('00000000-0000-0000-0000-000000000710', '00000000-0000-0000-0000-000000000101');

insert into public.invitations (email, invitation_type, role, token, expires_at)
values ('invitado@prueba.test', 'admin', 'admin', 'token-de-prueba', now() + interval '1 day');

-- ---------------------------------------------------------------------------
-- Sin sesión: lo activo del catálogo, nada de pedidos
-- ---------------------------------------------------------------------------
select pg_temp.como_anon();
select is((select count(*)::int from public.stores where marketplace_id = '00000000-0000-0000-0000-000000000100'), 2,
  'sin sesión se ven las tiendas activas, no la inactiva');
select is((select count(*)::int from public.store_offers where store_product_id in
  ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000520')), 1,
  'sin sesión se ve la oferta activa, no la pendiente');
select throws_ok('select 1 from public.orders', '42501', null, 'sin sesión no se leen pedidos');
select throws_ok('select 1 from public.payments', '42501', null, 'sin sesión no se leen pagos');

-- ---------------------------------------------------------------------------
-- El comprador: su pedido completo
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.orders where id = '00000000-0000-0000-0000-000000000700'), 1, 'el comprador ve su pedido');
select is((select count(*)::int from public.store_orders where order_id = '00000000-0000-0000-0000-000000000700'), 2, '...sus dos partes');
select is((select count(*)::int from public.order_items where order_id = '00000000-0000-0000-0000-000000000700'), 2, '...todos sus productos');
select is((select count(*)::int from public.payments where order_id = '00000000-0000-0000-0000-000000000700'), 1, '...su pago');
select is((select count(*)::int from public.delivery_addresses where id = '00000000-0000-0000-0000-000000000600'), 1, '...y su dirección');
select is((select count(*)::int from public.store_order_status_history where store_order_id = '00000000-0000-0000-0000-000000000701'), 1, '...y el historial de cada parte');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000004' $$, 'el comprador no ve perfiles ajenos');
select is_empty('select 1 from public.clients', 'el comprador no ve clientes de las tiendas');
select is_empty($$ select 1 from public.orders where id = '00000000-0000-0000-0000-000000000710' $$, 'ni pedidos de otros');

-- ---------------------------------------------------------------------------
-- Un usuario sin relación: nada
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty($$ select 1 from public.orders where id = '00000000-0000-0000-0000-000000000700' $$, 'un extraño no ve el pedido');
select is_empty($$ select 1 from public.store_orders where order_id = '00000000-0000-0000-0000-000000000700' $$, '...ni sus partes');
select is_empty($$ select 1 from public.payments where order_id = '00000000-0000-0000-0000-000000000700' $$, '...ni su pago');
select is_empty($$ select 1 from public.delivery_addresses where id = '00000000-0000-0000-0000-000000000600' $$, '...ni la dirección');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000001' $$, '...ni el perfil del comprador');

-- ---------------------------------------------------------------------------
-- El tendero de la tienda A: su parte y lo que necesita para entregarla
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.orders where id = '00000000-0000-0000-0000-000000000700'), 1, 'el tendero ve el pedido donde tiene una parte');
select is((select count(*)::int from public.store_orders where order_id = '00000000-0000-0000-0000-000000000700'), 1, '...solo su parte, no la de la tienda B');
select is((select count(*)::int from public.order_items where order_id = '00000000-0000-0000-0000-000000000700'), 1, '...solo sus productos');
select is_empty($$ select 1 from public.payments where order_id = '00000000-0000-0000-0000-000000000700' $$, '...no el pago');
select is((select count(*)::int from public.delivery_addresses where id = '00000000-0000-0000-0000-000000000600'), 1, '...sí la dirección de entrega');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-000000000001'), 1, '...y el perfil del comprador');
select is_empty($$ select 1 from public.profiles where id = '00000000-0000-0000-0000-000000000004' $$, 'no ve perfiles de quien no le ha comprado');
select is((select array_agg(id::text order by id) from public.clients), array['00000000-0000-0000-0000-000000000800'],
  've el cliente de su venta de mostrador, no otros');
select lives_ok($$ insert into public.product_stock_movements (store_product_id, store_id, type, quantity)
  values ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000101', 'entry', 1) $$,
  'registra inventario en su tienda');
select throws_ok($$ insert into public.product_stock_movements (store_product_id, store_id, type, quantity)
  values ('00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000102', 'entry', 1) $$,
  '42501', null, 'pero no en otra tienda');
update public.stores set name = 'otro nombre' where id = '00000000-0000-0000-0000-000000000102';

-- ---------------------------------------------------------------------------
-- El admin: todo; las invitaciones, solo el servidor
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.store_orders where order_id = '00000000-0000-0000-0000-000000000700'), 2, 'el admin ve las dos partes');
select is((select count(*)::int from public.payments where order_id = '00000000-0000-0000-0000-000000000700'), 1, '...y el pago');
select ok((select count(*) from public.profiles) >= 4, '...y los perfiles');
select is_empty('select 1 from public.invitations', 'ni el admin lee invitaciones desde el navegador');

-- ---------------------------------------------------------------------------
-- Vistas
-- ---------------------------------------------------------------------------
select pg_temp.como_postgres();
select is((select name from public.stores where id = '00000000-0000-0000-0000-000000000102'), 'Tienda B',
  'el tendero no pudo editar otra tienda');
select ok(not has_table_privilege('authenticated', 'public.orders_detail_view', 'select'),
  'una sesión no consulta orders_detail_view: la lee el servidor');
select is((select count(*)::int from pg_class where relname in ('vitrina_productos', 'marketplaces_detail')
  and 'security_invoker=true' = any(reloptions)), 2, 'la vitrina y las plazas respetan la RLS de quien consulta');

select * from finish();
rollback;
