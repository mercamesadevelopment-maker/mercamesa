-- Inactivar a un usuario por un periodo, sabiendo quién lo hizo y por qué.
--
-- `profiles.is_active` ya existía, pero era casi decorativa: el único que la
-- leía era `has_permission`, o sea que inactivar a alguien le quitaba los
-- módulos de administración y nada más. Seguía pudiendo entrar, seguía con su
-- sesión abierta y seguía comprando. Y no quedaba registro de quién lo hizo.
--
-- Esta migración agrega lo que falta del lado de la base: el historial. El
-- bloqueo al entrar lo imponen `/api/auth/login`, `/api/auth/verify-login-code`
-- y `proxy.ts`, porque `is_active` no puede cortar una sesión por sí sola.
--
-- El historial es una tabla aparte y no dos columnas en `profiles` a propósito:
-- inactivar a la misma persona dos veces es normal, y con columnas la segunda
-- vez borra el rastro de la primera. Que es justo lo que se querría consultar.

create table if not exists public.user_deactivations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- RESTRICT como en `admin_user_actions.actor_id`: quien ejecutó la acción no
  -- puede desaparecer y dejar el registro sin responsable.
  actor_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null,
  period text not null check (period in ('15d', '1m', '6m', 'forever')),
  -- Nulo = para siempre. Se calcula en el servidor a partir de `period`, nunca
  -- llega del navegador.
  until timestamptz,
  created_at timestamptz not null default now(),
  -- Cuándo dejó de estar inactivo. Nulo mientras siga vigente.
  lifted_at timestamptz,
  -- Quién lo reactivó. Nulo con `lifted_at` puesto = se venció sola.
  lifted_by uuid references public.profiles(id) on delete set null
);

comment on table public.user_deactivations is
  'Historial de inactivaciones de cuenta: quién, por qué, por cuánto y hasta cuándo.';

comment on column public.user_deactivations.lifted_by is
  'Nulo junto con lifted_at puesto significa que la inactivación venció sola, no que alguien la levantó.';

-- La consulta caliente es una sola: "¿este usuario tiene una inactivación
-- viva?". Se hace en cada intento de ingreso de una cuenta inactiva.
create index if not exists user_deactivations_vivas_idx
  on public.user_deactivations (user_id)
  where lifted_at is null;

create index if not exists user_deactivations_user_idx
  on public.user_deactivations (user_id, created_at desc);

alter table public.user_deactivations enable row level security;

-- Solo lectura, y solo para quien puede ver el módulo de usuarios. La escritura
-- va con service key desde las rutas, igual que `admin_user_actions`: así el
-- permiso fino (`users:delete`) se verifica en un solo lugar.
drop policy if exists user_deactivations_select on public.user_deactivations;
create policy user_deactivations_select on public.user_deactivations
  for select to authenticated
  using (public.has_permission('users', 'read'));


-- ---------------------------------------------------------------------------
-- La bitácora admite las dos acciones nuevas
--
-- `admin_user_actions.action` tiene un check cerrado. Sin ampliarlo, inactivar
-- funcionaría y el registro de quién lo hizo fallaría al final.
--
-- La invitación NO entra acá: `target_user_id` es NOT NULL con clave foránea a
-- `profiles`, y a quien se invita todavía no tiene perfil. Ese rastro lo guarda
-- `invitations.invited_by` junto con `created_at`.
-- ---------------------------------------------------------------------------
alter table public.admin_user_actions
  drop constraint if exists admin_user_actions_action_check;

alter table public.admin_user_actions
  add constraint admin_user_actions_action_check
  check (action in (
    'password_reset_sent',
    'sessions_revoked',
    'data_anonymized',
    'user_deactivated',
    'user_reactivated'
  ));
