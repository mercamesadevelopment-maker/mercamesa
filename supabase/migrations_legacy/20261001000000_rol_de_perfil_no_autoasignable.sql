-- Nadie se da un rol ni se reactiva a sí mismo.
--
-- Las políticas de `profiles` solo exigen `auth.uid() = id`: dicen de QUIÉN es la
-- fila, no qué columnas puede tocar su dueño. Con eso, cualquier comprador podía
-- hacer un PATCH a su propio perfil por PostgREST y ponerse `role_id` de admin —el
-- UUID viajaba en el bundle del cliente—, y un usuario inactivado podía volver a
-- ponerse `is_active = true`, que es lo que miran `/api/auth/login` y `proxy.ts`.
--
-- Por qué un trigger y no revocar las columnas: Supabase concede INSERT y UPDATE
-- sobre la TABLA a `anon` y `authenticated`, y revocar una columna no quita el
-- permiso de tabla. Habría que revocar la tabla y re-otorgar columna por columna,
-- y cada columna nueva de `profiles` quedaría sin permiso hasta que alguien se
-- acordara. El trigger nombra solo lo que no se puede tocar.
--
-- A quién aplica: a las peticiones de usuario (JWT con rol `anon` o
-- `authenticated`). La llave de servicio, las migraciones, el editor SQL y las
-- funciones que se llaman con ella (`anonymize_buyer`, inactivar, reactivar,
-- aceptar invitaciones) no pasan por aquí.
--
-- Qué puede hacer un usuario con su propio perfil:
--   * Crearlo solo como comprador. Es lo único que hace `register-buyer` con la
--     sesión del usuario. Los roles de tienda llegan por invitación y los de
--     administración los invita el superadmin; los dos entran por
--     `/accept-invite`, que inserta con la llave de servicio.
--   * Editarlo, sin cambiar `role_id` ni `is_active`.

create or replace function public.guard_profile_authority()
returns trigger
language plpgsql
-- DEFINER para leer `roles` sin depender de su RLS. El rol de la petición sale
-- del JWT, que es un ajuste de la sesión y no cambia con el dueño de la función.
security definer
set search_path = public
as $$
declare
  rol_peticion text := coalesce(auth.jwt() ->> 'role', '');
  rol_comprador uuid;
begin
  if rol_peticion not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role_id is distinct from old.role_id then
      raise exception 'El rol de un perfil no se puede cambiar desde la cuenta del propio usuario.'
        using errcode = '42501';
    end if;

    if new.is_active is distinct from old.is_active then
      raise exception 'La activación de un perfil no se puede cambiar desde la cuenta del propio usuario.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  select id into rol_comprador from public.roles where name = 'buyer';

  if new.role_id is distinct from rol_comprador then
    raise exception 'Una cuenta nueva solo puede registrarse como comprador.'
      using errcode = '42501';
  end if;

  if new.is_active is false then
    raise exception 'Una cuenta nueva no puede crearse inactiva.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_profile_authority() from public;

drop trigger if exists profiles_guard_authority on public.profiles;

create trigger profiles_guard_authority
  before insert or update on public.profiles
  for each row execute function public.guard_profile_authority();
