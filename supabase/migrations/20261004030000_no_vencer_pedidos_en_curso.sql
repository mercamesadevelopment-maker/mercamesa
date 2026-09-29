-- El vencimiento no toca un pedido que la tienda ya empezó a mover.
--
-- La primera corrida venció 4 pedidos viejos de tiendas de prueba cuyo pago fue
-- rechazado, pero que la tienda había confirmado, empacado, despachado o
-- entregado igual. Sus órdenes de tienda no se tocaron (solo se cancelan las
-- `pending`), pero el pedido padre quedó `cancelled` con una orden de tienda
-- `delivered`. Un pedido así no está abandonado: lo decide la tienda, no el
-- plazo.

create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  vencidos uuid[];
begin
  -- `skip locked`: un pedido que la sonda está confirmando en este momento no se
  -- vence; se revisa en la siguiente corrida.
  select coalesce(array_agg(id), '{}') into vencidos
  from (
    select o.id
    from public.orders o
    where o.client_id is null
      and o.status = 'pending'
      and o.expired_at is null
      and public.payable_until(o) < now()
      and not exists (
        select 1 from public.store_orders so
        where so.order_id = o.id
          and so.status not in ('pending', 'cancelled')
      )
    for update skip locked
  ) candidatos;

  if cardinality(vencidos) = 0 then
    return 0;
  end if;

  update public.orders
  set status = 'cancelled', expired_at = now(), updated_at = now()
  where id = any(vencidos);

  update public.store_orders
  set status = 'cancelled', updated_at = now()
  where order_id = any(vencidos)
    and status = 'pending';

  return cardinality(vencidos);
end;
$$;

revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- Los 4 que ya se vencieron así vuelven a como estaban.
update public.orders o
set status = 'pending', expired_at = null
where o.expired_at is not null
  and exists (
    select 1 from public.store_orders so
    where so.order_id = o.id
      and so.status not in ('pending', 'cancelled')
  );
