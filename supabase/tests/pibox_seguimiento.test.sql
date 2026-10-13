-- Quién puede ver el domicilio de un pedido: el comprador, la tienda y el
-- admin; nadie más. Migración: 20261010000000_pibox_seguimiento.sql

begin;
\ir _helpers/fixtures.inc
select plan(5);

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
select is((select count(*)::int from public.pibox_bookings), 2, 'el admin ve todos');

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty('select 1 from public.pibox_bookings', 'otro comprador no ve nada');

select pg_temp.como_postgres();
select has_column('public', 'pibox_bookings', 'last_event_at',
  'existe last_event_at, que descarta los eventos atrasados');

select * from finish();
rollback;
