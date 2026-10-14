-- Quién puede ver el domicilio de un pedido: el comprador, la tienda y el
-- admin; nadie más. Migración: 20261010000000_pibox_seguimiento.sql

begin;
\ir _helpers/fixtures.inc
select plan(11);

insert into public.orders (id, buyer_id, consecutive)
values ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 999001);

insert into public.store_orders (id, order_id, store_id)
values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000102');

insert into public.pibox_bookings (store_order_id, booking_id)
values
  ('00000000-0000-0000-0000-000000000201', 'reserva-a'),
  ('00000000-0000-0000-0000-000000000202', 'reserva-b');

select pg_temp.como('00000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.pibox_bookings), 2,
  'el comprador ve el domicilio de cada tienda de su pedido');

select pg_temp.como('00000000-0000-0000-0000-000000000002');
select results_eq('select booking_id from public.pibox_bookings', $$ values ('reserva-a') $$,
  'el tendero ve solo el domicilio de su tienda');

select pg_temp.como('00000000-0000-0000-0000-000000000003');
-- Solo las de la prueba: la base local trae también las de la copia de producción.
select is((select count(*)::int from public.pibox_bookings where booking_id in ('reserva-a', 'reserva-b')), 2,
  'el admin ve todos');

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty('select 1 from public.pibox_bookings', 'otro comprador no ve nada');

select pg_temp.como_postgres();
select has_column('public', 'pibox_bookings', 'last_event_at',
  'existe last_event_at, que descarta los eventos atrasados');

-- Una sola reserva activa por pedido (20261014000000): Picap relanza sobre la
-- misma reserva, así que una segunda activa siempre es un error.
select throws_ok(
  $$ insert into public.pibox_bookings (store_order_id, booking_id, is_active)
     values ('00000000-0000-0000-0000-000000000201', 'reserva-a-2', true) $$,
  '23505', null, 'no se admiten dos reservas activas para el mismo pedido');

select lives_ok(
  $$ insert into public.pibox_bookings (store_order_id, booking_id, is_active)
     values ('00000000-0000-0000-0000-000000000201', 'reserva-a-vieja', false) $$,
  'una reserva inactiva más sí (el historial)');

-- Los alias de relanzamiento llevan a la reserva principal.
update public.pibox_bookings set alias_booking_ids = array['relanzada-1']
 where booking_id = 'reserva-a';
select is((select booking_id from public.pibox_bookings where 'relanzada-1' = any (alias_booking_ids)),
  'reserva-a', 'un id de relanzamiento se resuelve a la reserva principal');

-- Bitácora: la leen las mismas personas que el domicilio.
insert into public.pibox_booking_events (store_order_id, booking_id, event_booking_id, event_cd, status_cd, driver_name, payload)
values ('00000000-0000-0000-0000-000000000201', 'reserva-a', 'relanzada-1', 0, 1, 'Ana', '{}'),
       ('00000000-0000-0000-0000-000000000202', 'reserva-b', 'reserva-b', 0, 0, null, '{}');

select pg_temp.como('00000000-0000-0000-0000-000000000002');
select results_eq('select booking_id from public.pibox_booking_events',
  $$ values ('reserva-a') $$, 'el tendero ve solo la bitácora de su tienda');

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty('select 1 from public.pibox_booking_events', 'otro comprador no ve la bitácora');

select pg_temp.como('00000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ insert into public.pibox_booking_events (event_cd, payload) values (0, '{}') $$,
  '42501', null, 'nadie escribe la bitácora desde la app: solo el servidor');

select * from finish();
rollback;
