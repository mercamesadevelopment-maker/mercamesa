-- Evidencia del tendero al marcar «Listo Recogida».
-- Migración: 20261123140000_evidencia_del_tendero.sql

begin;
\ir _helpers/fixtures.inc
select plan(5);

-- Una tienda, plaza sin logística: salió con fotos del tendero y nada de logística.
insert into public.orders (id, buyer_id, consecutive, fulfillment, logistics_required, logistics_dispatched_at)
values ('00000000-0000-0000-0000-000000000900', '00000000-0000-0000-0000-000000000001', 999901, 'store', false, null);

insert into public.store_orders (id, order_id, store_id, status, store_evidence_at, store_evidence_by, store_observation)
values ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000900',
        '00000000-0000-0000-0000-000000000101', 'dispatched', '2026-11-03 14:00Z',
        '00000000-0000-0000-0000-000000000002', '2 bolsas');

insert into public.store_order_status_history (store_order_id, status, created_at)
values ('00000000-0000-0000-0000-000000000901', 'dispatched', '2026-11-03 15:00Z');

insert into public.store_order_bay_photos (store_order_id, path, mime_type, source)
values ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000901/tienda/a.jpg', 'image/jpeg', 'store');

select is(
  (select source from public.store_order_bay_photos where store_order_id = '00000000-0000-0000-0000-000000000901'),
  'store',
  'la foto queda marcada como de la tienda'
);

select throws_ok(
  $$ insert into public.store_order_bay_photos (store_order_id, path, source)
     values ('00000000-0000-0000-0000-000000000901', 'x/otra.jpg', 'patinador') $$,
  '23514', null,
  'solo logística o la tienda'
);

select throws_ok(
  $$ update public.store_orders set store_observation = repeat('x', 501) where id = '00000000-0000-0000-0000-000000000901' $$,
  '23514', null,
  'la observación del tendero tiene máximo 500 caracteres'
);

-- Sin columna `source` explícita la foto es de logística, como las de antes.
insert into public.store_order_bay_photos (store_order_id, path)
values ('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000901/vieja.jpg');
select is(
  (select source from public.store_order_bay_photos where path = '00000000-0000-0000-0000-000000000901/vieja.jpg'),
  'logistics',
  'las fotos de antes son de logística'
);

select is(
  (select coalesce(sum(services), 0)::int from public.logistics_services_by_day('2026-11-01', '2026-11-30')
    where marketplace_id = '00000000-0000-0000-0000-000000000100'),
  0,
  'las fotos del tendero no cuentan como servicio de logística'
);

select * from finish();
rollback;
