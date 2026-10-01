-- Patinador y bahía.
--
-- Un pedido de varias tiendas no lo puede despachar ninguna de ellas: alguien
-- tiene que juntarlo. Ese es el patinador, una persona de la plaza que recoge
-- la parte de cada tienda y la lleva a la bahía, donde la recibe el mensajero.
--
--   tienda alista → «Listo Recogida»
--   patinador recoge en cada tienda → «Recogido»
--   patinador deja todo en la bahía → «En bahía» → se pide UN mensajero
--
-- Solo aplica a los pedidos con `orders.fulfillment = 'runner'`. Con una sola
-- tienda todo sigue como antes.

-- ---------------------------------------------------------------------------
-- El rol
-- ---------------------------------------------------------------------------
insert into public.roles (name, label, description, is_system, is_active)
select 'runner', 'Patinador', 'Recoge en las tiendas de una plaza y arma los pedidos en la bahía', false, true
where not exists (select 1 from public.roles where name = 'runner');

-- ---------------------------------------------------------------------------
-- Qué plaza atiende cada patinador
-- ---------------------------------------------------------------------------
create table public.marketplace_runners (
  id uuid primary key default gen_random_uuid(),
  marketplace_id uuid not null references public.marketplaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint marketplace_runners_unico unique (marketplace_id, user_id)
);

create index marketplace_runners_user_idx on public.marketplace_runners (user_id) where is_active;

comment on table public.marketplace_runners is
  'Patinadores asignados a cada plaza. Un patinador solo ve los pedidos de sus plazas.';

-- Sin políticas, como las tablas de PQRS: solo se llega con el cliente de
-- servicio, después de comprobar en el código quién pregunta.
alter table public.marketplace_runners enable row level security;

-- ---------------------------------------------------------------------------
-- Lo que hace el patinador, guardado en el pedido
-- ---------------------------------------------------------------------------
-- No son estados nuevos de `order_status`: la parte de la tienda sigue en
-- «Listo Recogida» hasta que el mensajero se la lleva. Esto es quién la recogió
-- en el local y cuándo quedó todo en la bahía.
--
-- Quién lo hizo apunta a `auth.users` y no a `profiles` a propósito: una segunda
-- llave de `orders` hacia `profiles` volvería ambiguas todas las consultas que
-- hoy traen al comprador con `orders ( profiles ( ... ) )`.
alter table public.store_orders
  add column collected_at timestamptz,
  add column collected_by uuid references auth.users (id) on delete set null;

comment on column public.store_orders.collected_at is
  'Cuándo el patinador recogió esta parte en el local. Solo en pedidos con patinador.';

alter table public.orders
  add column bay_ready_at timestamptz,
  add column bay_ready_by uuid references auth.users (id) on delete set null;

comment on column public.orders.bay_ready_at is
  'Cuándo el pedido quedó completo en la bahía. En ese momento se pide el mensajero.';

-- ---------------------------------------------------------------------------
-- La reserva del mensajero puede ser del pedido entero
-- ---------------------------------------------------------------------------
-- Hasta ahora cada reserva era de una tienda (`store_order_id`). La de un
-- pedido con patinador es del pedido: un mensajero, un paquete, todas las
-- tiendas. Es de una cosa o de la otra, nunca de las dos ni de ninguna.
alter table public.pibox_bookings
  add column order_id uuid references public.orders (id) on delete cascade,
  alter column store_order_id drop not null,
  add constraint pibox_bookings_un_dueno
    check ((store_order_id is not null) <> (order_id is not null));

create index pibox_bookings_order_id_idx on public.pibox_bookings (order_id);

-- ---------------------------------------------------------------------------
-- Módulo y permisos
-- ---------------------------------------------------------------------------
-- Inactivo al crearse: se activa en Parametrización cuando el código esté
-- desplegado. La clave es propia (`has_permission` busca por clave, no por ruta).
insert into public.modules (key, label, description, icon, path, sort_order, is_active)
select 'runner-orders', 'Pedidos por recoger', 'Pedidos de varias tiendas que el patinador arma en la bahía', 'PackageCheck', '/runner', 1, false
where not exists (select 1 from public.modules where key = 'runner-orders');

-- El administrador también puede: si no hay patinador en turno, los pedidos no
-- se quedan sin salir.
insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from (values
  ('runner', 'runner-orders', 'read'),
  ('runner', 'runner-orders', 'update'),
  ('admin', 'runner-orders', 'read'),
  ('admin', 'runner-orders', 'update'),
  ('superadmin', 'runner-orders', 'read'),
  ('superadmin', 'runner-orders', 'update')
) as v(role_name, module_key, action_name)
join public.roles r on r.name = v.role_name
join public.modules m on m.key = v.module_key
join public.actions a on a.name = v.action_name
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
);
