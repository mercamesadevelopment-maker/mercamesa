-- Las tablas de equipo de plaza que no se usaban ya no están, y el precio
-- mínimo de compra vive en el historial de tarifas.
-- Migración: 20261020224122_tablas_sobrantes.sql

begin;
\ir _helpers/fixtures.inc
select plan(11);

select hasnt_table('public', 'marketplace_members', 'marketplace_members ya no existe');
select hasnt_table('public', 'marketplace_delivery_users', 'marketplace_delivery_users ya no existe');

-- Reglas de las columnas nuevas
select throws_ok(
  $$ insert into public.pricing_settings_history
       (service_commission_rate, message_unit_price, messages_per_order, platform_commission_rate,
        siigo_delivery_product_code, siigo_platform_product_code, change_type)
     values (0.03, 0, 0, 0.15, 'D', 'P', 'otro') $$,
  '23514', null, 'un tipo de ajuste que no existe no se guarda');

select throws_ok(
  $$ insert into public.pricing_settings_history
       (service_commission_rate, message_unit_price, messages_per_order, platform_commission_rate,
        siigo_delivery_product_code, siigo_platform_product_code, order_min_price)
     values (0.03, 0, 0, 0.15, 'D', 'P', -1) $$,
  '23514', null, 'un mínimo negativo no se guarda');

select ok(not has_function_privilege('anon', 'public.copiar_precio_minimo_al_historial()', 'execute'),
  'sin sesión no se puede llamar la copia del historial');
select ok(not has_function_privilege('authenticated', 'public.copiar_precio_minimo_al_historial()', 'execute'),
  'con sesión tampoco');

-- La copia del historial, sobre datos controlados. Los pedidos apuntan a las
-- tarifas: dentro de la transacción se suelta esa llave para poder vaciarlas.
alter table public.orders drop constraint orders_pricing_settings_id_fkey;
delete from public.pricing_settings_history;
delete from public.order_min_price_history;

insert into public.order_min_price_history (min_price, notes, created_at) values
  (10000, 'antes de las tarifas', '2000-01-01'),
  (25000, 'después de las tarifas', '2000-01-03');
insert into public.pricing_settings_history
  (service_commission_rate, message_unit_price, messages_per_order, platform_commission_rate,
   siigo_delivery_product_code, siigo_platform_product_code, notes, created_at)
values (0.03, 50, 2, 0.15, 'D', 'P', 'tarifa inicial', '2000-01-02');

select public.copiar_precio_minimo_al_historial();

select is(
  (select order_min_price from public.pricing_settings_history where notes = 'tarifa inicial'),
  10000.00::numeric,
  'la tarifa lleva el mínimo vigente cuando se registró');

select results_eq(
  $$ select change_type, order_min_price, service_commission_rate, message_unit_price,
            siigo_platform_product_code, created_at
     from public.pricing_settings_history where notes = 'después de las tarifas' $$,
  $$ values ('order_min_price'::text, 25000.00::numeric, 0.0300::numeric, 50.00::numeric,
             'P'::text, '2000-01-03'::timestamptz) $$,
  'un ajuste del mínimo es una fila con las tarifas de ese momento');

select is((select count(*)::int from public.pricing_settings_history), 2,
  'el ajuste anterior a la primera tarifa no entra como fila');

select public.copiar_precio_minimo_al_historial();
select is((select count(*)::int from public.pricing_settings_history), 2,
  'llamarla otra vez no duplica nada');

select is(
  (select order_min_price from public.pricing_settings_history order by created_at desc limit 1),
  25000.00::numeric,
  'el mínimo vigente es el del último ajuste');

select * from finish();
rollback;
