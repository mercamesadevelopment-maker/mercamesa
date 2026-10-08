-- El tendero no podía cambiar el logo ni la portada de su tienda.
--
-- Las políticas del bucket `stores` (ver 20261001190000_base.sql) solo dejan
-- escribir a quien tenga permisos del módulo `stores`, y el rol `seller` no
-- tiene ninguno: la subida desde Configuración respondía «new row violates
-- row-level security policy». La ruta PUT /api/stores/[id] ya autoriza al
-- miembro de la tienda; esto le da el mismo alcance en Storage, limitado a la
-- carpeta de su propia tienda (`imgs/{store_id}/…`, que es la convención tanto
-- del tendero como del modal del admin).
--
-- Se suman a las políticas del admin, que no cambian. Solo crea una función y
-- políticas: no toca ningún archivo ni fila.

-- ¿El archivo está en la carpeta de una tienda de la que el usuario es miembro?
-- El cast va dentro de un `case` porque Postgres no garantiza el orden de un
-- `and`: así una ruta que no lleve un uuid devuelve false en vez de lanzar error.
create or replace function public.fn_is_store_image_of_member(p_name text)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select case
    when p_name ~ '^imgs/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      then public.fn_is_store_member(split_part(p_name, '/', 2)::uuid)
    else false
  end;
$$;

create policy stores_member_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'stores' and public.fn_is_store_image_of_member(name));

-- Necesaria porque la subida usa `upsert: true` y las variantes se reescriben.
create policy stores_member_update on storage.objects for update to authenticated
  using (bucket_id = 'stores' and public.fn_is_store_image_of_member(name))
  with check (bucket_id = 'stores' and public.fn_is_store_image_of_member(name));

-- Para borrar la imagen anterior y sus variantes al reemplazarla.
create policy stores_member_delete on storage.objects for delete to authenticated
  using (bucket_id = 'stores' and public.fn_is_store_image_of_member(name));
