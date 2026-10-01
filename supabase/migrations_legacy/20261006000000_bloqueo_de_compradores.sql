-- Bloqueo de un comprador en una tienda.
--
-- Hay compradores que hacen pedidos para cancelarlos, o a direcciones que no
-- existen. El tendero lo pide por PQRS («bloquear_comprador») y un administrador
-- lo aprueba; desde ahí ese comprador no puede crear pedidos en esa tienda.
--
-- Es por tienda. Sacar a alguien de toda la plataforma sigue siendo la
-- desactivación de usuario, que ya existe.
--
-- Como las tablas de PQRS: RLS activo y sin políticas. Solo la toca el servidor.

create table if not exists public.store_buyer_blocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  -- La solicitud que lo originó. Un bloqueo no existe sin una PQRS aprobada,
  -- pero la PQRS se puede borrar sin llevarse el bloqueo.
  pqrs_id uuid references public.pqrs(id) on delete set null,
  reason text not null,
  blocked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  -- Levantar no borra: queda el rastro de que estuvo bloqueado y por qué dejó
  -- de estarlo.
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id),
  lift_notes text
);

comment on table public.store_buyer_blocks is
  'Compradores que no pueden crear pedidos en una tienda. Vigente mientras lifted_at sea nulo.';

-- Un solo bloqueo vigente por comprador y tienda. Es lo que hace que aprobar dos
-- veces la misma solicitud no cree dos.
create unique index if not exists store_buyer_blocks_vigente
  on public.store_buyer_blocks (store_id, buyer_id)
  where lifted_at is null;

create index if not exists store_buyer_blocks_buyer_idx on public.store_buyer_blocks (buyer_id);
create index if not exists store_buyer_blocks_pqrs_idx on public.store_buyer_blocks (pqrs_id);

alter table public.store_buyer_blocks enable row level security;
