-- Los pedidos en línea que nadie paga vencen a las 2 horas.
--
-- Antes un pedido abandonado en la pasarela quedaba `pending` para siempre: la
-- tienda lo veía como «Pendiente de Pago» sin fin, y cada reintento del
-- comprador sumaba otro (una compradora dejó 6 en cuatro minutos).
--
-- Mientras no vence, el pedido es pagable: el comprador puede reintentar el pago
-- desde «Mis órdenes» y el carrito no se lo devuelve. Cada intento de pago
-- reinicia el plazo, porque es actividad del comprador sobre ese pedido.

alter table public.orders add column if not exists expired_at timestamptz;

comment on column public.orders.expired_at is
  'Cuándo venció sin pagarse. Distingue el vencimiento de una cancelación manual: solo un pedido vencido revive si el pago llega tarde.';

/**
 * Hasta cuándo se puede pagar un pedido, o null si ya no se puede.
 *
 * Una sola definición para el cron que vence, la API que evita duplicados,
 * `zonapagos-inicio` y el botón «Pagar». Como toma la fila de `orders`,
 * PostgREST la expone además como columna calculada (`payable_until`).
 */
create or replace function public.payable_until(o public.orders)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when o.client_id is null
     and o.status = 'pending'
     and o.payment_status is distinct from 'approved'
     and o.expired_at is null
    then greatest(
      o.created_at,
      -- `payments.created_at` es `timestamp` sin zona, guardado en UTC.
      coalesce((select max(p.created_at) at time zone 'UTC' from public.payments p where p.order_id = o.id), o.created_at)
    ) + interval '2 hours'
  end;
$$;

/**
 * Vence los pedidos sin pagar cuyo plazo pasó.
 *
 * Los pagos pendientes se dejan como están: la sonda sigue preguntándole a
 * ZonaPagos por ellos, y si uno resulta aprobado el pedido revive (ver
 * `fn_confirm_store_orders_on_payment`). El stock no se toca: un pedido sin
 * pagar nunca lo descontó.
 */
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

/**
 * Al aprobarse el pago, las órdenes de tienda pasan a confirmadas.
 *
 * También las de un pedido que había vencido: si ZonaPagos aprueba un pago
 * después del plazo, el comprador pagó y la tienda tiene que despacharlo. Una
 * cancelación manual (sin `expired_at`) no revive.
 */
create or replace function public.fn_confirm_store_orders_on_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if NEW.payment_status = 'approved'
     and OLD.payment_status is distinct from 'approved' then

    update public.store_orders
    set status = 'confirmed'
    where order_id = NEW.id
      and (status = 'pending'
           or (status = 'cancelled' and NEW.expired_at is not null));
  end if;

  return NEW;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'expire_unpaid_orders') then
    perform cron.unschedule('expire_unpaid_orders');
  end if;
end $$;

select cron.schedule('expire_unpaid_orders', '*/15 * * * *', $$select public.expire_unpaid_orders()$$);
