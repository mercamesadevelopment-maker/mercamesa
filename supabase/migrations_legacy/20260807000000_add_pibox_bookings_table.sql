-- Integración con Pibox (Picap): guarda el domicilio solicitado para cada
-- pedido de tienda.
--
-- Es una tabla y no columnas en store_orders porque un mismo store_order puede
-- tener varios bookings a lo largo del tiempo: cuando el conductor cancela,
-- Pibox crea automáticamente un booking nuevo con otro id y lo enlaza vía
-- relaunched_to_id. Además hace falta resolver booking_id/package_id →
-- store_order_id al recibir un webhook.

create table public.pibox_bookings (
  id uuid primary key default gen_random_uuid(),
  store_order_id uuid not null references public.store_orders(id) on delete cascade,
  -- Identificadores del lado de Pibox
  booking_id text not null unique,
  package_id text,
  -- Últimos estados conocidos (ver docs/picap.MD, sección "Estados")
  status_cd smallint,
  package_status_cd smallint,
  tracking_link text,
  pickup_validation_code text,
  validation_code text,
  -- Pibox maneja centavos; acá se guarda ya convertido a pesos
  estimated_cost numeric(12,2),
  final_cost numeric(12,2),
  currency text not null default 'COP',
  driver_name text,
  driver_phone text,
  vehicle_plates text,
  -- Subestados: por qué no se pudo recoger / entregar
  canceled_pickup_reason_cd smallint,
  not_received_reason_cd smallint,
  -- Booking que reemplazó a este cuando el conductor canceló
  relaunched_to_booking_id text,
  -- Cuál es el booking vigente si hubo relanzamientos
  is_active boolean not null default true,
  -- Último payload completo recibido, para depurar: los webhooks de Pibox son
  -- at-most-once y no tienen reintento automático
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index pibox_bookings_store_order_id_idx on public.pibox_bookings(store_order_id);
create index pibox_bookings_package_id_idx on public.pibox_bookings(package_id);

alter table public.pibox_bookings enable row level security;

-- Lectura para usuarios autenticados, igual criterio que store_order_status_history.
create policy "pibox_bookings_select_policy" on public.pibox_bookings
  for select to authenticated using (true);

-- Sin políticas de insert/update/delete a propósito: todas las escrituras pasan
-- por las rutas del servidor usando el service role, nunca desde el navegador.

create or replace function public.set_pibox_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pibox_bookings_set_updated_at
  before update on public.pibox_bookings
  for each row
  execute function public.set_pibox_bookings_updated_at();
