-- Gestión de usuarios para el administrador.
--
-- El módulo `users` YA EXISTÍA en la tabla `modules` desde el 2026-06-02
-- (path `/admin/users`), pero quedó huérfano: cero filas en `role_permissions`
-- y sin página. Por eso no le aparecía a nadie en el menú. Acá se le completan
-- los permisos y se agrega lo que necesita la pantalla.
--
-- El sidebar resuelve el enlace con `item.path || getRoute(item.key)`, así que
-- `modules.path` manda y no hace falta tocar el mapa de rutas del componente.
-- `proxy.ts` protege la ruta sola: busca el módulo cuyo `path` coincide con la
-- URL y exige la acción `read`.

-- ── 1. Permisos del módulo ──────────────────────────────────────────────────
--
-- Sin `delete`: borrar usuarios no está en el alcance y es irreversible.
-- Por `r.name` en vez de UUID pegado, que es como quedó `system-settings`.

update public.modules
set label = 'Usuarios',
    icon = 'Users',
    description = 'Gestión de usuarios y acceso'
where key = 'users';

insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r
cross join public.modules m
cross join public.actions a
where r.name = 'admin'
  and m.key = 'users'
  and a.name in ('read', 'create', 'update')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
  );

-- ── 2. Bitácora de acciones sobre cuentas ajenas ────────────────────────────
--
-- Restablecer la contraseña de otro o cerrarle las sesiones es tomar control de
-- una cuenta que no es propia. Sin registro, un administrador podría hacerlo sin
-- dejar rastro.

create table if not exists public.admin_user_actions (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('password_reset_sent', 'sessions_revoked')),
  request_ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_user_actions_target_idx
  on public.admin_user_actions (target_user_id, created_at desc);

alter table public.admin_user_actions enable row level security;

-- Solo lectura, y solo para quien administra usuarios. La escritura la hace el
-- servidor con la llave de servicio, que no pasa por RLS.
drop policy if exists admin_user_actions_select on public.admin_user_actions;
create policy admin_user_actions_select
  on public.admin_user_actions for select
  to authenticated
  using (public.has_permission('users', 'read'));

-- ── 3. Revocación de sesiones de otro usuario ───────────────────────────────
--
-- `supabase.auth.admin.signOut(jwt)` necesita el token del usuario, que el
-- administrador no tiene. La vía que sí funciona es borrar sus filas de
-- `auth.sessions`, y para eso hace falta SECURITY DEFINER: el esquema `auth` no
-- es accesible desde PostgREST con el rol del usuario.
--
-- OJO con el alcance: esto revoca las sesiones y los tokens de refresco, pero el
-- access token ya emitido sigue siendo válido hasta que expire (1 hora por
-- defecto). No es un corte instantáneo. Por eso la interfaz lo ofrece junto con
-- el restablecimiento de contraseña: cerrar sesiones sin cambiar la contraseña
-- no impide que el intruso vuelva a entrar.

create or replace function public.admin_revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer;
begin
  -- El permiso se comprueba DENTRO de la función: al ser SECURITY DEFINER
  -- corre con privilegios elevados, así que no puede confiar en quien la llama.
  if not public.has_permission('users', 'update') then
    raise exception 'No autorizado para revocar sesiones';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

comment on function public.admin_revoke_user_sessions(uuid) is
  'Cierra todas las sesiones de un usuario. Exige permiso users:update. El access token vigente sobrevive hasta expirar.';

revoke execute on function public.admin_revoke_user_sessions(uuid) from public, anon;
grant execute on function public.admin_revoke_user_sessions(uuid) to authenticated;
