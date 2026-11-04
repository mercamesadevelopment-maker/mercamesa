-- Avisos del pedido para Meteor: qué evento deja cada cambio, que no se repitan,
-- la entrega única del pedido de varias tiendas, quién puede leerlos y la
-- limpieza a los 7 días.
-- Migración: 20261104212325_avisos_whatsapp.sql

begin;
\ir _helpers/fixtures.inc
select plan(12);

-- Pedido de una tienda (…300) y pedido de varias tiendas (…310).
insert into public.orders (id, buyer_id, consecutive)
values ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001', 999301);
insert into public.orders (id, buyer_id, consecutive, fulfillment)
values ('00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000001', 999310, 'consolidated');
insert into public.store_orders (id, order_id, store_id)
values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000311', '00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000312', '00000000-0000-0000-0000-000000000310', '00000000-0000-0000-0000-000000000102');

create function pg_temp.avisos(p_order uuid, p_tipo text) returns bigint language sql as $$
  select count(*) from public.whatsapp_events where order_id = p_order and event_type = p_tipo
$$;

-- --- Pago aprobado
update public.orders set payment_status = 'approved' where id = '00000000-0000-0000-0000-000000000300';
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'pedido_confirmado'), 1::bigint, 'el pago aprobado deja «pedido confirmado»');
update public.orders set payment_status = 'approved' where id = '00000000-0000-0000-0000-000000000300';
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'pedido_confirmado'), 1::bigint, 'y no se repite');

-- --- Cambios de estado
insert into public.store_order_status_history (store_order_id, status) values
  ('00000000-0000-0000-0000-000000000301', 'confirmed'),
  ('00000000-0000-0000-0000-000000000301', 'packing'),
  ('00000000-0000-0000-0000-000000000301', 'packing');
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'parte_estado'), 1::bigint,
  '«empacando» deja un aviso, una sola vez; «confirmado» no (lo cubre el pago)');

insert into public.store_order_status_history (store_order_id, status, is_reversal)
values ('00000000-0000-0000-0000-000000000301', 'at_collection', true);
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'parte_estado'), 1::bigint,
  'una corrección manual no avisa');

-- --- Domicilio
insert into public.pibox_bookings (store_order_id, booking_id) values ('00000000-0000-0000-0000-000000000301', 'reserva-aviso');
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'domicilio_en_camino'), 0::bigint, 'sin enlace de seguimiento no avisa');
update public.pibox_bookings set tracking_link = 'https://seguimiento/1' where booking_id = 'reserva-aviso';
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'domicilio_en_camino'), 1::bigint, 'con el enlace, sí');
update public.pibox_bookings set tracking_link = 'https://seguimiento/2' where booking_id = 'reserva-aviso';
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'domicilio_en_camino'), 1::bigint, 'un enlace nuevo no lo repite');

-- --- Varias tiendas: una sola entrega, cuando termina la última parte
update public.store_orders set status = 'delivered' where id = '00000000-0000-0000-0000-000000000311';
insert into public.store_order_status_history (store_order_id, status) values ('00000000-0000-0000-0000-000000000311', 'delivered');
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000310', 'parte_estado'), 0::bigint,
  'varias tiendas: la primera parte entregada no avisa');
update public.store_orders set status = 'delivered' where id = '00000000-0000-0000-0000-000000000312';
insert into public.store_order_status_history (store_order_id, status) values ('00000000-0000-0000-0000-000000000312', 'delivered');
select results_eq(
  $$ select store_order_id, status_to from public.whatsapp_events
     where order_id = '00000000-0000-0000-0000-000000000310' and event_type = 'parte_estado' $$,
  $$ values (null::uuid, 'delivered'::text) $$,
  'la última sí, una vez y para el pedido completo');

-- --- Solo el servidor
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select throws_ok($$ select * from public.whatsapp_events $$, '42501', null, 'el comprador no puede leer la tabla');
select pg_temp.como_postgres();

-- --- El cursor crece
select ok((select bool_and(seq > 0) and count(distinct seq) = count(*) from public.whatsapp_events), 'cada aviso tiene su número de cursor');

-- --- Limpieza a los 7 días: el comando de la tarea programada
update public.whatsapp_events set created_at = now() - interval '8 days'
  where order_id = '00000000-0000-0000-0000-000000000300' and event_type = 'pedido_confirmado';
do $$ begin execute (select command from cron.job where jobname = 'whatsapp_events_cleanup'); end $$;
select is(pg_temp.avisos('00000000-0000-0000-0000-000000000300', 'pedido_confirmado'), 0::bigint,
  'la tarea diaria borra los de más de 7 días');

select * from finish();
rollback;
