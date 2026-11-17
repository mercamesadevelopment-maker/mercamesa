-- Un producto exclusivo de un grupo aparece solo en las tiendas del grupo, sin
-- publicar y con precio 0; y nada se publica sin precio.
-- Migración: 20261117190000_productos_de_grupo_en_sus_tiendas.sql

begin;
\ir _helpers/fixtures.inc
select plan(10);

insert into public.measurement_units (id, name, abbreviation)
values ('00000000-0000-0000-0000-000000000a00', 'Unidad de prueba', 'upr');

insert into public.store_groups (id, name, slug)
values
  ('00000000-0000-0000-0000-000000000a01', 'Grupo A', 'grupo-a'),
  ('00000000-0000-0000-0000-000000000a02', 'Grupo B', 'grupo-b');

update public.stores set store_group_id = '00000000-0000-0000-0000-000000000a01'
where id = '00000000-0000-0000-0000-000000000101';

-- Público, y después se marca exclusivo del grupo A.
insert into public.catalog_products (id, name, slug, siigo_id, default_unit_id)
values ('00000000-0000-0000-0000-000000000a11', 'Huevo de aldana', 'huevo-de-aldana-prueba', 'PRUEBAA11', '00000000-0000-0000-0000-000000000a00');
select is((select count(*)::int from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a11'),
  0, 'un producto público no se asigna a nadie');

update public.catalog_products set owner_group_id = '00000000-0000-0000-0000-000000000a01'
where id = '00000000-0000-0000-0000-000000000a11';
select results_eq(
  $$select is_active, price_per_unit, stock, code like 'MM-%' from public.store_products
    where catalog_product_id = '00000000-0000-0000-0000-000000000a11' and store_id = '00000000-0000-0000-0000-000000000101'$$,
  $$values (false, 0::numeric(12,2), 0::numeric(12,3), true)$$,
  'al volverse exclusivo aparece en la tienda del grupo, sin publicar, sin precio y con código');
select is((select count(*)::int from public.store_products
  where catalog_product_id = '00000000-0000-0000-0000-000000000a11' and store_id = '00000000-0000-0000-0000-000000000102'),
  0, 'la tienda que no está en el grupo no lo recibe');

-- En revisión no se asigna; al aprobarse, sí.
insert into public.catalog_products (id, name, slug, siigo_id, default_unit_id, owner_group_id, review_status)
values ('00000000-0000-0000-0000-000000000a12', 'Chorizo', 'chorizo-prueba', 'PRUEBAA12', '00000000-0000-0000-0000-000000000a00',
        '00000000-0000-0000-0000-000000000a01', 'pending');
select is((select count(*)::int from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a12'),
  0, 'un producto en revisión no se asigna');
update public.catalog_products set review_status = 'approved' where id = '00000000-0000-0000-0000-000000000a12';
select is((select count(*)::int from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a12'),
  1, 'al aprobarse aparece en la tienda del grupo');

-- La tienda que entra a un grupo recibe sus productos.
insert into public.catalog_products (id, name, slug, siigo_id, default_unit_id, owner_group_id)
values ('00000000-0000-0000-0000-000000000a13', 'Velas', 'velas-prueba', 'PRUEBAA13', '00000000-0000-0000-0000-000000000a00',
        '00000000-0000-0000-0000-000000000a02');
update public.stores set store_group_id = '00000000-0000-0000-0000-000000000a02'
where id = '00000000-0000-0000-0000-000000000102';
select is((select count(*)::int from public.store_products
  where catalog_product_id = '00000000-0000-0000-0000-000000000a13' and store_id = '00000000-0000-0000-0000-000000000102'),
  1, 'la tienda que entra a un grupo recibe los productos del grupo');

-- Lo que la tienda ya tenía no se toca, y repetir no duplica.
update public.store_products set price_per_unit = 9000, is_active = true
where catalog_product_id = '00000000-0000-0000-0000-000000000a11';
select is(public.asignar_productos_de_grupo(), 0, 'volver a correrlo no crea nada');
select is((select price_per_unit from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a11'),
  9000::numeric(12,2), 'no pisa el precio que puso la tienda');

-- Lo que la tienda borra no vuelve si no cambia nada del producto.
delete from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a12';
update public.catalog_products set name = 'Chorizo de cerdo' where id = '00000000-0000-0000-0000-000000000a12';
select is((select count(*)::int from public.store_products where catalog_product_id = '00000000-0000-0000-0000-000000000a12'),
  0, 'lo que la tienda borró no vuelve al editar el nombre');

select throws_ok(
  $$update public.store_products set is_active = true where catalog_product_id = '00000000-0000-0000-0000-000000000a13'$$,
  '23514', null, 'no se publica un producto con precio 0');

select * from finish();
rollback;
