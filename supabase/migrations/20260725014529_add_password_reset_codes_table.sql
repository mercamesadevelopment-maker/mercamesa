create table public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  reset_token text,
  reset_token_expires_at timestamptz,
  expires_at timestamptz not null,
  request_ip text,
  created_at timestamptz not null default now()
);

create index password_reset_codes_email_idx on public.password_reset_codes (email, created_at desc);
create unique index password_reset_codes_reset_token_idx on public.password_reset_codes (reset_token) where reset_token is not null;

alter table public.password_reset_codes enable row level security;
-- Sin políticas: solo accesible vía service-role key desde el servidor.
