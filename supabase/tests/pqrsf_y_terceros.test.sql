-- PQRSF (felicitación) y el código de Siigo de «Productos de terceros».
-- Migración: 20261109140000_pqrsf_y_productos_de_terceros.sql

begin;
\ir _helpers/fixtures.inc
select plan(8);

select matches(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'pqrs_kind_check'),
  'felicitacion',
  'pqrs_kind_check acepta la felicitación'
);
select matches(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'pqrs_kind_check'),
  'sugerencia',
  'y sigue aceptando la sugerencia'
);
select doesnt_match(
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'pqrs_kind_check'),
  'solicitud',
  'no hay un tipo «solicitud»'
);

select has_column('public', 'pricing_settings_history', 'siigo_third_party_product_code',
  'el código de Productos de terceros se parametriza');
select col_is_null('public', 'pricing_settings_history', 'siigo_platform_product_code',
  'el código del antiguo servicio ya no es obligatorio');

-- Un ajuste nuevo se guarda sin el código del servicio.
select lives_ok(
  $$ insert into public.pricing_settings_history
       (service_commission_rate, message_unit_price, messages_per_order, platform_commission_rate,
        siigo_delivery_product_code, siigo_third_party_product_code, change_type)
     values (0.0299, 120, 6, 0.15, 'Domicilios', 'Productos-de-Terceros', 'rates') $$,
  'un ajuste con Domicilio y Productos de terceros, sin servicio, se guarda'
);

select is(
  (select count(*)::int from public.modules where key in ('my-pqrs', 'seller-pqrs', 'admin-pqrs') and label = 'PQRSF'),
  3,
  'el menú dice PQRSF para el comprador, el tendero y el admin'
);
select is(
  (select count(*)::int from public.modules where label = 'PQRS'),
  0,
  'no queda ningún módulo llamado PQRS'
);

select * from finish();
rollback;
