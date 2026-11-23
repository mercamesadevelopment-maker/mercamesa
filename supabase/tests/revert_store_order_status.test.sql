-- Regresar el estado de una parte solo pasa por el servidor.
-- Migración: 20261123180000_regresar_estado_por_el_servidor.sql
--
-- MM-2026-001100: se regresó la parte a «Empacando» llamando la función desde
-- el navegador, y la reserva de Pibox siguió viva. Ahora la llama la ruta, que
-- antes cancela el mensajero; desde una sesión de la app ya no se puede.

begin;
\ir _helpers/fixtures.inc
select plan(6);

insert into public.orders (id, buyer_id, consecutive, fulfillment)
values ('00000000-0000-0000-0000-000000000910', '00000000-0000-0000-0000-000000000001', 999910, 'store');

insert into public.store_orders (id, order_id, store_id, status)
values ('00000000-0000-0000-0000-000000000911', '00000000-0000-0000-0000-000000000910',
        '00000000-0000-0000-0000-000000000101', 'at_collection');

insert into public.store_order_status_history (store_order_id, status)
values ('00000000-0000-0000-0000-000000000911', 'packing'),
       ('00000000-0000-0000-0000-000000000911', 'at_collection');

-- Desde una sesión de la app, ni el tendero de la tienda puede llamarla.
select pg_temp.como('00000000-0000-0000-0000-000000000002');
select throws_ok(
  $$ select public.revert_store_order_status('00000000-0000-0000-0000-000000000911', 'packing', 'cierro temprano',
       '00000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'una sesión de la app no la ejecuta: solo el servidor'
);
select pg_temp.como_postgres();

-- Como el servidor: valida con `p_actor`.
set local role service_role;

select throws_ok(
  $$ select public.revert_store_order_status('00000000-0000-0000-0000-000000000911', 'packing', 'cierro temprano',
       '00000000-0000-0000-0000-000000000004') $$,
  '42501', 'No tienes permiso para modificar este pedido.',
  'alguien que no es de la tienda ni admin no la regresa'
);

select throws_ok(
  $$ select public.revert_store_order_status('00000000-0000-0000-0000-000000000911', 'packing', '  ',
       '00000000-0000-0000-0000-000000000002') $$,
  '22023', 'La observación es obligatoria para regresar un pedido de estado.',
  'sin observación no'
);

select throws_ok(
  $$ select public.revert_store_order_status('00000000-0000-0000-0000-000000000911', 'packing', 'cierro temprano', null) $$,
  '42501', 'No autorizado.',
  'sin quién, no'
);

select lives_ok(
  $$ select public.revert_store_order_status('00000000-0000-0000-0000-000000000911', 'packing', 'cierro temprano',
       '00000000-0000-0000-0000-000000000002') $$,
  'el tendero de la tienda la regresa'
);

reset role;

select results_eq(
  $$ select so.status::text, h.changed_by, h.is_reversal
       from public.store_orders so
       join public.store_order_status_history h on h.store_order_id = so.id
      where so.id = '00000000-0000-0000-0000-000000000911'
      order by h.created_at desc, h.is_reversal desc
      limit 1 $$,
  $$ values ('packing'::text, '00000000-0000-0000-0000-000000000002'::uuid, true) $$,
  'queda en «Empacando», como corrección y a nombre de quien la hizo'
);

select * from finish();
rollback;
