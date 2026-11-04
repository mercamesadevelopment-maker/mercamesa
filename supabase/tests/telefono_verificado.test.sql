-- Teléfono verificado: un número por cuenta, la verificación solo la pone el
-- servidor y se pierde al cambiar el número, y la limpieza de los repetidos.
-- Migración: 20261104161445_telefono_verificado.sql

begin;
\ir _helpers/fixtures.inc
select plan(10);

-- --- Limpieza de repetidos (sin el índice, como estaba producción)
drop index public.profiles_phone_unique;
update public.profiles set phone = '+573001110000'
  where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
update public.profiles set phone = 'correo@escrito.aca' where id = '00000000-0000-0000-0000-000000000004';

select is(public.limpiar_telefonos_repetidos(), 2, 'vacía un repetido y el que no es un teléfono');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000002'), '+573001110000',
  'lo conserva el tendero, que tiene tienda');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000001'), null,
  'el comprador sin pedidos lo pierde');
select is((select phone from public.profiles where id = '00000000-0000-0000-0000-000000000004'), null,
  'el correo escrito en el teléfono se vacía');

create unique index profiles_phone_unique on public.profiles (phone) where phone is not null;

select throws_ok(
  $$ update public.profiles set phone = '+573001110000' where id = '00000000-0000-0000-0000-000000000001' $$,
  '23505', null, 'un número no puede quedar en dos cuentas');

-- --- La verificación
update public.profiles set phone = '+573002220000', phone_verified_at = now()
  where id = '00000000-0000-0000-0000-000000000001';
-- El trigger vacía la verificación cuando el número cambia en la misma
-- actualización; el servidor la pone después, en una aparte.
update public.profiles set phone_verified_at = now() where id = '00000000-0000-0000-0000-000000000001';

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select throws_ok(
  $$ update public.profiles set phone_verified_at = now() where id = '00000000-0000-0000-0000-000000000004' $$,
  '42501', null, 'el usuario no puede marcarse verificado con su sesión');

select pg_temp.como('00000000-0000-0000-0000-000000000001');
update public.profiles set phone = '+573003330000' where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.como_postgres();
select is((select phone_verified_at from public.profiles where id = '00000000-0000-0000-0000-000000000001'), null,
  'cambiar el número le quita la verificación');

-- --- El código
select throws_ok(
  $$ insert into public.verification_codes (purpose, user_id, email, code_hash, expires_at)
     values ('phone_verification', '00000000-0000-0000-0000-000000000001', 'comprador@prueba.test', 'x', now()) $$,
  '23514', null, 'un código de teléfono sin teléfono no entra');
select throws_ok(
  $$ insert into public.verification_codes (purpose, email, phone, code_hash, expires_at)
     values ('phone_verification', 'comprador@prueba.test', '+573003330000', 'x', now()) $$,
  '23514', null, 'ni uno sin cuenta');
select lives_ok(
  $$ insert into public.verification_codes (purpose, user_id, email, phone, code_hash, expires_at)
     values ('phone_verification', '00000000-0000-0000-0000-000000000001', 'comprador@prueba.test', '+573003330000', 'x', now()) $$,
  'con teléfono y cuenta, sí');

select * from finish();
rollback;
