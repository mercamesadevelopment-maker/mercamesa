-- Patinador y logística: quién ve el equipo de la plaza, qué puede hacer
-- logística y la reserva del mensajero de un pedido entero.
-- Migración: 20261016000100_patinador_y_logistica.sql

begin;
\ir _helpers/fixtures.inc
select plan(14);

-- Una persona de logística de la plaza de prueba.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000005', 'logistica@prueba.test', 'authenticated', 'authenticated');

insert into public.profiles (id, role_id, full_name, email)
select '00000000-0000-0000-0000-000000000005', id, 'Logística', 'logistica@prueba.test'
from public.roles where name = 'logistics';

insert into public.marketplace_staff (marketplace_id, user_id, role)
values ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000005', 'logistics');

-- Un pedido de dos tiendas.
insert into public.orders (id, buyer_id, consecutive, fulfillment, logistics_required)
values ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', 999301, 'consolidated', true);

insert into public.store_orders (id, order_id, store_id)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000102');

insert into public.pibox_bookings (order_id, booking_id, is_active)
values ('00000000-0000-0000-0000-000000000300', 'reserva-del-pedido', true);

-- ---------------------------------------------------------------------------
-- El equipo de la plaza solo lo lee el servidor
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000003');
select is_empty('select 1 from public.marketplace_staff',
  'ni un admin lee marketplace_staff desde el navegador: no tiene políticas');

select pg_temp.como('00000000-0000-0000-0000-000000000005');
select is_empty('select 1 from public.marketplace_staff',
  'logística tampoco lee su propia fila');

-- ---------------------------------------------------------------------------
-- Logística: solo recibir y despachar
-- ---------------------------------------------------------------------------
select ok(public.has_permission('orders', 'dispatch'), 'logística puede marcar en camino');
select ok(public.has_permission('orders', 'receive'), 'logística puede recibir en la bahía');
select ok(not public.has_permission('orders', 'update'), 'logística no tiene el update general de las órdenes');
select ok(not public.has_permission('marketplace', 'read'), 'logística no entra a otras páginas del admin');

select pg_temp.como_postgres();
select is(
  (select count(*)::int
     from public.role_permissions rp
     join public.roles r on r.id = rp.role_id
     join public.modules m on m.id = rp.module_id
    where r.name = 'logistics'),
  3,
  'logística tiene exactamente tres permisos: ver, recibir y despachar'
);

-- ---------------------------------------------------------------------------
-- La reserva del pedido entero
-- ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.pibox_bookings where booking_id = 'reserva-del-pedido'), 1,
  'el comprador ve la reserva de su pedido de varias tiendas');

select pg_temp.como('00000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.pibox_bookings where booking_id = 'reserva-del-pedido'), 1,
  'una tienda del pedido también la ve');

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty($$ select 1 from public.pibox_bookings where booking_id = 'reserva-del-pedido' $$,
  'otro comprador no');

select pg_temp.como_postgres();
select throws_ok(
  $$ insert into public.pibox_bookings (order_id, booking_id, is_active)
     values ('00000000-0000-0000-0000-000000000300', 'otra-reserva', true) $$,
  '23505', null,
  'un pedido no puede tener dos reservas vigentes'
);

select throws_ok(
  $$ insert into public.pibox_bookings (order_id, store_order_id, booking_id)
     values ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000301', 'de-los-dos') $$,
  '23514', null,
  'una reserva es del pedido o de una tienda, no de los dos'
);

-- ---------------------------------------------------------------------------
-- Límites
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ update public.store_orders set packing_notes = repeat('x', 501)
      where id = '00000000-0000-0000-0000-000000000301' $$,
  '23514', null,
  'las notas de empaque no pasan de 500 caracteres'
);

select throws_ok(
  $$ update public.marketplaces set runner_enabled = true, runner_commission_type = 'percent', runner_commission_value = 120
      where id = '00000000-0000-0000-0000-000000000100' $$,
  '23514', null,
  'la comisión en porcentaje no pasa de 100'
);

select * from finish();
rollback;
