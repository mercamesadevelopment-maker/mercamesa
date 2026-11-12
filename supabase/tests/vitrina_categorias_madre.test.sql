-- La vitrina por categoría y subcategoría.
-- Migración: 20261111180000_vitrina_categorias_madre.sql

begin;
\ir _helpers/fixtures.inc
select plan(7);

insert into public.categories (id, name, slug, parent_id) values
  ('00000000-0000-0000-0000-000000000700', 'Frutas y verduras', 'prueba-frutas-y-verduras', null),
  ('00000000-0000-0000-0000-000000000701', 'Frutas frescas', 'prueba-frutas-frescas', '00000000-0000-0000-0000-000000000700'),
  ('00000000-0000-0000-0000-000000000702', 'Hongos', 'prueba-hongos', '00000000-0000-0000-0000-000000000700'),
  ('00000000-0000-0000-0000-000000000710', 'Velas', 'prueba-velas', null);

-- Mango y fresa en «Frutas frescas», champiñón en «Hongos» y un cirio colgado
-- directo de «Velas», sin subcategoría.
insert into public.catalog_products (id, name, slug, siigo_id, category_id) values
  ('00000000-0000-0000-0000-000000000720', 'Mango prueba', 'mango-prueba', 'P720', '00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000721', 'Fresa prueba', 'fresa-prueba', 'P721', '00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000722', 'Champiñón prueba', 'champinon-prueba', 'P722', '00000000-0000-0000-0000-000000000702'),
  ('00000000-0000-0000-0000-000000000723', 'Cirio prueba', 'cirio-prueba', 'P723', '00000000-0000-0000-0000-000000000710');

insert into public.store_products (store_id, catalog_product_id, unit_id, price_per_unit, is_active)
select '00000000-0000-0000-0000-000000000101', cp.id, (select id from public.measurement_units limit 1), 1000, true
from public.catalog_products cp where cp.id::text like '00000000-0000-0000-0000-00000000072%';

update public.stores set is_active = true where id = '00000000-0000-0000-0000-000000000101';

select is(
  (select parent_category_name from public.vitrina_productos where product_name = 'Mango prueba'),
  'Frutas y verduras',
  'la vista trae la categoría madre del producto'
);
select is(
  (select category_name from public.vitrina_productos where product_name = 'Mango prueba'),
  'Frutas frescas',
  'y sigue trayendo su categoría directa (la subcategoría)'
);
select is(
  (select parent_category_name from public.vitrina_productos where product_name = 'Cirio prueba'),
  'Velas',
  'un producto colgado directo de una categoría sin madre la tiene como madre'
);

select results_eq(
  $$ select categoria, subcategoria, total::int from public.vitrina_arbol_categorias('00000000-0000-0000-0000-000000000101') $$,
  $$ values ('Frutas y verduras', 'Frutas frescas', 2), ('Frutas y verduras', 'Hongos', 1), ('Velas', null::text, 1) $$,
  'el árbol de la tienda: categoría, subcategoría y cuántos productos'
);

select is_empty(
  $$ select 1 from public.vitrina_arbol_categorias('00000000-0000-0000-0000-000000000102') $$,
  'una tienda sin productos no tiene categorías'
);

select pg_temp.como_anon();
select ok(
  (select count(*) from public.vitrina_arbol_categorias('00000000-0000-0000-0000-000000000101')) = 3,
  'sin sesión se puede consultar: es la vitrina pública'
);
select ok(
  (select count(*) from public.vitrina_productos where parent_category_name = 'Frutas y verduras') >= 3,
  'y filtrar la vista por la categoría madre'
);

select * from finish();
rollback;
