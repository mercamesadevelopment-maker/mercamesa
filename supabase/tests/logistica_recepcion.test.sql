-- Recepción en la bahía y servicios de logística por día.
-- Migración: 20261108150000_logistica_recepcion.sql

begin;
\ir _helpers/fixtures.inc
select plan(16);

-- La plaza de prueba tiene logística; otra plaza no.
update public.marketplaces set logistics_enabled = true where id = '00000000-0000-0000-0000-000000000100';

insert into public.marketplaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000110', 'Plaza sin logística', 'plaza-sin-logistica');
insert into public.stores (id, marketplace_id, name, slug)
values ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000110', 'Tienda C', 'tienda-c');

-- 500: dos tiendas, logística recibió las dos (una con novedad). Salió a las
--      11:30 p. m. del 2 de noviembre en Colombia (ya 3 de noviembre en UTC).
-- 510: una tienda, sin recepción, pero logística la despachó el 3.
-- 520: recibida y todavía en la plaza: no cuenta.
-- 530: salió sin que logística interviniera: no cuenta.
-- 540: de la plaza sin logística.
insert into public.orders (id, buyer_id, consecutive, fulfillment, logistics_required, logistics_dispatched_at)
values
  ('00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000001', 999501, 'consolidated', true, null),
  ('00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000001', 999511, 'store', false, '2026-11-03 15:00Z'),
  ('00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000001', 999521, 'consolidated', true, null),
  ('00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000001', 999531, 'store', false, null),
  ('00000000-0000-0000-0000-000000000540', '00000000-0000-0000-0000-000000000001', 999541, 'store', false, null);

insert into public.store_orders (id, order_id, store_id, status, bay_received_at, bay_damaged, bay_observation)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000101', 'dispatched', '2026-11-02 20:00Z', false, null),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000500', '00000000-0000-0000-0000-000000000102', 'dispatched', '2026-11-02 21:00Z', true, 'Tomates aplastados'),
  ('00000000-0000-0000-0000-000000000511', '00000000-0000-0000-0000-000000000510', '00000000-0000-0000-0000-000000000101', 'dispatched', null, false, null),
  ('00000000-0000-0000-0000-000000000521', '00000000-0000-0000-0000-000000000520', '00000000-0000-0000-0000-000000000101', 'at_collection', '2026-11-03 10:00Z', false, null),
  ('00000000-0000-0000-0000-000000000531', '00000000-0000-0000-0000-000000000530', '00000000-0000-0000-0000-000000000102', 'dispatched', null, false, null),
  ('00000000-0000-0000-0000-000000000541', '00000000-0000-0000-0000-000000000540', '00000000-0000-0000-0000-000000000111', 'dispatched', null, false, null);

insert into public.store_order_status_history (store_order_id, status, created_at)
values
  ('00000000-0000-0000-0000-000000000501', 'dispatched', '2026-11-03 04:30Z'),
  ('00000000-0000-0000-0000-000000000502', 'dispatched', '2026-11-03 04:31Z'),
  ('00000000-0000-0000-0000-000000000511', 'dispatched', '2026-11-03 15:00Z'),
  ('00000000-0000-0000-0000-000000000531', 'dispatched', '2026-11-03 16:00Z'),
  ('00000000-0000-0000-0000-000000000541', 'dispatched', '2026-11-03 17:00Z');

insert into public.store_order_bay_photos (store_order_id, path, mime_type)
values ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000502/foto.jpg', 'image/jpeg');

-- ---------------------------------------------------------------------------
-- Las fotos solo las lee el servidor
-- ---------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.store_order_bay_photos'::regclass),
  'store_order_bay_photos tiene RLS');
select ok(not has_table_privilege('anon', 'public.store_order_bay_photos', 'select'), 'anon no lee las fotos');
select ok(not has_table_privilege('authenticated', 'public.store_order_bay_photos', 'select'),
  'una sesión no lee las fotos');
select ok(not has_table_privilege('authenticated', 'public.store_order_bay_photos', 'insert'),
  'una sesión no registra fotos');

select pg_temp.como('00000000-0000-0000-0000-000000000002');
select throws_ok($$ select 1 from public.store_order_bay_photos $$, '42501', null,
  'el tendero tampoco las lee directo: van por el servidor con URL firmada');
select pg_temp.como_postgres();

select is((select public from storage.buckets where id = 'logistica'), false, 'el bucket logistica es privado');
select is((select file_size_limit from storage.buckets where id = 'logistica'), 8388608::bigint, 'hasta 8 MB por foto');

select throws_ok(
  $$ update public.store_orders set bay_observation = repeat('x', 501) where id = '00000000-0000-0000-0000-000000000501' $$,
  '23514', null, 'una observación de más de 500 caracteres no se guarda');

-- ---------------------------------------------------------------------------
-- Servicios por día
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select day, services, parts_received, parts_damaged
       from public.logistics_services_by_day('2026-11-01', '2026-12-01', '00000000-0000-0000-0000-000000000100') $$,
  $$ values ('2026-11-02'::date, 1, 2, 1), ('2026-11-03'::date, 1, 0, 0) $$,
  'un servicio por pedido: el de dos tiendas cuenta una vez con sus dos partes, y el despachado por logística también'
);

select is(
  (select day from public.logistics_services_by_day('2026-11-01', '2026-12-01', null)
    where marketplace_id = '00000000-0000-0000-0000-000000000100' order by day limit 1),
  '2026-11-02'::date,
  'una salida a las 11:30 p. m. de Colombia cuenta ese día, no el siguiente'
);

select is(
  (select coalesce(sum(services), 0)::int from public.logistics_services_by_day('2026-11-01', '2026-12-01', null)),
  2,
  'no cuentan el pedido que sigue en la plaza ni el que salió sin logística'
);

select is_empty(
  $$ select 1 from public.logistics_services_by_day('2026-11-01', '2026-12-01', '00000000-0000-0000-0000-000000000110') $$,
  'la plaza sin logística no tiene servicios'
);

select results_eq(
  $$ select day from public.logistics_services_by_day('2026-11-03', '2026-11-04', null) $$,
  $$ values ('2026-11-03'::date) $$,
  'el periodo es en fechas de Colombia: el del día 2 queda por fuera del 3'
);

-- ---------------------------------------------------------------------------
-- La función es solo del servidor
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.logistics_services_by_day(date, date, uuid)', 'execute'),
  'sin sesión no se llama');
select ok(not has_function_privilege('authenticated', 'public.logistics_services_by_day(date, date, uuid)', 'execute'),
  'con sesión tampoco');
select ok(has_function_privilege('service_role', 'public.logistics_services_by_day(date, date, uuid)', 'execute'),
  'el servidor sí');

select * from finish();
rollback;
