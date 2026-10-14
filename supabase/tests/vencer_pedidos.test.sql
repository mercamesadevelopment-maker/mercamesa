-- Un pedido sin pagar vence a las 2 horas (tarea programada
-- `expire_unpaid_orders`); uno pagado o ya en preparación no.

begin;
\ir _helpers/fixtures.inc
select plan(5);

insert into public.orders (id, buyer_id, consecutive, created_at)
values
  -- sin pagar hace 3 horas: vence
  ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000001', 999101, now() - interval '3 hours'),
  -- sin pagar hace 1 hora: todavía no
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001', 999102, now() - interval '1 hour'),
  -- hace 3 horas, pero una tienda ya lo está preparando: no se toca
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001', 999103, now() - interval '3 hours');

insert into public.store_orders (order_id, store_id, status)
values
  ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000101', 'pending'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000101', 'packing');

select is(public.expire_unpaid_orders(), 1, 'vence exactamente un pedido');

select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000400'),
  'cancelled', 'el pedido sin pagar de hace 3 horas queda cancelado');
select is((select status::text from public.store_orders where order_id = '00000000-0000-0000-0000-000000000400'),
  'cancelled', 'y su parte de la tienda también');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000401'),
  'pending', 'el de hace 1 hora sigue pendiente');
select is((select status::text from public.orders where id = '00000000-0000-0000-0000-000000000402'),
  'pending', 'el que una tienda ya prepara no se cancela');

select * from finish();
rollback;
