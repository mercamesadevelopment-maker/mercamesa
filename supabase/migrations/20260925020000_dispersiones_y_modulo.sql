-- Las liquidaciones: qué se le pagó a quién y con qué archivo.
--
-- Un borrador se arma los martes y jueves con los pedidos elegibles y queda en
-- 'draft'. El superadmin lo revisa, lo aprueba, y ahí se genera el .txt. Nada
-- sale al banco sin que alguien lo mire: es plata de terceros y el archivo no se
-- puede deshacer una vez subido al portal.


-- ---------------------------------------------------------------------------
-- 1. La liquidación
-- ---------------------------------------------------------------------------
create table if not exists public.payouts (
  id uuid primary key default uuid_generate_v4(),

  -- Base del nombre del archivo (COA00022.TRA). Se le suma el desfase de los
  -- parámetros para empatar con la numeración que el banco ya lleve.
  consecutive integer generated always as identity,
  file_name text,

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'cancelled')),

  -- La fecha en que el banco procesará el archivo (campo 8 de la cabecera).
  scheduled_for date not null,

  -- Contra qué parámetros se generó. Si mañana cambia la cuenta de la que sale
  -- el dinero, este archivo sigue explicando de dónde salió el suyo.
  settings_id uuid references public.payout_settings_history(id),

  total_amount numeric(14,2) not null default 0,
  items_count integer not null default 0,
  -- Ruta dentro del bucket privado `payouts`. Nula mientras sea borrador.
  file_path text,

  generated_by uuid references public.profiles(id),
  generated_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancelled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.payouts is
  'Liquidación de pagos a tiendas. Un borrador se revisa antes de convertirse en archivo para el banco.';

create index if not exists payouts_status_idx on public.payouts (status, created_at desc);

alter table public.payouts enable row level security;

drop policy if exists payouts_select on public.payouts;
create policy payouts_select on public.payouts
  for select to authenticated
  using (public.has_permission('payouts', 'read'));

-- La escritura va con llave de servicio desde las rutas, que es donde se
-- verifica el permiso fino y se hace todo el trabajo en un solo lugar.


-- ---------------------------------------------------------------------------
-- 2. Qué pedidos entraron
--
-- Una fila por `store_order`, aunque el archivo agrupe por tienda: es lo que
-- permite responder "¿en qué liquidación me pagaron este pedido?".
-- ---------------------------------------------------------------------------
create table if not exists public.payout_items (
  id uuid primary key default uuid_generate_v4(),
  payout_id uuid not null references public.payouts(id) on delete cascade,
  store_order_id uuid not null references public.store_orders(id),
  store_id uuid not null references public.stores(id),
  -- Congela a qué cuenta se le pagó. La tienda puede cambiarla después, y el
  -- registro de a dónde fue el dinero no puede cambiar con ella.
  bank_account_id uuid not null references public.store_bank_accounts(id),
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

comment on table public.payout_items is
  'Pedidos incluidos en una liquidación. El único sobre store_order_id es lo que impide pagar dos veces.';

-- ESTO es la garantía de que un pedido no se paga dos veces, y vale más que
-- cualquier validación en el servidor: aunque dos procesos armen un borrador a
-- la vez, la base rechaza el segundo.
--
-- Cancelar un borrador BORRA sus ítems (la fila de `payouts` queda como
-- 'cancelled' con sus totales, para la bitácora), y así los pedidos vuelven a
-- quedar disponibles.
create unique index if not exists payout_items_store_order_unico
  on public.payout_items (store_order_id);

create index if not exists payout_items_payout_idx
  on public.payout_items (payout_id, store_id);

alter table public.payout_items enable row level security;

drop policy if exists payout_items_select on public.payout_items;
create policy payout_items_select on public.payout_items
  for select to authenticated
  using (
    public.has_permission('payouts', 'read')
    -- El tendero puede ver lo suyo: cuándo le pagaron y cuánto.
    or public.is_store_member(store_id)
  );


-- ---------------------------------------------------------------------------
-- 3. El bucket
--
-- PRIVADO, al contrario del de `legal`: son números de cuenta y montos de
-- terceros. Se lee desde el servidor con la llave de servicio y se entrega por
-- una ruta que verifica el permiso, no por URL pública.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payouts', 'payouts', false)
on conflict (id) do nothing;

drop policy if exists "payouts_read" on storage.objects;
create policy "payouts_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'payouts' and public.has_permission('payouts', 'read'));

drop policy if exists "payouts_upload" on storage.objects;
create policy "payouts_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payouts' and public.has_permission('payouts', 'update'));


-- ---------------------------------------------------------------------------
-- 4. El módulo y sus permisos
--
-- `proxy.ts` protege la ruta solo con que `modules.path` coincida con la URL, y
-- el sidebar resuelve el enlace con `item.path` y el icono con `modules.icon`
-- contra lucide-react. No hay nada que tocar en el código para que aparezca.
--
-- Solo superadmin: dispersar es mover dinero de terceros.
-- ---------------------------------------------------------------------------
insert into public.modules (key, label, description, icon, path, sort_order, is_active)
select 'payouts', 'Dispersiones',
       'Liquidación de pagos a las tiendas y archivo para el banco',
       'Banknote', '/admin/payouts', 11, true
where not exists (select 1 from public.modules where key = 'payouts');

insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r
cross join public.modules m
cross join public.actions a
where r.name = 'superadmin'
  and m.key = 'payouts'
  and a.name in ('read', 'create', 'update', 'delete')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
  );


-- ---------------------------------------------------------------------------
-- 5. El trabajo de los martes y jueves
--
-- pg_cron corre en UTC y Colombia es UTC-5, así que las 11:00 UTC son las 6:00
-- de la mañana acá. Los días 2 y 4 son martes y jueves.
--
-- `call_app_cron` ya existe (20260826200000) y lee la URL y el secreto de Vault,
-- para que el secreto no quede escrito en `cron.job.command`.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'payouts_draft') then
    perform cron.unschedule('payouts_draft');
  end if;
end $$;

select cron.schedule(
  'payouts_draft',
  '0 11 * * 2,4',
  $$select public.call_app_cron('/api/cron/payouts')$$
);
