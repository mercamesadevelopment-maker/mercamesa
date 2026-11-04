-- El máximo por pedido de una oferta: vacío o mayor que cero.
-- Migración: 20261103222356_oferta_maximo_por_pedido.sql

begin;
\ir _helpers/fixtures.inc
select plan(4);

insert into public.measurement_units (id, name, abbreviation)
values ('00000000-0000-0000-0000-000000000900', 'Unidad de prueba', 'upr');
insert into public.catalog_products (id, name, slug, siigo_id)
values ('00000000-0000-0000-0000-000000000901', 'Producto de prueba', 'producto-prueba-oferta', 'PRUEBA901');
insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000101',
        '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000900', 5000);

select lives_ok(
  $$ insert into public.store_offers (store_product_id, discount_pct, starts_at)
     values ('00000000-0000-0000-0000-000000000911', 10, now()) $$,
  'sin máximo: la oferta no tiene límite');

select lives_ok(
  $$ update public.store_offers set max_qty_per_order = 2.5
     where store_product_id = '00000000-0000-0000-0000-000000000911' $$,
  'un máximo con decimales, para productos por kg');

select throws_ok(
  $$ update public.store_offers set max_qty_per_order = 0
     where store_product_id = '00000000-0000-0000-0000-000000000911' $$,
  '23514', null, 'cero no es un máximo');

select throws_ok(
  $$ update public.store_offers set max_qty_per_order = -1
     where store_product_id = '00000000-0000-0000-0000-000000000911' $$,
  '23514', null, 'un negativo tampoco');

select * from finish();
rollback;
