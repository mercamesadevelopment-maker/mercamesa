-- Productos del catálogo propuestos por un tendero: estado de revisión y unirlos
-- con uno que ya existía.
-- Migración: 20261021212142_catalogo_en_revision.sql

begin;
\ir _helpers/fixtures.inc
select plan(10);

insert into public.measurement_units (id, name, abbreviation)
values ('00000000-0000-0000-0000-000000000900', 'Unidad de prueba', 'upr');

-- Uno aprobado (el existente) y dos propuestos por la Tienda A.
insert into public.catalog_products (id, name, slug, siigo_id, review_status, proposed_by_store_id)
values
  ('00000000-0000-0000-0000-000000000901', 'Guayaba', 'guayaba-prueba', 'PRUEBA901', 'approved', null),
  ('00000000-0000-0000-0000-000000000902', 'Guallaba', 'guallaba-prueba', 'PRUEBA902', 'pending', '00000000-0000-0000-0000-000000000101'),
  ('00000000-0000-0000-0000-000000000903', 'Guayabita', 'guayabita-prueba', 'PRUEBA903', 'pending', '00000000-0000-0000-0000-000000000101');

insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values
  -- La Tienda A vende el propuesto 902.
  ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000900', 3000),
  -- La Tienda B vende el propuesto 903 y también el existente 901.
  ('00000000-0000-0000-0000-000000000912', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000900', 3000),
  ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000900', 3000);

-- Reglas de la columna
select throws_ok(
  $$ update public.catalog_products set review_status = 'otro' where id = '00000000-0000-0000-0000-000000000901' $$,
  '23514', null, 'un estado de revisión que no existe no se guarda');
select is(
  (select review_status from public.catalog_products where slug = 'guayaba-prueba'),
  'approved', 'lo que no dice nada queda aprobado');

-- Solo el servidor puede unir
select ok(not has_function_privilege('anon', 'public.merge_catalog_product(uuid,uuid)', 'execute'), 'sin sesión no se puede unir');
select ok(not has_function_privilege('authenticated', 'public.merge_catalog_product(uuid,uuid)', 'execute'), 'con sesión tampoco');

-- Unir: la tienda pasa a vender el existente y el propuesto se borra
select is(
  public.merge_catalog_product('00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000901'),
  1, 'mueve el producto de la tienda que lo vendía');
select is(
  (select catalog_product_id from public.store_products where id = '00000000-0000-0000-0000-000000000911'),
  '00000000-0000-0000-0000-000000000901'::uuid, 'la Tienda A ahora vende el existente, con su mismo precio y código');
select is_empty(
  $$ select 1 from public.catalog_products where id = '00000000-0000-0000-0000-000000000902' $$,
  'el propuesto se borra');

-- No se puede unir si la tienda ya vende el existente
select throws_ok(
  $$ select public.merge_catalog_product('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000901') $$,
  '23505', 'La tienda "Tienda B" ya vende ese producto. Retira uno de los dos antes de unirlos.',
  'si la tienda ya vende el existente, se detiene y lo dice');

-- Solo se une un pendiente, y con uno aprobado
select throws_ok(
  $$ select public.merge_catalog_product('00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000903') $$,
  'P0002', 'El producto ya no está en revisión', 'un aprobado no se une');
select throws_ok(
  $$ select public.merge_catalog_product('00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000903') $$,
  '23514', null, 'no se une consigo mismo');

select * from finish();
rollback;
