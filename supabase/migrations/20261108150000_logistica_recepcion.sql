-- Logística: evidencia de cómo recibió cada parte en la bahía, y los servicios
-- que presta por plaza y por día (para el convenio con el aliado de logística).
--
-- - Al recibir una parte, logística deja una o varias fotos de los productos y
--   las bolsas, una observación y, si algo llegó mal, la marca de mal estado.
--   Las reglas (foto obligatoria, hasta cuándo se edita) están en
--   `lib/logistics/reception-rules.ts`.
-- - Un servicio es un pedido que salió de la bahía y en el que logística
--   intervino: recibió alguna parte o lo despachó. Se cuenta el día en que
--   salió, en hora de Colombia.

-- ---------------------------------------------------------------------------
-- La recepción de cada parte
-- ---------------------------------------------------------------------------
alter table public.store_orders
  add column bay_observation text
    constraint store_orders_bay_observation_largo check (char_length(bay_observation) <= 500),
  add column bay_damaged boolean not null default false,
  add column bay_evidence_updated_at timestamptz;

comment on column public.store_orders.bay_observation is
  'Lo que logística anotó al recibir la parte en la bahía: cómo llegó, qué venía mal.';
comment on column public.store_orders.bay_damaged is
  'Logística marcó que algo de la parte llegó en mal estado. Avisa al tendero y a los admins; no bloquea el despacho.';

-- Quién la despachó desde la bahía. A `auth.users` y no a `profiles`, por la
-- misma razón que `bay_ready_by`: otra llave hacia `profiles` volvería ambiguas
-- las consultas que traen al comprador.
alter table public.orders
  add column logistics_dispatched_at timestamptz,
  add column logistics_dispatched_by uuid references auth.users (id) on delete set null;

comment on column public.orders.logistics_dispatched_at is
  'Cuándo logística le entregó el pedido al domiciliario desde la bahía.';

-- ---------------------------------------------------------------------------
-- Las fotos
-- ---------------------------------------------------------------------------
create table public.store_order_bay_photos (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders (id) on delete cascade,
  path text not null unique,
  mime_type text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index store_order_bay_photos_store_order_idx on public.store_order_bay_photos (store_order_id, created_at);

comment on table public.store_order_bay_photos is
  'Fotos de cómo logística recibió cada parte en la bahía. Bucket privado `logistica`; se leen con URL firmada.';

-- Sin políticas, como `marketplace_staff` y las tablas de PQRS: solo el servidor.
alter table public.store_order_bay_photos enable row level security;
revoke all on public.store_order_bay_photos from anon, authenticated;

-- Privado y sin políticas de Storage: solo el cliente de servicio sube (con
-- URL firmada) y firma las lecturas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logistica', 'logistica', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Servicios de logística por plaza y por día
-- ---------------------------------------------------------------------------
-- El historial de estados no tenía índices: estos sirven para buscar las
-- salidas de un periodo y la primera salida de cada parte.
create index if not exists store_order_status_history_salidas_idx
  on public.store_order_status_history (created_at) where status = 'dispatched';
create index if not exists store_order_status_history_parte_idx
  on public.store_order_status_history (store_order_id, status, created_at);

-- `[p_from, p_to)`, en fechas de Colombia. Va en SQL para no traer al servidor
-- miles de filas (PostgREST corta en 1000).
create function public.logistics_services_by_day(p_from date, p_to date, p_marketplace uuid default null)
returns table (
  marketplace_id uuid,
  day date,
  services integer,
  parts_received integer,
  parts_damaged integer
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Primero los pedidos con alguna salida en el periodo (el índice del
  -- historial), y después la primera salida de cada uno sobre todo su historial.
  with candidatos as (
    select distinct so.order_id
    from public.store_order_status_history h
    join public.store_orders so on so.id = h.store_order_id
    where h.status = 'dispatched'
      and h.created_at >= (p_from::timestamp at time zone 'America/Bogota')
      and h.created_at < (p_to::timestamp at time zone 'America/Bogota')
  ),
  partes as (
    select
      so.order_id,
      s.marketplace_id,
      so.bay_received_at,
      so.bay_damaged,
      (select min(h.created_at)
         from public.store_order_status_history h
        where h.store_order_id = so.id and h.status = 'dispatched') as salio
    from candidatos c
    join public.store_orders so on so.order_id = c.order_id
    join public.stores s on s.id = so.store_id
    where p_marketplace is null or s.marketplace_id = p_marketplace
  ),
  pedidos as (
    select
      p.order_id,
      -- Un pedido de varias tiendas es de una sola plaza.
      min(p.marketplace_id::text)::uuid as marketplace_id,
      (min(p.salio) at time zone 'America/Bogota')::date as dia,
      count(*) filter (where p.bay_received_at is not null)::int as recibidas,
      count(*) filter (where p.bay_damaged)::int as con_novedad
    from partes p
    group by p.order_id
  )
  select
    pe.marketplace_id,
    pe.dia,
    count(*)::int,
    sum(pe.recibidas)::int,
    sum(pe.con_novedad)::int
  from pedidos pe
  join public.orders o on o.id = pe.order_id
  where pe.dia is not null
    and pe.dia >= p_from and pe.dia < p_to
    and (pe.recibidas > 0 or o.logistics_dispatched_at is not null)
  group by pe.marketplace_id, pe.dia
  order by pe.marketplace_id, pe.dia;
$$;

comment on function public.logistics_services_by_day(date, date, uuid) is
  'Servicios de logística por plaza y día de Colombia: pedidos que salieron de la bahía y en los que logística recibió alguna parte o los despachó.';

revoke all on function public.logistics_services_by_day(date, date, uuid) from public, anon, authenticated;
grant execute on function public.logistics_services_by_day(date, date, uuid) to service_role;
