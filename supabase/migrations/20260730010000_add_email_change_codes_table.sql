create table public.email_change_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  current_email text not null,
  new_email text not null,
  code_hash text not null,
  attempts int not null default 0,
  max_attempts int not null default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  request_ip text,
  created_at timestamptz not null default now()
);

create index email_change_codes_user_idx on public.email_change_codes (user_id, created_at desc);

alter table public.email_change_codes enable row level security;
-- Sin políticas: solo accesible vía service-role key desde el servidor, igual que password_reset_codes.
