-- Documentación de tiendas: que el estado lo decida solo quien administra.
--
-- Punto de partida, verificado en producción con la sesión de un tendero:
-- `store_documents` tenía una política llamada "Allow all access to admin" que
-- en realidad estaba concedida al rol `authenticated` con USING true y
-- WITH CHECK true. El nombre decía una cosa y la regla hacía otra: cualquier
-- usuario con sesión podía leer y escribir CUALQUIER fila. Medido: el tendero
-- de prueba veía 28 documentos (19 de tiendas ajenas) y un PATCH directo a
-- PostgREST le dejaba marcar como "approved" el documento de otra tienda.
--
-- El bucket `store-documents` tenía el mismo problema, y ahí hay cédulas de
-- representantes legales y autorizaciones de pago a cuenta bancaria.
--
-- Esconder el selector en la interfaz no arregla nada de esto: quien quiera
-- rodearla solo necesita el token que ya tiene en el navegador.

-- 1. Pertenencia a la tienda -------------------------------------------------

-- SECURITY DEFINER a propósito: se consulta desde las políticas de
-- `store_documents` y de storage, y sin él la RLS de `store_members` se
-- evaluaría dentro de otra política.
create or replace function public.fn_is_store_member(p_store_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from store_members sm
    where sm.store_id = p_store_id
      and sm.user_id = auth.uid()
  );
$$;

comment on function public.fn_is_store_member(uuid) is
  'True si el usuario autenticado pertenece a la tienda. Para políticas RLS.';

-- 2. Políticas de store_documents --------------------------------------------

drop policy if exists "Allow all access to admin" on public.store_documents;
drop policy if exists "Allow read to authenticated" on public.store_documents;

create policy store_documents_select on public.store_documents
  for select to authenticated
  using (
    public.fn_is_store_member(store_id)
    or public.has_permission('stores', 'read')
  );

create policy store_documents_insert on public.store_documents
  for insert to authenticated
  with check (
    public.fn_is_store_member(store_id)
    or public.has_permission('stores', 'update')
  );

create policy store_documents_update on public.store_documents
  for update to authenticated
  using (
    public.fn_is_store_member(store_id)
    or public.has_permission('stores', 'update')
  )
  with check (
    public.fn_is_store_member(store_id)
    or public.has_permission('stores', 'update')
  );

-- Borrar un documento no es parte de la operación de la tienda.
create policy store_documents_delete on public.store_documents
  for delete to authenticated
  using (public.has_permission('stores', 'delete'));

-- 3. Guardia del estado ------------------------------------------------------

-- La RLS filtra filas, no columnas: sin esto, un miembro de la tienda podría
-- escribir su propia fila y ponerla en "approved". La regla es simple —quien no
-- administra solo puede dejar el documento en "pending"—, y de paso implementa
-- lo que se quería: reemplazar un archivo ya aprobado lo devuelve a revisión.
create or replace function public.fn_store_documents_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Rutas de confianza del servidor (service role) y administradores.
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if public.has_permission('stores', 'update') then
    return new;
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'Solo un administrador puede decidir el estado de un documento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_store_documents_guard_status on public.store_documents;

create trigger trg_store_documents_guard_status
  before insert or update on public.store_documents
  for each row execute function public.fn_store_documents_guard_status();

-- 4. Archivos en storage -----------------------------------------------------

-- La ruta es `stores/<store_id>/<slug>-<ts>.<ext>` (verificado: todos los
-- objetos del bucket la cumplen), así que la tienda sale del segundo segmento.
-- El regex evita que un nombre con otro formato reviente el cast a uuid.
drop policy if exists "Allow all to authenticated users" on storage.objects;

create policy store_documents_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'store-documents'
    and name ~ '^stores/[0-9a-fA-F-]{36}/'
    and (
      public.fn_is_store_member(((storage.foldername(name))[2])::uuid)
      or public.has_permission('stores', 'read')
    )
  );

create policy store_documents_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'store-documents'
    and name ~ '^stores/[0-9a-fA-F-]{36}/'
    and (
      public.fn_is_store_member(((storage.foldername(name))[2])::uuid)
      or public.has_permission('stores', 'update')
    )
  );

create policy store_documents_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'store-documents'
    and name ~ '^stores/[0-9a-fA-F-]{36}/'
    and (
      public.fn_is_store_member(((storage.foldername(name))[2])::uuid)
      or public.has_permission('stores', 'update')
    )
  );

-- Borrar archivos queda solo para administración: la tienda reemplaza subiendo
-- uno nuevo, y el anterior se conserva como respaldo.
create policy store_documents_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'store-documents'
    and public.has_permission('stores', 'delete')
  );
