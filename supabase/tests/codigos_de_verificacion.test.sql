-- Los códigos por correo en una sola tabla: reglas por propósito, solo el
-- servidor la lee, y anonimizar a un comprador borra los suyos.
-- Migración: 20261020221446_codigos_de_verificacion.sql

begin;
\ir _helpers/fixtures.inc
select plan(10);

-- Reglas por propósito
select throws_ok(
  $$ insert into public.verification_codes (purpose, user_id, email, code_hash, expires_at)
     values ('email_change', '00000000-0000-0000-0000-000000000001', 'comprador@prueba.test', 'x', now()) $$,
  '23514', null, 'un cambio de correo sin el correo nuevo no se guarda');

select throws_ok(
  $$ insert into public.verification_codes (purpose, email, code_hash, expires_at)
     values ('admin_login', 'admin@prueba.test', 'x', now()) $$,
  '23514', null, 'un ingreso de admin sin usuario no se guarda');

select throws_ok(
  $$ insert into public.verification_codes (purpose, email, code_hash, expires_at, reset_token)
     values ('signup_email', 'nuevo@prueba.test', 'x', now(), 'token') $$,
  '23514', null, 'solo la recuperación de contraseña lleva token');

select throws_ok(
  $$ insert into public.verification_codes (purpose, email, code_hash, expires_at)
     values ('otro', 'nuevo@prueba.test', 'x', now()) $$,
  '23514', null, 'un propósito que no existe no se guarda');

select lives_ok(
  $$ insert into public.verification_codes (purpose, user_id, email, new_email, code_hash, expires_at)
     values
       ('email_change', '00000000-0000-0000-0000-000000000001', 'comprador@prueba.test', 'otro@prueba.test', 'x', now()),
       ('password_reset', null, 'comprador@prueba.test', null, 'x', now()),
       ('signup_email', null, 'extrano@prueba.test', null, 'x', now()) $$,
  'con lo que pide cada propósito, se guarda');

-- Solo el servidor
select ok(not has_table_privilege('anon', 'public.verification_codes', 'select'), 'sin sesión no se lee');
select ok(not has_table_privilege('authenticated', 'public.verification_codes', 'select'), 'con sesión tampoco');
select ok((select relrowsecurity from pg_class where oid = 'public.verification_codes'::regclass), 'tiene RLS encendida');

-- Anonimizar borra los códigos del comprador y deja los de los demás
select public.anonymize_buyer('00000000-0000-0000-0000-000000000001');
select is_empty(
  $$ select 1 from public.verification_codes
     where user_id = '00000000-0000-0000-0000-000000000001' or email = 'comprador@prueba.test' $$,
  'al anonimizar al comprador se borran sus códigos');
select is((select count(*)::int from public.verification_codes where email = 'extrano@prueba.test'), 1,
  'los de otra persona se quedan');

select * from finish();
rollback;
