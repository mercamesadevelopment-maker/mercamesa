-- `profiles.updated_at` no se actualizaba sola.
--
-- La columna existía, pero cada ruta que edita un perfil tenía que acordarse de
-- escribirla a mano, y varias no lo hacían. Para auditoría eso es peor que no
-- tener la columna: muestra una fecha vieja con toda confianza.
--
-- Un disparador BEFORE UPDATE lo resuelve para todas las rutas a la vez, y
-- también para lo que se edite directamente contra la base.

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_profiles_updated_at();
