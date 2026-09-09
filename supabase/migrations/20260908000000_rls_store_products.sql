-- Aislamiento por tienda en los productos publicados.
--
-- Hasta ahora `store_products` y `store_members` tenían RLS deshabilitada, así
-- que el único control era el de las rutas — y `GET /api/store-products` no
-- tenía ninguno: sin `store_id` devolvía todos los productos de todas las
-- tiendas, con su precio mayorista, su stock y su código interno.
--
-- Ojo con el alcance del SELECT: esa misma tabla alimenta la vitrina pública, así
-- que NO se puede restringir la lectura a "solo mi tienda" sin apagar el
-- marketplace. La política distingue los dos usos:
--
--   * cualquiera puede leer los productos ACTIVOS de tiendas ACTIVAS (vitrina)
--   * el miembro de la tienda ve además los suyos inactivos (panel del vendedor)
--   * solo el miembro (o un admin) puede escribir
--
-- Es una segunda barrera detrás de `canManageStore`, no un reemplazo.

-- ── Ayudantes ───────────────────────────────────────────────────────────────
--
-- Van como SECURITY DEFINER a propósito: se consultan DENTRO de las políticas, y
-- si leyeran `store_members` con los permisos del usuario quedarían sujetos a la
-- RLS de esa misma tabla — recursión y resultados vacíos.

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.store_id = p_store_id
      and sm.user_id = auth.uid()
  );
$$;

comment on function public.is_store_member(uuid) is
  'El usuario actual pertenece a la tienda. Se usa dentro de políticas RLS.';

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.name in ('admin', 'superadmin')
  );
$$;

comment on function public.is_platform_admin() is
  'El usuario actual es administrador de la plataforma. Para políticas RLS.';

grant execute on function public.is_store_member(uuid) to authenticated, anon;
grant execute on function public.is_platform_admin() to authenticated, anon;

-- ── store_products ──────────────────────────────────────────────────────────

alter table public.store_products enable row level security;

drop policy if exists store_products_select on public.store_products;
create policy store_products_select
  on public.store_products for select
  using (
    -- Vitrina: publicado y de una tienda activa. Cubre a compradores, visitantes
    -- sin sesión y a la integración de B2Chat, que no está en store_members.
    (
      is_active
      and exists (
        select 1 from public.stores s
        where s.id = store_products.store_id and s.is_active
      )
    )
    -- El vendedor ve también los suyos despublicados.
    or public.is_store_member(store_id)
    or public.is_platform_admin()
  );

drop policy if exists store_products_insert on public.store_products;
create policy store_products_insert
  on public.store_products for insert
  to authenticated
  with check (public.is_store_member(store_id) or public.is_platform_admin());

drop policy if exists store_products_update on public.store_products;
create policy store_products_update
  on public.store_products for update
  to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin())
  with check (public.is_store_member(store_id) or public.is_platform_admin());

drop policy if exists store_products_delete on public.store_products;
create policy store_products_delete
  on public.store_products for delete
  to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin());

-- ── store_members ───────────────────────────────────────────────────────────
--
-- Es la tabla que define quién pertenece a qué tienda, así que quién la puede
-- leer importa tanto como los productos: expone qué usuarios trabajan en cada
-- local.

alter table public.store_members enable row level security;

drop policy if exists store_members_select on public.store_members;
create policy store_members_select
  on public.store_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_store_member(store_id)
    or public.is_platform_admin()
  );

drop policy if exists store_members_write on public.store_members;
create policy store_members_write
  on public.store_members for all
  to authenticated
  using (public.is_store_member(store_id) or public.is_platform_admin())
  with check (public.is_store_member(store_id) or public.is_platform_admin());
