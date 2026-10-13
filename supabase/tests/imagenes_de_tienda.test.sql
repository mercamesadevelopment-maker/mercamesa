-- El tendero sube el logo y la portada de SU tienda, y de ninguna otra.
-- Migración: 20261011000000_imagenes_de_tienda_del_tendero.sql

begin;
\ir _helpers/fixtures.inc
select plan(8);

-- La función que deciden las tres políticas (insertar, reemplazar, borrar).
select pg_temp.como('00000000-0000-0000-0000-000000000002');

select ok(public.fn_is_store_image_of_member('imgs/00000000-0000-0000-0000-000000000101/logo-1.png'),
  'el tendero puede escribir en la carpeta de su tienda');
select ok(not public.fn_is_store_image_of_member('imgs/00000000-0000-0000-0000-000000000102/logo-1.png'),
  'pero no en la de otra tienda');
select ok(not public.fn_is_store_image_of_member('imgs/no-es-un-uuid/logo.png'),
  'una ruta sin uuid devuelve false, no un error');
select ok(not public.fn_is_store_image_of_member('otra-carpeta/00000000-0000-0000-0000-000000000101/x.png'),
  'fuera de imgs/ no aplica');

-- Lo mismo a través de RLS, como llega la subida del navegador.
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('stores', 'imgs/00000000-0000-0000-0000-000000000101/logo-1.png', auth.uid()) $$,
  'el tendero sube el logo de su tienda');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('stores', 'imgs/00000000-0000-0000-0000-000000000102/logo-1.png', auth.uid()) $$,
  '42501', null,
  'y no puede subirlo a otra tienda');

-- Reemplazar (upsert): el update solo alcanza su archivo.
update storage.objects set metadata = '{"x":1}'
where bucket_id = 'stores' and name like 'imgs/00000000-0000-0000-0000-000000000101/%';
select is((select count(*)::int from storage.objects
           where bucket_id = 'stores' and metadata = '{"x":1}'), 1,
  'el tendero reemplaza el archivo de su tienda');

-- Un comprador cualquiera no puede.
select pg_temp.como('00000000-0000-0000-0000-000000000004');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('stores', 'imgs/00000000-0000-0000-0000-000000000101/intruso.png', auth.uid()) $$,
  '42501', null,
  'un comprador no sube imágenes a una tienda');

select * from finish();
rollback;
