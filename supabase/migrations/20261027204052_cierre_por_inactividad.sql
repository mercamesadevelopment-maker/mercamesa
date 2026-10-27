-- Cierre de cuentas por inactividad: compradores y tenderos.
--
-- Al año sin usar la cuenta se le avisa por correo a la persona; si en las dos
-- semanas siguientes no vuelve, la cuenta se cierra: se anonimizan sus datos y se
-- conserva lo mínimo para que pedidos, facturas y transacciones sigan asociados.
-- Lo hace la tarea diaria `/api/cron/inactive-accounts`; la lógica está en
-- `lib/accounts/`.

-- 1. Los avisos enviados -------------------------------------------------------

create table public.account_inactivity_notices (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  notified_at timestamptz not null default now(),
  closes_at timestamptz not null,
  constraint account_inactivity_notices_orden check (closes_at > notified_at)
);

alter table public.account_inactivity_notices enable row level security;

comment on table public.account_inactivity_notices is
  'A quién se le avisó que su cuenta se cerrará por inactividad, y cuándo. La fila se borra si la persona vuelve, y deja de importar cuando la cuenta se cierra. Solo el servidor: RLS sin políticas.';

-- 2. La huella de los correos de cuentas cerradas ------------------------------

create table public.closed_account_emails (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$'),
  closed_at timestamptz not null default now()
);

alter table public.closed_account_emails enable row level security;

comment on table public.closed_account_emails is
  'Huella (sha256 en hex del correo en minúscula y sin espacios) de las cuentas cerradas por inactividad. No guarda el correo: sirve para que, si la persona vuelve e intenta entrar, se le explique que su cuenta se cerró y que puede crear una nueva. Se borra cuando se registra otra vez. Solo el servidor.';

-- 3. El registro de acciones admite las automáticas ----------------------------
--
-- `actor_id` vacío significa que la acción la hizo la plataforma (la tarea
-- programada), no una persona.

alter table public.admin_user_actions alter column actor_id drop not null;

alter table public.admin_user_actions drop constraint admin_user_actions_action_check;
alter table public.admin_user_actions add constraint admin_user_actions_action_check
  check (action = any (array[
    'password_reset_sent', 'sessions_revoked', 'data_anonymized',
    'user_deactivated', 'user_reactivated', 'closed_inactive'
  ]));

comment on column public.admin_user_actions.actor_id is
  'Quién hizo la acción. Vacío si la hizo la plataforma, como el cierre por inactividad.';

-- 4. La última actividad de una cuenta -----------------------------------------
--
-- No basta con el último inicio de sesión: quien deja la sesión abierta en el
-- celular puede pasar un año sin «iniciar sesión» y seguir comprando. Cuenta lo
-- más reciente entre el inicio de sesión, la última renovación de una sesión
-- (con la app abierta se renueva sola), el último pedido y la creación de la
-- cuenta.
--
-- Lee `auth.*`: por eso es `security definer` y solo la ejecuta el servidor.

create or replace function public.last_account_activity(p_user uuid) returns timestamptz
    language sql stable security definer
    set search_path to 'public'
    as $$
  select greatest(
    u.created_at,
    u.last_sign_in_at,
    (select max(greatest(s.updated_at, s.refreshed_at::timestamptz)) from auth.sessions s where s.user_id = u.id),
    (select max(o.created_at) from public.orders o where o.buyer_id = u.id)
  )
  from auth.users u
  where u.id = p_user;
$$;

comment on function public.last_account_activity(uuid) is
  'Lo más reciente entre crear la cuenta, iniciar sesión, renovar una sesión y hacer un pedido. Solo el servidor.';

create or replace function public.inactive_accounts(p_before timestamptz, p_limit int default 50)
returns table (user_id uuid, email text, full_name text, role_name text, last_activity timestamptz)
    language sql stable security definer
    set search_path to 'public'
    as $$
  select p.id, p.email, p.full_name, r.name, a.last_activity
  from public.profiles p
  join public.roles r on r.id = p.role_id
  cross join lateral (select public.last_account_activity(p.id) as last_activity) a
  where r.name in ('buyer', 'store_owner', 'seller')
    and p.anonymized_at is null
    and not exists (select 1 from public.account_inactivity_notices n where n.user_id = p.id)
    and a.last_activity < p_before
  order by a.last_activity
  limit p_limit;
$$;

comment on function public.inactive_accounts(timestamptz, int) is
  'Compradores y tenderos sin anonimizar ni aviso pendiente cuya última actividad (last_account_activity) es anterior a p_before: a quiénes toca avisar. Solo el servidor.';

revoke all on function public.last_account_activity(uuid) from public, anon, authenticated;
revoke all on function public.inactive_accounts(timestamptz, int) from public, anon, authenticated;
grant execute on function public.last_account_activity(uuid) to service_role;
grant execute on function public.inactive_accounts(timestamptz, int) to service_role;

-- 5. La tarea diaria -----------------------------------------------------------
--
-- 14:00 UTC = 9:00 a. m. de Colombia, para que el aviso llegue en horario de día.
-- En local y staging la apaga `supabase/seed/post.sql`, como a las demás que
-- llaman a la aplicación.

select cron.schedule(
  'inactive_accounts',
  '0 14 * * *',
  $$select public.call_app_cron('/api/cron/inactive-accounts')$$
);
