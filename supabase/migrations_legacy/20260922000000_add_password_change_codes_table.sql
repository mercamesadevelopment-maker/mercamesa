-- Código de 6 dígitos para cambiar la contraseña teniendo sesión.
--
-- Cambiar la contraseña solo pedía la contraseña actual. Con una sesión abierta
-- y desatendida eso alcanza para quedarse con la cuenta: el código al correo
-- exige además tener la bandeja, que es lo que el atacante de al lado no tiene.
--
-- Misma forma que `password_reset_codes` y `email_change_codes`, que ya existen:
-- se guarda el hash del código, nunca el código.

create table if not exists public.password_change_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- El correo al que se envió, congelado: si la persona cambia de correo
  -- mientras el código está vivo, el registro sigue diciendo a dónde se mandó.
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_ip text,
  created_at timestamptz not null default now()
);

-- Ordenado por fecha descendente porque siempre se busca el más reciente de una
-- persona, y sobre esa misma ventana se cuentan los envíos para limitarlos.
create index if not exists password_change_codes_user_idx
  on public.password_change_codes (user_id, created_at desc);

-- RLS activa y sin una sola política: nadie llega a esta tabla con la clave
-- pública. Solo la tocan las rutas del servidor con la clave de servicio, que se
-- salta RLS. Un código que el cliente pudiera leer no verificaría nada.
alter table public.password_change_codes enable row level security;
