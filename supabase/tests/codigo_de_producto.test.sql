-- El código del producto de una tienda: si llega vacío, la base lo genera.
-- Migración: 20261029204141_codigo_de_producto_generado.sql

begin;
\ir _helpers/fixtures.inc
select plan(10);

insert into public.measurement_units (id, name, abbreviation)
values ('00000000-0000-0000-0000-000000000900', 'Unidad de prueba', 'upr');

insert into public.catalog_products (id, name, slug, siigo_id)
select ('00000000-0000-0000-0000-00000000090' || n)::uuid, 'Producto ' || n, 'producto-prueba-' || n, 'PRUEBA90' || n
from generate_series(1, 6) n;

-- Un consecutivo conocido, y la Tienda A ya escribió a mano el siguiente.
select setval('public.store_product_code_seq', 500);
insert into public.store_products (store_id, catalog_product_id, unit_id, price_per_unit, code)
values ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000901', '00000000-0000-0000-0000-000000000900', 1000, 'mm-000501');

insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000900', 1000);
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000911'),
  'MM-000502', 'sin código se genera uno, y se salta el que la tienda ya escribió a mano');

insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit, code)
values ('00000000-0000-0000-0000-000000000912', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000903', '00000000-0000-0000-0000-000000000900', 1000, '   ');
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000912'),
  'MM-000503', 'un código en blanco cuenta como vacío');

insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit, code)
values ('00000000-0000-0000-0000-000000000913', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000904', '00000000-0000-0000-0000-000000000900', 1000, '7702004003508');
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000913'),
  '7702004003508', 'el código que escribe la tienda se respeta');

insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values ('00000000-0000-0000-0000-000000000914', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000902', '00000000-0000-0000-0000-000000000900', 1000);
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000914'),
  'MM-000504', 'otra tienda sigue el mismo consecutivo: no hay dos iguales');

-- Al editar
update public.store_products set code = '' where id = '00000000-0000-0000-0000-000000000913';
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000913'),
  'MM-000505', 'vaciarlo al editar genera uno nuevo');

update public.store_products set price_per_unit = 2000 where id = '00000000-0000-0000-0000-000000000911';
select is((select code from public.store_products where id = '00000000-0000-0000-0000-000000000911'),
  'MM-000502', 'editar otra cosa no cambia el código');

-- Los que ya estaban sin código (la copia se carga sin triggers)
alter table public.store_products disable trigger store_products_codigo_generado;
insert into public.store_products (id, store_id, catalog_product_id, unit_id, price_per_unit)
values ('00000000-0000-0000-0000-000000000915', '00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000905', '00000000-0000-0000-0000-000000000900', 1000);
alter table public.store_products enable trigger store_products_codigo_generado;

select public.asignar_codigos_faltantes();
select is((select count(*)::int from public.store_products where code is null), 0, 'asignar_codigos_faltantes no deja ninguno sin código');
select matches((select code from public.store_products where id = '00000000-0000-0000-0000-000000000915'),
  '^MM-\d{6}$', 'y les pone el mismo formato');

-- Solo el servidor
select ok(not has_function_privilege('authenticated', 'public.asignar_codigos_faltantes()', 'execute'), 'con sesión no se puede llenar en lote');
select ok(not has_function_privilege('authenticated', 'public.generar_codigo_producto(uuid)', 'execute'), 'ni pedir códigos sueltos');

select * from finish();
rollback;
