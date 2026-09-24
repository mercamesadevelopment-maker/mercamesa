-- Segunda verificación al ingresar como admin o superadmin.
--
-- Estas cuentas pueden mover tiendas de plaza, cambiar precios, ver a todos los
-- usuarios y tocar la parametrización. Hasta ahora bastaba con la contraseña:
-- quien la obtuviera —reutilizada, adivinada, anotada— entraba con todo eso. El
-- código al correo agrega algo que no se roba junto con la contraseña.
--
-- Solo para esos dos roles: a un comprador se le pediría en cada compra sin que
-- el riesgo lo justifique.

create table if not exists public.admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_ip text,
  created_at timestamptz not null default now()
);

create index if not exists admin_login_codes_user_idx
  on public.admin_login_codes (user_id, created_at desc);

-- Sin políticas, como las demás tablas de códigos: solo las rutas del servidor
-- con la clave de servicio. Acá es lo más importante de todo el archivo: un
-- código legible desde el cliente no verificaría absolutamente nada.
alter table public.admin_login_codes enable row level security;
