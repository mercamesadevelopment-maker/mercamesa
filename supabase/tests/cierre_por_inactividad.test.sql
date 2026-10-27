-- Cierre por inactividad: qué cuenta como actividad, a quién alcanza y quién lo ve.
-- Migración: 20261027204052_cierre_por_inactividad.sql

begin;
\ir _helpers/fixtures.inc
select plan(12);

-- Todas las cuentas de prueba nacieron hace dos años y no han vuelto a entrar.
update auth.users set created_at = now() - interval '2 years', last_sign_in_at = now() - interval '2 years'
where id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
             '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004');

create function pg_temp.inactivos() returns setof uuid language sql as $$
  select user_id from public.inactive_accounts(now() - interval '1 year', 100000)
  where user_id in ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
                    '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004')
$$;

select set_eq(
  'select * from pg_temp.inactivos()',
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid), ('00000000-0000-0000-0000-000000000002'),
            ('00000000-0000-0000-0000-000000000004') $$,
  'compradores y tenderos sin actividad; el admin no');

-- Una sesión renovada hace un mes cuenta como actividad, aunque no haya
-- iniciado sesión en dos años.
insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', now() - interval '2 years',
        now() - interval '1 month', (now() - interval '1 month')::timestamp);
select ok(
  '00000000-0000-0000-0000-000000000001' not in (select * from pg_temp.inactivos()),
  'la sesión renovada lo saca de los inactivos');
select ok(
  public.last_account_activity('00000000-0000-0000-0000-000000000001') > now() - interval '2 months',
  'last_account_activity toma la renovación de la sesión');

-- Un pedido reciente también.
insert into public.orders (id, buyer_id, consecutive) values
  ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000004', 999401);
select ok(
  '00000000-0000-0000-0000-000000000004' not in (select * from pg_temp.inactivos()),
  'un pedido reciente también cuenta');

-- Una cuenta ya anonimizada no vuelve a aparecer.
update public.profiles set anonymized_at = now() where id = '00000000-0000-0000-0000-000000000002';
select ok(
  '00000000-0000-0000-0000-000000000002' not in (select * from pg_temp.inactivos()),
  'una cuenta anonimizada queda fuera');

-- El registro de acciones admite la del cierre, sin persona detrás.
select lives_ok(
  $$ insert into public.admin_user_actions (actor_id, target_user_id, action)
     values (null, '00000000-0000-0000-0000-000000000004', 'closed_inactive') $$,
  'admin_user_actions acepta closed_inactive sin actor');

select throws_ok(
  $$ insert into public.closed_account_emails (email_hash) values ('no-es-un-hash') $$,
  '23514', null, 'closed_account_emails solo guarda una huella sha256');

-- Nada de esto lo ve ni lo ejecuta una sesión.
insert into public.account_inactivity_notices (user_id, closes_at)
values ('00000000-0000-0000-0000-000000000004', now() + interval '14 days');
insert into public.closed_account_emails (email_hash) values (repeat('a', 64));

update public.orders set created_at = now() - interval '2 years' where id = '00000000-0000-0000-0000-000000000400';
select ok(
  '00000000-0000-0000-0000-000000000004' not in (select * from pg_temp.inactivos()),
  'quien ya tiene aviso no vuelve a salir: no se le avisa dos veces');

select pg_temp.como('00000000-0000-0000-0000-000000000004');
select is_empty($$ select 1 from public.account_inactivity_notices $$, 'una sesión no lee los avisos');
select is_empty($$ select 1 from public.closed_account_emails $$, 'ni las huellas de las cuentas cerradas');
select throws_ok(
  $$ select * from public.inactive_accounts(now(), 10) $$,
  '42501', null, 'una sesión no puede listar cuentas inactivas');

select pg_temp.como_anon();
select throws_ok(
  $$ select public.last_account_activity('00000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'ni alguien sin sesión, la actividad de una cuenta');

select * from finish();
rollback;
