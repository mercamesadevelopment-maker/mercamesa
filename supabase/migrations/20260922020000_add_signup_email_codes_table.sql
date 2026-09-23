-- Verificar el correo ANTES de crear la cuenta.
--
-- El registro de comprador creaba la cuenta con cualquier correo escrito, sin
-- comprobar que existiera ni que fuera de quien se registra. Quedaban cuentas
-- imposibles de recuperar (nadie recibe el código de restablecimiento) y se
-- podía registrar a un tercero con su correo.
--
-- La clave es el CORREO y no el usuario, porque en este flujo todavía no hay
-- usuario: ese es justamente el punto.

create table if not exists public.signup_email_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_ip text,
  created_at timestamptz not null default now()
);

create index if not exists signup_email_codes_email_idx
  on public.signup_email_codes (email, created_at desc);

-- Sin políticas, como las demás tablas de códigos: solo las rutas del servidor.
-- Acá importa el doble, porque esta ruta se puede llamar sin sesión.
alter table public.signup_email_codes enable row level security;
