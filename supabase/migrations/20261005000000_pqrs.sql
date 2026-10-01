-- PQRS: peticiones, quejas, reclamos y sugerencias.
--
-- Hasta ahora no había ningún canal: `/support` era un chat simulado y un
-- comprador con un producto en mal estado no tenía cómo decirlo dentro de la
-- plataforma. Esta migración trae la base: radicar, conversar, responder y
-- resolver. La plata (devoluciones y saldo a favor) llega en una migración
-- posterior y se cuelga de `pqrs.outcome`.
--
-- Acceso: todas las tablas nacen con RLS activo y SIN políticas. Solo las toca
-- el servidor (service role) desde `app/api/pqrs`, que es donde vive la regla de
-- quién ve qué: una PQRS la ven quien la abrió, la tienda cuando el caso le
-- compete y los administradores, y eso no se expresa bien en una política.

-- ---------------------------------------------------------------------------
-- Plazos, como histórico append-only (igual que `payout_settings_history`).
-- ---------------------------------------------------------------------------
create table if not exists public.pqrs_settings_history (
  id uuid primary key default gen_random_uuid(),

  -- Horas que tiene el comprador, desde la entrega, para reclamar por el estado
  -- de un producto. Corto a propósito: son perecederos y la evidencia es una
  -- foto. Tiene que ser menor que los días de espera de la dispersión, para que
  -- el reclamo llegue antes de pagarle a la tienda.
  claim_window_hours integer not null default 24 check (claim_window_hours > 0),

  -- Horas que tiene la tienda para responder antes de que el caso pase al admin.
  store_response_hours integer not null default 24 check (store_response_hours > 0),

  notes text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.pqrs_settings_history is
  'Plazos de las PQRS. La fila más reciente es la vigente.';

create index if not exists pqrs_settings_history_created_at_idx
  on public.pqrs_settings_history (created_at desc);

alter table public.pqrs_settings_history enable row level security;

insert into public.pqrs_settings_history (claim_window_hours, store_response_hours, notes)
select 24, 24, 'Valores iniciales.'
where not exists (select 1 from public.pqrs_settings_history);

-- ---------------------------------------------------------------------------
-- La PQRS.
-- ---------------------------------------------------------------------------
create sequence if not exists public.pqrs_consecutive_seq;

create table if not exists public.pqrs (
  id uuid primary key default gen_random_uuid(),
  consecutive integer not null default nextval('public.pqrs_consecutive_seq'),
  -- PQR-2026-000001. Lo arma el trigger, como `orders.code`.
  code text unique,

  kind text not null check (kind in ('peticion', 'queja', 'reclamo', 'sugerencia')),
  -- Clave del catálogo de motivos, que vive en `lib/pqrs/reasons.ts`.
  reason text not null,

  opened_by uuid not null references public.profiles(id),
  opened_as text not null check (opened_as in ('buyer', 'seller')),

  -- La tienda y el pedido de los que se habla. Una petición o una sugerencia
  -- pueden no tener ninguno.
  store_id uuid references public.stores(id),
  order_id uuid references public.orders(id) on delete set null,
  store_order_id uuid references public.store_orders(id) on delete set null,
  -- El comprador del caso: quien la abre, o aquel contra quien reclama la tienda.
  buyer_id uuid references public.profiles(id),

  subject text not null,
  description text not null,

  status text not null check (status in ('awaiting_store', 'in_review', 'resolved')),
  outcome text check (outcome in ('approved', 'rejected', 'answered')),
  -- A quién se le carga el costo cuando se aprueba.
  liable text check (liable in ('store', 'logistics', 'platform', 'buyer')),

  -- Solo cuando el caso espera a la tienda.
  store_response_due_at timestamptz,
  store_response text check (store_response in ('accepted', 'rejected', 'expired')),
  store_responded_at timestamptz,
  store_responded_by uuid references public.profiles(id),

  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_notes text,

  settings_id uuid references public.pqrs_settings_history(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pqrs_resuelta_con_resultado
    check ((status = 'resolved') = (outcome is not null))
);

comment on table public.pqrs is
  'Peticiones, quejas, reclamos y sugerencias de compradores y tenderos.';

create or replace function public.set_pqrs_code()
returns trigger
language plpgsql
as $$
begin
  new.code := 'PQR-'
    || to_char(new.created_at at time zone 'America/Bogota', 'YYYY')
    || '-' || lpad(new.consecutive::text, 6, '0');
  return new;
end;
$$;

drop trigger if exists pqrs_set_code on public.pqrs;
create trigger pqrs_set_code
  before insert on public.pqrs
  for each row execute function public.set_pqrs_code();

create or replace function public.set_pqrs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists pqrs_set_updated_at on public.pqrs;
create trigger pqrs_set_updated_at
  before update on public.pqrs
  for each row execute function public.set_pqrs_updated_at();

create index if not exists pqrs_opened_by_idx on public.pqrs (opened_by, created_at desc);
create index if not exists pqrs_store_idx on public.pqrs (store_id, created_at desc);
create index if not exists pqrs_status_idx on public.pqrs (status, created_at desc);
create index if not exists pqrs_order_idx on public.pqrs (order_id);

-- Un mismo motivo sobre un mismo pedido no se radica dos veces mientras el
-- primero siga abierto: el doble clic y la impaciencia no deben crear dos casos.
create unique index if not exists pqrs_un_caso_abierto_por_motivo
  on public.pqrs (order_id, reason, opened_by)
  where status <> 'resolved' and order_id is not null;

alter table public.pqrs enable row level security;

-- ---------------------------------------------------------------------------
-- Las líneas del pedido que se reclaman.
-- ---------------------------------------------------------------------------
create table if not exists public.pqrs_items (
  id uuid primary key default gen_random_uuid(),
  pqrs_id uuid not null references public.pqrs(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  -- Copia de lo que decía el pedido, para que el caso se siga leyendo igual
  -- aunque el pedido cambie.
  catalog_name text not null,
  unit_name text,
  unit_price numeric not null,
  created_at timestamptz not null default now(),
  unique (pqrs_id, order_item_id)
);

create index if not exists pqrs_items_order_item_idx on public.pqrs_items (order_item_id);

alter table public.pqrs_items enable row level security;

-- ---------------------------------------------------------------------------
-- La conversación.
-- ---------------------------------------------------------------------------
create table if not exists public.pqrs_messages (
  id uuid primary key default gen_random_uuid(),
  pqrs_id uuid not null references public.pqrs(id) on delete cascade,
  -- Nulo en los mensajes que deja el sistema (vencimiento del plazo, etc.).
  author_id uuid references public.profiles(id),
  author_as text not null check (author_as in ('buyer', 'seller', 'admin', 'system')),
  body text not null,
  -- Nota interna: solo la ven los administradores.
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pqrs_messages_pqrs_idx on public.pqrs_messages (pqrs_id, created_at);

alter table public.pqrs_messages enable row level security;

-- ---------------------------------------------------------------------------
-- Las fotos.
-- ---------------------------------------------------------------------------
create table if not exists public.pqrs_attachments (
  id uuid primary key default gen_random_uuid(),
  pqrs_id uuid not null references public.pqrs(id) on delete cascade,
  -- Nulo: es evidencia de la radicación. Con valor: va con ese mensaje.
  message_id uuid references public.pqrs_messages(id) on delete cascade,
  path text not null unique,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists pqrs_attachments_pqrs_idx on public.pqrs_attachments (pqrs_id);

alter table public.pqrs_attachments enable row level security;

-- Bucket privado: son fotos que el comprador manda como evidencia. Se leen con
-- URL firmada que genera el servidor, nunca por URL pública.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pqrs', 'pqrs', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Módulos y permisos.
--
-- Claves distintas por rol a propósito: `has_permission` busca por clave y no
-- por ruta, y dos módulos con la misma clave (como pasa con `orders`) le dan el
-- permiso del admin al tendero.
--
-- Nacen INACTIVOS: la base es la misma para producción y para desarrollo, y un
-- módulo activo aparece en el menú de todos de inmediato, antes de que las
-- páginas estén desplegadas. Se activan en Parametrización → Módulos cuando el
-- código ya esté en producción. Los permisos funcionan igual estando inactivos.
-- ---------------------------------------------------------------------------
insert into public.modules (key, label, description, icon, path, sort_order, is_active)
select v.key, v.label, v.description, v.icon, v.path, v.sort_order, false
from (values
  ('my-pqrs', 'PQRS', 'Peticiones, quejas, reclamos y sugerencias del comprador', 'LifeBuoy', '/pqrs', 5),
  ('seller-pqrs', 'PQRS', 'Casos de los compradores de la tienda y solicitudes del tendero', 'LifeBuoy', '/seller/pqrs', 7),
  ('admin-pqrs', 'PQRS', 'Todas las PQRS de la plataforma', 'LifeBuoy', '/admin/pqrs', 6)
) as v(key, label, description, icon, path, sort_order)
where not exists (select 1 from public.modules m where m.key = v.key);

insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from (values
  ('buyer', 'my-pqrs', 'read'),
  ('buyer', 'my-pqrs', 'create'),
  ('seller', 'seller-pqrs', 'read'),
  ('seller', 'seller-pqrs', 'create'),
  ('seller', 'seller-pqrs', 'update'),
  ('store_owner', 'seller-pqrs', 'read'),
  ('store_owner', 'seller-pqrs', 'create'),
  ('store_owner', 'seller-pqrs', 'update'),
  ('admin', 'admin-pqrs', 'read'),
  ('admin', 'admin-pqrs', 'update'),
  ('superadmin', 'admin-pqrs', 'read'),
  ('superadmin', 'admin-pqrs', 'update')
) as v(role_name, module_key, action_name)
join public.roles r on r.name = v.role_name
join public.modules m on m.key = v.module_key
join public.actions a on a.name = v.action_name
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
);

-- ---------------------------------------------------------------------------
-- El plazo de la tienda.
--
-- Cuando vence, el caso pasa al admin. Va en la base y no en una ruta de la
-- aplicación porque es un `update` y un mensaje: no hay nada que llamar afuera.
-- ---------------------------------------------------------------------------
create or replace function public.escalate_overdue_pqrs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  vencidas integer;
begin
  with vencidos as (
    update public.pqrs
       set status = 'in_review',
           store_response = 'expired'
     where status = 'awaiting_store'
       and store_response_due_at is not null
       and store_response_due_at <= now()
    returning id
  ),
  aviso as (
    insert into public.pqrs_messages (pqrs_id, author_as, body)
    select id, 'system',
           'La tienda no respondió dentro del plazo. El caso pasa a revisión de MercaMesa.'
      from vencidos
    returning 1
  )
  select count(*) into vencidas from aviso;

  return vencidas;
end;
$$;

revoke all on function public.escalate_overdue_pqrs() from public, anon, authenticated;

select cron.unschedule('escalate_overdue_pqrs')
where exists (select 1 from cron.job where jobname = 'escalate_overdue_pqrs');

select cron.schedule(
  'escalate_overdue_pqrs',
  '*/15 * * * *',
  $$select public.escalate_overdue_pqrs()$$
);
