-- Patinador y logística: el equipo de la plaza que junta los pedidos de varias
-- tiendas y se los entrega al mensajero.
--
-- Cada plaza decide qué usa:
--
--   patinador   recoge la parte de cada tienda y la lleva a la bahía.
--               Sin patinador, cada tendero lleva la suya.
--   logística   recibe las partes en la bahía y se las entrega al
--               domiciliario, validando el código. Sin logística, el que lleva
--               la parte se la entrega directo al domiciliario.
--
-- Siempre sale un solo mensajero por pedido. Cuándo se pide lo decide
-- `lib/orders/consolidation.ts` con lo que la plaza tenía al crear el pedido.
--
-- La comisión del patinador es informativa: la paga la plaza o la tienda por
-- fuera. No toca el total del comprador ni las dispersiones.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
insert into public.roles (name, label, description, is_system, is_active)
select v.name, v.label, v.description, false, true
from (values
  ('runner', 'Patinador', 'Recoge en las tiendas de una plaza y lleva los pedidos a la bahía'),
  ('logistics', 'Logística', 'Recibe los pedidos en la bahía de una plaza y los entrega al domiciliario')
) as v(name, label, description)
where not exists (select 1 from public.roles r where r.name = v.name);

-- ---------------------------------------------------------------------------
-- Acciones
-- ---------------------------------------------------------------------------
-- Propias, para no darle a logística el `update` general sobre las órdenes: con
-- él podría mover un pedido a cualquier estado.
insert into public.actions (name, label)
select v.name, v.label
from (values
  ('receive', 'Recibir en bahía'),
  ('dispatch', 'Marcar en camino')
) as v(name, label)
where not exists (select 1 from public.actions a where a.name = v.name);

-- ---------------------------------------------------------------------------
-- Módulo del patinador
-- ---------------------------------------------------------------------------
-- Inactivo al crearse: se activa en Parametrización cuando el código esté
-- desplegado. La clave es propia (`has_permission` busca por clave, no por ruta).
insert into public.modules (key, label, description, icon, path, sort_order, is_active)
select 'runner-orders', 'Pedidos por recoger', 'Pedidos de varias tiendas que el patinador lleva a la bahía', 'PackageCheck', '/runner', 1, false
where not exists (select 1 from public.modules where key = 'runner-orders');

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- El módulo de órdenes del admin se busca por ruta: la clave `orders` también
-- es la del módulo de órdenes del tendero.
--
-- Logística entra a `/admin/orders` por su `read` (el proxy deja pasar a un rol
-- de otra familia si tiene `read` sobre el módulo exacto de la ruta) y solo
-- puede recibir y despachar. El admin también, para cubrir una plaza sin nadie
-- en turno.
insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from (values
  ('logistics', '/admin/orders', 'read'),
  ('logistics', '/admin/orders', 'receive'),
  ('logistics', '/admin/orders', 'dispatch'),
  ('admin', '/admin/orders', 'receive'),
  ('admin', '/admin/orders', 'dispatch'),
  ('superadmin', '/admin/orders', 'receive'),
  ('superadmin', '/admin/orders', 'dispatch'),
  ('runner', '/runner', 'read'),
  ('runner', '/runner', 'update'),
  ('admin', '/runner', 'read'),
  ('admin', '/runner', 'update'),
  ('superadmin', '/runner', 'read'),
  ('superadmin', '/runner', 'update')
) as v(role_name, module_path, action_name)
join public.roles r on r.name = v.role_name
join public.modules m on m.path = v.module_path
join public.actions a on a.name = v.action_name
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
);

-- ---------------------------------------------------------------------------
-- Quién trabaja en qué plaza
-- ---------------------------------------------------------------------------
-- El rol de la cuenta dice qué hace la persona; esta tabla, en qué plazas.
create table public.marketplace_staff (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null constraint marketplace_staff_role_check check (role in ('runner', 'logistics')),
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint marketplace_staff_unico unique (marketplace_id, user_id, role)
);

create index marketplace_staff_user_idx on public.marketplace_staff (user_id) where is_active;

comment on table public.marketplace_staff is
  'Patinadores y logística de cada plaza. Solo ven los pedidos de sus plazas. Se desactivan, no se borran: queda quién atendió.';

-- Sin políticas, como las tablas de PQRS: solo se llega con el cliente de
-- servicio, después de comprobar en el código quién pregunta.
alter table public.marketplace_staff enable row level security;

-- ---------------------------------------------------------------------------
-- Configuración de la plaza
-- ---------------------------------------------------------------------------
alter table public.marketplaces
  add column runner_enabled boolean not null default false,
  add column logistics_enabled boolean not null default false,
  add column runner_commission_type text
    constraint marketplaces_runner_commission_type_check check (runner_commission_type in ('percent', 'fixed')),
  add column runner_commission_value numeric(12, 2)
    constraint marketplaces_runner_commission_value_check check (runner_commission_value >= 0),
  add constraint marketplaces_runner_commission_completa
    check ((runner_commission_type is null) = (runner_commission_value is null)),
  add constraint marketplaces_runner_commission_porcentaje
    check (runner_commission_type is distinct from 'percent' or runner_commission_value <= 100);

comment on column public.marketplaces.runner_enabled is
  'La plaza usa patinador para los pedidos de varias tiendas. Sin él, cada tendero lleva su parte.';
comment on column public.marketplaces.logistics_enabled is
  'La plaza tiene logística en la bahía. Sin ella, la parte se entrega directo al domiciliario.';
comment on column public.marketplaces.runner_commission_type is
  'percent: porcentaje del valor de los productos del pedido. fixed: valor fijo por pedido. Informativa.';

-- ---------------------------------------------------------------------------
-- Lo que el pedido guarda de su plaza y de quién lo armó
-- ---------------------------------------------------------------------------
-- La configuración se copia al crear el pedido: si la plaza la cambia mientras
-- un pedido está en curso, ese pedido sigue con la de cuando se compró.
alter table public.orders
  add column runner_required boolean not null default false,
  add column logistics_required boolean not null default false,
  add column runner_commission_type text
    constraint orders_runner_commission_type_check check (runner_commission_type in ('percent', 'fixed')),
  add column runner_commission_value numeric(12, 2),
  add column runner_commission_amount numeric(12, 2),
  add column bay_ready_at timestamptz,
  -- A `auth.users` y no a `profiles` a propósito: una segunda llave de `orders`
  -- hacia `profiles` volvería ambiguas todas las consultas que traen al
  -- comprador con `orders ( profiles ( ... ) )`.
  add column bay_ready_by uuid references auth.users (id) on delete set null;

comment on column public.orders.runner_commission_amount is
  'Comisión del patinador, calculada cuando terminó de recoger. Informativa: no se cobra ni se dispersa.';
comment on column public.orders.bay_ready_at is
  'Cuándo el patinador dejó todo el pedido en la bahía. Se le atribuye la comisión a bay_ready_by.';

alter table public.store_orders
  add column packing_notes text
    constraint store_orders_packing_notes_largo check (char_length(packing_notes) <= 500),
  add column collected_at timestamptz,
  add column collected_by uuid references auth.users (id) on delete set null,
  add column bay_received_at timestamptz,
  add column bay_received_by uuid references auth.users (id) on delete set null;

comment on column public.store_orders.packing_notes is
  'Cómo va empacada la parte («2 bolsas, fríos en la azul»). La escribe el tendero; la leen patinador, logística y domiciliario.';
comment on column public.store_orders.collected_at is
  'Cuándo el patinador recogió esta parte en el local.';
comment on column public.store_orders.bay_received_at is
  'Cuándo logística recibió esta parte en la bahía.';

-- ---------------------------------------------------------------------------
-- La reserva del mensajero puede ser del pedido entero
-- ---------------------------------------------------------------------------
-- La de un pedido de varias tiendas es del pedido: un mensajero, un paquete,
-- todas las tiendas. Es de una cosa o de la otra, nunca de las dos ni de
-- ninguna.
alter table public.pibox_bookings
  add column order_id uuid references public.orders (id) on delete cascade,
  alter column store_order_id drop not null,
  add constraint pibox_bookings_un_dueno
    check ((store_order_id is not null) <> (order_id is not null));

create index pibox_bookings_order_id_idx on public.pibox_bookings (order_id);

-- Igual que `pibox_bookings_una_activa_por_pedido`, para las del pedido entero.
create unique index pibox_bookings_una_activa_por_pedido_completo
  on public.pibox_bookings (order_id)
  where is_active;

alter table public.pibox_booking_events
  add column order_id uuid references public.orders (id) on delete cascade;

create index pibox_booking_events_order_idx
  on public.pibox_booking_events (order_id, received_at);

-- Las mismas personas que ven el domicilio, ahora también el de un pedido
-- entero: el comprador, cualquier tienda del pedido o un administrador.
drop policy if exists "pibox_bookings_select_policy" on public.pibox_bookings;

create policy "pibox_bookings_select_policy" on public.pibox_bookings
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
        from public.store_orders so
        join public.orders o on o.id = so.order_id
       where (so.id = pibox_bookings.store_order_id or so.order_id = pibox_bookings.order_id)
         and (o.buyer_id = auth.uid() or public.is_store_member(so.store_id))
    )
  );

drop policy if exists "pibox_booking_events_select_policy" on public.pibox_booking_events;

create policy "pibox_booking_events_select_policy" on public.pibox_booking_events
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
        from public.store_orders so
        join public.orders o on o.id = so.order_id
       where (so.id = pibox_booking_events.store_order_id or so.order_id = pibox_booking_events.order_id)
         and (o.buyer_id = auth.uid() or public.is_store_member(so.store_id))
    )
  );
