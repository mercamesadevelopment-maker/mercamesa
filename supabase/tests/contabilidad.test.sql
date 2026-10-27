-- Módulo «Contabilidad» y rol «Auxiliar contable»: qué puede y qué no.
-- Migración: 20261026171606_contabilidad.sql

begin;
\ir _helpers/fixtures.inc
select plan(9);

select isnt_empty($$ select 1 from public.roles where name = 'accountant' $$, 'existe el rol de auxiliar contable');
-- Que nazca inactivo no se puede probar aquí: en local `post.sql` enciende
-- todos los módulos.
select is(
  (select path from public.modules where key = 'accounting'),
  '/admin/accounting', 'el módulo existe, en su ruta');

-- Un auxiliar contable de prueba.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c0a70', 'aux-prueba@contabilidad.test');
insert into public.profiles (id, email, full_name, role_id, is_active)
select '00000000-0000-0000-0000-0000000c0a70', 'aux-prueba@contabilidad.test', 'Auxiliar de prueba', id, true
from public.roles where name = 'accountant';

select pg_temp.como('00000000-0000-0000-0000-0000000c0a70');

select ok(public.has_permission('accounting', 'read'), 've Contabilidad');
select ok(public.has_permission('accounting', 'update'), 'marca devoluciones como pagadas');
select ok(public.has_permission('payouts', 'create') and public.has_permission('payouts', 'update')
          and public.has_permission('payouts', 'delete'), 'arma, aprueba y anula dispersiones');
select ok(not public.has_permission('orders', 'read'), 'no ve los pedidos');
select ok(not public.has_permission('system-settings', 'read'), 'no ve la parametrización');
select ok(not public.has_permission('users', 'read'), 'no ve los usuarios');
select ok(not public.has_permission('master-catalog', 'read'), 'no ve el catálogo maestro');

select * from finish();
rollback;
