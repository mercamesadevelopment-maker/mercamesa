-- Sin sesión no se escribe nada ni se leen pedidos, y con sesión no se escriben
-- pedidos ni pagos: eso lo hace el servidor.
-- Migración: 20261020182323_seguridad_permisos_escritura.sql

begin;
\ir _helpers/fixtures.inc
select plan(14);

-- Con la llave pública no se escribe en ninguna tabla de `public`.
select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
       and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
            or has_table_privilege('anon', c.oid, 'delete')) $$,
  'anon no escribe en ninguna tabla');

select ok(not has_table_privilege('anon', 'public.orders', 'select'), 'anon no lee pedidos');
select ok(not has_table_privilege('anon', 'public.payments', 'select'), 'anon no lee pagos');
select ok(not has_table_privilege('anon', 'public.delivery_addresses', 'select'), 'anon no lee direcciones');
select ok(not has_table_privilege('anon', 'public.invitations', 'select'), 'anon no lee invitaciones');
select ok(not has_table_privilege('anon', 'public.orders_detail_view', 'select'), 'anon no lee orders_detail_view');
select ok(has_table_privilege('anon', 'public.stores', 'select'), 'anon sí lee tiendas (la vitrina)');

-- Una sesión no escribe pedidos ni pagos.
select ok(not has_table_privilege('authenticated', 'public.payments', 'update'), 'una sesión no modifica pagos');
select ok(not has_table_privilege('authenticated', 'public.orders', 'update'), 'una sesión no modifica pedidos');
select ok(not has_table_privilege('authenticated', 'public.store_orders', 'update'), 'una sesión no cambia el estado de una parte');
select ok(not has_table_privilege('authenticated', 'public.store_order_status_history', 'insert'),
  'una sesión no escribe en el historial de estados');

-- Lo mismo, intentándolo.
select pg_temp.como_anon();
select throws_ok($$ update public.stores set name = name $$, '42501', null, 'anon: modificar una tienda falla');
select pg_temp.como('00000000-0000-0000-0000-000000000001');
select throws_ok($$ update public.orders set notes = notes $$, '42501', null, 'comprador: modificar pedidos falla');
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select throws_ok($$ update public.store_orders set status = status $$, '42501', null,
  'tendero: cambiar el estado directo en la base falla');

select * from finish();
rollback;
