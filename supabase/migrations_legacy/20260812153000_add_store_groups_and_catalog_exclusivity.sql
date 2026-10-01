-- Exclusividad de productos del catálogo por grupo de tiendas.
--
-- El catálogo maestro es global: cualquier tienda puede publicar cualquier
-- producto, y con él su imagen. Cuando una tienda aporta productos con sus
-- propias fotos, eso significa que las demás pueden reutilizarlas.
--
-- Un mismo dueño puede tener varias tiendas (otra sucursal en otro sector) y
-- todas deben compartir esos productos, así que la propiedad no se ata a una
-- tienda sino a un grupo.
--
-- Regla de visibilidad, única en todo el sistema:
--   una tienda puede publicar un producto si owner_group_id IS NULL (público)
--   o si owner_group_id coincide con el store_group_id de esa tienda.

create table if not exists public.store_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_groups_name_length check (char_length(btrim(name)) between 1 and 120)
);

-- on delete set null a propósito en ambos lados: borrar un grupo devuelve sus
-- productos al catálogo público y libera las tiendas, nunca borra ninguno.
alter table public.stores
  add column if not exists store_group_id uuid references public.store_groups(id) on delete set null;

alter table public.catalog_products
  add column if not exists owner_group_id uuid references public.store_groups(id) on delete set null;

create index if not exists stores_store_group_id_idx on public.stores (store_group_id);
create index if not exists catalog_products_owner_group_id_idx on public.catalog_products (owner_group_id);

create or replace function public.set_store_groups_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_store_groups_updated_at on public.store_groups;
create trigger set_store_groups_updated_at
  before update on public.store_groups
  for each row execute function public.set_store_groups_updated_at();

-- Mismo patrón que categories / measurement_units: leer basta con estar
-- autenticado (el vendedor necesita resolver el nombre de su grupo), escribir
-- exige el permiso de parametrización.
alter table public.store_groups enable row level security;

drop policy if exists "store_groups_select_policy" on public.store_groups;
drop policy if exists "store_groups_insert_policy" on public.store_groups;
drop policy if exists "store_groups_update_policy" on public.store_groups;
drop policy if exists "store_groups_delete_policy" on public.store_groups;

create policy "store_groups_select_policy" on public.store_groups
  for select to authenticated using (true);

create policy "store_groups_insert_policy" on public.store_groups
  for insert to authenticated with check (public.has_permission('system-settings', 'create'));

create policy "store_groups_update_policy" on public.store_groups
  for update to authenticated using (public.has_permission('system-settings', 'update'));

create policy "store_groups_delete_policy" on public.store_groups
  for delete to authenticated using (public.has_permission('system-settings', 'delete'));
