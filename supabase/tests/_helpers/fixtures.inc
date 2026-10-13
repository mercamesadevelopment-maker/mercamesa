-- Datos mínimos y helpers que comparten las pruebas de base de datos.
-- Se incluye al inicio de cada prueba con `\ir _helpers/fixtures.inc`.
--
-- Cada prueba corre en una transacción que termina en `rollback`, así que nada
-- de esto queda en la base. Corre sobre una base recién migrada (la del CI no
-- tiene la copia de producción), por eso crea todo lo que necesita.
--
-- Ids fijos, para que las pruebas los nombren sin buscarlos:
--   comprador  …0001   tendero  …0002 (miembro de la tienda A)
--   admin      …0003   extraño  …0004 (comprador sin relación con nada)
--   plaza      …0100   tienda A …0101   tienda B …0102

create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'comprador@prueba.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'tendero@prueba.test',   'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'admin@prueba.test',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'extrano@prueba.test',   'authenticated', 'authenticated');

insert into public.profiles (id, role_id, full_name, email)
select u.id, r.id, u.nombre, u.email
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'buyer',  'Comprador', 'comprador@prueba.test'),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'seller', 'Tendero',   'tendero@prueba.test'),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'admin',  'Admin',     'admin@prueba.test'),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'buyer',  'Extraño',   'extrano@prueba.test')
) as u(id, rol, nombre, email)
join public.roles r on r.name = u.rol;

insert into public.marketplaces (id, name, slug)
values ('00000000-0000-0000-0000-000000000100', 'Plaza de prueba', 'plaza-de-prueba');

insert into public.stores (id, marketplace_id, name, slug)
values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000100', 'Tienda A', 'tienda-a'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000100', 'Tienda B', 'tienda-b');

insert into public.store_members (store_id, user_id, role_id)
select '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000002', id
from public.roles where name = 'seller';

-- Actuar como un usuario: el rol `authenticated` con su id en el JWT, como
-- llega una petición de la app. `pg_temp.como_postgres()` vuelve al superusuario.
create function pg_temp.como(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.como_postgres() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
