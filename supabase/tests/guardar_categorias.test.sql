-- Guardar categorías en lote: todo o nada, con permisos y con la forma del árbol.
-- Migración: 20261110163948_guardar_categorias_en_lote.sql

begin;
\ir _helpers/fixtures.inc
select plan(9);

-- Dos categorías de partida, creadas como superusuario.
insert into public.categories (id, name, slug) values
  ('00000000-0000-0000-0000-00000000ca01', 'Frutas prueba', 'frutas-prueba'),
  ('00000000-0000-0000-0000-00000000ca02', 'Verduras prueba', 'verduras-prueba');

-- En los datos de referencia, Parametrización (`system-settings`) es del superadmin.
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-000000000005', 'superadmin@prueba.test', 'authenticated', 'authenticated');
insert into public.profiles (id, role_id, full_name, email)
select '00000000-0000-0000-0000-000000000005', r.id, 'Superadmin', 'superadmin@prueba.test'
from public.roles r where r.name = 'superadmin';

select pg_temp.como('00000000-0000-0000-0000-000000000005');

-- Una madre nueva y su hija nueva en el mismo lote, más una edición.
select lives_ok(
  $$ select public.guardar_categorias('[
       {"key":"nueva-2","id":null,"slug":"jugos-prueba","name":"Jugos prueba","parent_key":"nueva-1","description":null,"sort_order":2,"is_active":true},
       {"key":"nueva-1","id":null,"slug":"bebidas-prueba","name":"Bebidas prueba","parent_key":null,"description":"Para tomar","sort_order":1,"is_active":true},
       {"key":"00000000-0000-0000-0000-00000000ca02","id":"00000000-0000-0000-0000-00000000ca02","slug":null,"name":"Hortalizas prueba","parent_key":null,"description":null,"sort_order":5,"is_active":false}
     ]'::jsonb) $$,
  'quien tiene Parametrización guarda un lote con madre e hija nuevas');

select is(
  (select m.slug from public.categories h join public.categories m on m.id = h.parent_id where h.slug = 'jugos-prueba'),
  'bebidas-prueba',
  'la hija nueva quedó dentro de la madre nueva');

select is(
  (select name || '|' || sort_order || '|' || is_active from public.categories where id = '00000000-0000-0000-0000-00000000ca02'),
  'Hortalizas prueba|5|false',
  'la edición se aplicó');

-- Un tercer nivel se rechaza, y el lote entero se deshace.
select throws_ok(
  $$ select public.guardar_categorias('[
       {"key":"nueva-9","id":null,"slug":"limas-prueba","name":"Limas prueba","parent_key":"00000000-0000-0000-0000-00000000ca01","description":null,"sort_order":0,"is_active":true},
       {"key":"00000000-0000-0000-0000-00000000ca02","id":"00000000-0000-0000-0000-00000000ca02","slug":null,"name":"Hortalizas prueba","parent_key":"00000000-0000-0000-0000-00000000ca01","description":null,"sort_order":0,"is_active":true},
       {"key":"x","id":null,"slug":"nivel-3-prueba","name":"Nivel 3","parent_key":"00000000-0000-0000-0000-00000000ca02","description":null,"sort_order":0,"is_active":true}
     ]'::jsonb) $$,
  'P0001', null, 'una subcategoría de una subcategoría se rechaza');

select is((select count(*)::int from public.categories where slug in ('limas-prueba', 'nivel-3-prueba')), 0,
  'y no quedó nada del lote fallido');
select is((select parent_id from public.categories where id = '00000000-0000-0000-0000-00000000ca02'), null::uuid,
  'ni la edición que venía en él');

select throws_ok(
  $$ select public.guardar_categorias('[
       {"key":"00000000-0000-0000-0000-00000000ca01","id":"00000000-0000-0000-0000-00000000ca01","slug":null,"name":"Frutas prueba","parent_key":"00000000-0000-0000-0000-00000000ca01","description":null,"sort_order":0,"is_active":true}
     ]'::jsonb) $$,
  'P0001', null, 'una categoría no puede ser su propia madre');

-- Un comprador no crea ni edita.
select pg_temp.como('00000000-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.guardar_categorias('[{"key":"nueva-1","id":null,"slug":"de-un-comprador","name":"De un comprador","parent_key":null,"description":null,"sort_order":0,"is_active":true}]'::jsonb) $$,
  '42501', null, 'un comprador no crea categorías');

select throws_ok(
  $$ select public.guardar_categorias('[{"key":"00000000-0000-0000-0000-00000000ca01","id":"00000000-0000-0000-0000-00000000ca01","slug":null,"name":"Cambiada","parent_key":null,"description":null,"sort_order":0,"is_active":true}]'::jsonb) $$,
  'P0001', null, 'ni las edita');

select * from finish();
rollback;
