-- Una sola tabla para los códigos de verificación por correo.
--
-- Eran cinco tablas con la misma forma: admin_login_codes, password_change_codes,
-- email_change_codes, password_reset_codes y signup_email_codes. Ahora es
-- `verification_codes`, con el propósito en una columna. La lógica ya era una
-- sola (`lib/auth/verification-codes.ts`).
--
-- Las tablas viejas se quedan hasta que el código nuevo esté publicado: entre
-- esta migración y el despliegue de Vercel, el código anterior todavía las usa.
-- Las borra una migración posterior.

create table public.verification_codes (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in
    ('admin_login', 'password_change', 'email_change', 'password_reset', 'signup_email')),
  -- A quién se le atribuye: a un usuario, a un correo o a los dos. En el registro
  -- y al recuperar la contraseña todavía no se sabe (o no se dice) quién es.
  user_id uuid references auth.users (id) on delete cascade,
  -- A dónde se mandó el código. En el cambio de correo, el correo actual.
  email text not null,
  -- Solo en el cambio de correo: el correo nuevo.
  new_email text,
  code_hash text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  -- Solo al recuperar la contraseña: el permiso para fijar la nueva, que se
  -- emite al verificar el código.
  reset_token text,
  reset_token_expires_at timestamptz,
  request_ip text,
  created_at timestamptz not null default now(),

  constraint verification_codes_con_usuario
    check (purpose not in ('admin_login', 'password_change', 'email_change') or user_id is not null),
  constraint verification_codes_correo_nuevo
    check ((purpose = 'email_change') = (new_email is not null)),
  constraint verification_codes_token_de_reset
    check (purpose = 'password_reset' or (reset_token is null and reset_token_expires_at is null))
);

comment on table public.verification_codes is
  'Códigos de 6 dígitos enviados por correo (ingreso de admin, registro, cambio de correo y de contraseña, recuperación). Solo el servidor la usa.';

create index verification_codes_por_usuario on public.verification_codes (purpose, user_id, created_at desc);
create index verification_codes_por_correo on public.verification_codes (purpose, email, created_at desc);
create index verification_codes_por_ip on public.verification_codes (purpose, request_ip, created_at);
create unique index verification_codes_reset_token on public.verification_codes (reset_token)
  where reset_token is not null;

-- Solo el servidor (cliente de servicio): RLS encendida y sin políticas, como
-- las tablas que reemplaza.
alter table public.verification_codes enable row level security;
revoke all on public.verification_codes from anon, authenticated;


-- Lo que haya en las tablas viejas, para no cortar los códigos vigentes ni
-- reiniciar los límites por persona y por IP.
insert into public.verification_codes
  (id, purpose, user_id, email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at)
select id, 'admin_login', user_id, email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at
from public.admin_login_codes;

insert into public.verification_codes
  (id, purpose, user_id, email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at)
select id, 'password_change', user_id, email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at
from public.password_change_codes;

insert into public.verification_codes
  (id, purpose, user_id, email, new_email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at)
select id, 'email_change', user_id, current_email, new_email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at
from public.email_change_codes;

insert into public.verification_codes
  (id, purpose, email, code_hash, attempts, max_attempts, consumed_at, expires_at,
   reset_token, reset_token_expires_at, request_ip, created_at)
select id, 'password_reset', email, code_hash, attempts, max_attempts, consumed_at, expires_at,
       reset_token, reset_token_expires_at, request_ip, created_at
from public.password_reset_codes;

insert into public.verification_codes
  (id, purpose, email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at)
select id, 'signup_email', email, code_hash, attempts, max_attempts, consumed_at, expires_at, request_ip, created_at
from public.signup_email_codes;


-- Anonimizar a un comprador borra sus códigos de la tabla nueva. Mientras
-- existan las viejas, también de ellas: guardan una copia de su correo.
create or replace function public.anonymize_buyer(target uuid) returns void
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  correo_original text;
  documento_original text;
begin
  select email, document_number into correo_original, documento_original
  from profiles where id = target;

  if correo_original is null then
    raise exception 'No existe el perfil %', target using errcode = 'no_data_found';
  end if;

  delete from clients
  where profile_id = target
     or (documento_original is not null and document_number = documento_original);

  delete from delivery_addresses where buyer_id = target;

  update orders
  set delivery_address_snapshot = jsonb_build_object(
        'municipality', delivery_address_snapshot -> 'municipality',
        'department', delivery_address_snapshot -> 'department',
        'anonymized', true
      )
  where buyer_id = target
    and delivery_address_snapshot is not null;

  update orders set notes = null where buyer_id = target and notes is not null;

  update store_orders so set notes = null
  from orders o
  where so.order_id = o.id and o.buyer_id = target and so.notes is not null;

  update store_reviews set comment = null
  where buyer_id = target and comment is not null;

  update payments p
  set callback_response = jsonb_build_object(
        'anonymized', true,
        'status', p.status,
        'provider_payment_id', p.provider_payment_id,
        'amount', p.amount
      )
  from orders o
  where p.order_id = o.id and o.buyer_id = target and p.callback_response is not null;

  update pibox_bookings pb
  set raw = jsonb_build_object('anonymized', true)
  from store_orders so
  join orders o on o.id = so.order_id
  where pb.store_order_id = so.id and o.buyer_id = target and pb.raw is not null;

  delete from verification_codes
  where user_id = target or email = correo_original or new_email = correo_original;

  -- Tablas viejas, hasta que se borren.
  delete from password_change_codes where user_id = target or email = correo_original;
  delete from admin_login_codes where user_id = target or email = correo_original;
  delete from password_reset_codes where email = correo_original;
  delete from email_change_codes
    where user_id = target or current_email = correo_original or new_email = correo_original;
  delete from signup_email_codes where email = correo_original;

  update legal_acceptances set accepted_ip = null
  where user_id = target and accepted_ip is not null;

  update profiles
  set full_name = 'Usuario eliminado',
      email = 'eliminado+' || target::text || '@mercamesa.invalid',
      phone = null,
      document_number = null,
      document_type = null,
      avatar_url = null,
      business_name = null,
      contact_name = null,
      identification_type_id = null,
      person_type = null,
      person_type_id = null,
      siigo_customer_id = null,
      is_active = false,
      anonymized_at = now()
  where id = target;
end;
$$;
