-- La cuenta de pago de una tienda no se registra sin aceptar la autorización,
-- y la constancia no se cambia después.
-- Migración: 20261027124513_autorizacion_de_pago.sql

begin;
\ir _helpers/fixtures.inc
select plan(6);

-- Como el tendero de la tienda A, que es quien registra la cuenta.
select pg_temp.como('00000000-0000-0000-0000-000000000002');

select throws_ok(
  $$ insert into public.store_bank_accounts (store_id, payment_method, breb_key, holder_document_type,
       holder_document_number, holder_document_dv, holder_name, holder_address)
     values ('00000000-0000-0000-0000-000000000101', 'breb', '3001234567', '01', '123', '0', 'Ana', 'Medellín') $$,
  '23514', 'Hay que aceptar la autorización de pago para registrar la cuenta',
  'sin la autorización, la cuenta no entra');

select lives_ok(
  $$ insert into public.store_bank_accounts (store_id, payment_method, breb_key, holder_document_type,
       holder_document_number, holder_document_dv, holder_name, holder_address,
       authorization_version, authorization_accepted_at)
     values ('00000000-0000-0000-0000-000000000101', 'breb', '3001234567', '01', '123', '0', 'Ana', 'Medellín',
       '2026-10-27', '2000-01-01') $$,
  'con la autorización, entra');

select pg_temp.como_postgres();
select is(
  (select authorization_version from public.store_bank_accounts where store_id = '00000000-0000-0000-0000-000000000101'),
  '2026-10-27', 'guarda la versión aceptada');
select ok(
  (select authorization_accepted_at > now() - interval '1 minute' from public.store_bank_accounts
    where store_id = '00000000-0000-0000-0000-000000000101'),
  'la fecha la pone la base, no quien escribe');

select pg_temp.como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ update public.store_bank_accounts set authorization_version = 'otra'
     where store_id = '00000000-0000-0000-0000-000000000101' $$,
  '42501', null, 'el tendero no cambia la constancia');

-- Ni quien verifica.
select pg_temp.como_postgres();
select throws_ok(
  $$ update public.store_bank_accounts set authorization_accepted_at = now() - interval '1 year'
     where store_id = '00000000-0000-0000-0000-000000000101' $$,
  '42501', null, 'tampoco con permisos de sobra');

select * from finish();
rollback;
