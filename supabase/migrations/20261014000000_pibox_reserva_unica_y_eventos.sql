-- Domicilio de Pibox: una sola reserva por pedido y bitácora de eventos.
--
-- La primera prueba real en producción (MM-2026-001091-1, 14 oct.) mostró que
-- Picap relanza distinto de como suponíamos. Cuando un conductor cancela, Picap
-- NO cierra la reserva para abrir otra: la original sigue siendo la principal
-- (`GET /bookings/{id}` la devuelve aunque se le pida cualquier id de la
-- cadena) y los ids que llegan en `relaunched_to_id` son internos. Nosotros
-- creábamos una fila vacía por cada relanzamiento, y el pedido quedaba con dos
-- reservas activas: la pantalla mostraba la vacía, sin costo ni código.

-- ---------------------------------------------------------------------------
-- Alias: los ids de relanzamiento que apuntan a esta reserva
-- ---------------------------------------------------------------------------
alter table public.pibox_bookings
  add column alias_booking_ids text[] not null default '{}';

comment on column public.pibox_bookings.alias_booking_ids is
  'Ids que Picap usó al relanzar esta reserva (relaunched_to_id). Los avisos que llegan con uno de ellos se aplican a esta fila.';

create index pibox_bookings_alias_booking_ids_idx
  on public.pibox_bookings using gin (alias_booking_ids);

-- ---------------------------------------------------------------------------
-- Bitácora: cada aviso de Picap, tal como llegó
-- ---------------------------------------------------------------------------
-- La reserva guarda solo el último estado; el aviso siguiente sobrescribe al
-- anterior. Acá queda la secuencia completa («Álvaro aceptó · Álvaro canceló ·
-- Mateo aceptó»), incluidos los avisos que llegan atrasados o que no se
-- pudieron asociar a un pedido. Solo se inserta: nunca se actualiza.
--
-- `payload` es el cuerpo del webhook: trae conductor y vehículo, no datos del
-- comprador. Por eso no entra en la anonimización de cuentas.
create table public.pibox_booking_events (
  id bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  event_created_at timestamptz,
  store_order_id uuid references public.store_orders (id) on delete cascade,
  booking_id text,
  event_booking_id text,
  package_id text,
  event_cd smallint not null,
  status_cd integer,
  driver_name text,
  driver_phone text,
  vehicle_plates text,
  relaunched_to_id text,
  payload jsonb not null
);

comment on table public.pibox_booking_events is
  'Bitácora de los webhooks de Pibox. booking_id es la reserva principal a la que se asoció el aviso; event_booking_id, el id que vino en él.';

create index pibox_booking_events_store_order_idx
  on public.pibox_booking_events (store_order_id, received_at);

alter table public.pibox_booking_events enable row level security;

-- Las mismas personas que ven el domicilio. Escribe solo el servidor.
create policy "pibox_booking_events_select_policy" on public.pibox_booking_events
  for select to authenticated
  using (
    exists (
      select 1
        from public.store_orders so
        join public.orders o on o.id = so.order_id
       where so.id = pibox_booking_events.store_order_id
         and (
           o.buyer_id = auth.uid()
           or public.is_store_member(so.store_id)
           or public.is_platform_admin()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- Reparación: una sola reserva activa por pedido
-- ---------------------------------------------------------------------------
-- No borra nada. Las filas sin `package_id` las creó el webhook por un
-- relanzamiento (nuestro POST siempre guarda el paquete). Cada una se cuelga de
-- la reserva propia más reciente creada antes que ella en el mismo pedido: esa
-- es la principal. Su id pasa a alias de la principal y la fila queda
-- inactiva. La principal sigue vigente si alguna de la cadena lo estaba y no
-- está cerrada (101 sin conductor, 102 cancelada). La siguiente sincronización
-- vuelve a llenarla con los datos de Picap.
with raiz as (
  select id, store_order_id, created_at
    from public.pibox_bookings
   where package_id is not null
),
relanzadas as (
  select pb.id, pb.booking_id, pb.is_active,
         (select r.id from raiz r
           where r.store_order_id = pb.store_order_id
             and r.created_at < pb.created_at
           order by r.created_at desc
           limit 1) as principal_id
    from public.pibox_bookings pb
   where pb.package_id is null
),
cadena as (
  select principal_id,
         array_agg(booking_id order by booking_id) as ids,
         bool_or(is_active) as alguna_activa
    from relanzadas
   where principal_id is not null
   group by principal_id
)
update public.pibox_bookings pb
   set alias_booking_ids = (select array(select distinct unnest(pb.alias_booking_ids || c.ids))),
       is_active = (pb.is_active or c.alguna_activa) and coalesce(pb.status_cd, 0) not in (101, 102),
       relaunched_to_booking_id = null
  from cadena c
 where c.principal_id = pb.id;

update public.pibox_bookings pb
   set is_active = false
 where exists (
   select 1 from public.pibox_bookings p
    where pb.booking_id = any (p.alias_booking_ids)
 );

-- Por si quedara un pedido con dos activas que no son una cadena: queda la más
-- reciente, que es la que se pidió al final.
update public.pibox_bookings pb
   set is_active = false
 where pb.is_active
   and exists (
     select 1 from public.pibox_bookings o
      where o.store_order_id = pb.store_order_id
        and o.is_active
        and o.created_at > pb.created_at
   );

create unique index pibox_bookings_una_activa_por_pedido
  on public.pibox_bookings (store_order_id)
  where is_active;
