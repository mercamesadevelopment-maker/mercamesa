-- Usar el saldo a favor al comprar.
--
-- Al crear el pedido, el servidor aparta del saldo del comprador hasta el total
-- del pedido. La pasarela cobra solo el resto (`total - credit_applied`); si el
-- saldo lo cubre todo, el pedido queda pagado sin pasar por la pasarela.
--
-- El saldo apartado es FIJO durante la vida del pedido: no se cambia en un
-- reintento de pago. Así lo que se cobra por un pedido es siempre el mismo
-- valor, sin importar por cuál de los caminos de pago se llegue.

alter table public.orders
  add column if not exists credit_applied numeric not null default 0;

-- Cuándo se le devolvió ese saldo al comprador porque el pedido no se pagó.
-- `credit_applied` no se borra: si el pago llega tarde, hay que saber cuánto
-- volver a descontar.
alter table public.orders
  add column if not exists credit_released_at timestamptz;

alter table public.orders drop constraint if exists orders_credit_applied_check;
alter table public.orders add constraint orders_credit_applied_check
  check (credit_applied >= 0 and credit_applied <= total);

comment on column public.orders.credit_applied is
  'Saldo a favor apartado para este pedido. La pasarela cobra total - credit_applied.';
comment on column public.orders.credit_released_at is
  'El pedido no se pagó y el saldo apartado volvió al comprador.';

-- ---------------------------------------------------------------------------
-- El saldo apartado sigue al pedido, pase por donde pase.
--
-- Un pedido sin pagar se cancela por varios caminos (vence, lo cancela el
-- comprador, se recupera el carrito). En vez de acordarse de devolver el saldo
-- en cada uno, lo hace este trigger: basta con que el pedido quede cancelado o
-- vencido sin pago aprobado.
--
-- Y el caso contrario: un pago que la pasarela aprueba DESPUÉS de vencido el
-- pedido. El pedido revive (ver `fn_confirm_store_orders_on_payment`) y el
-- comprador pagó solo el resto, así que el saldo se vuelve a descontar. Si ya lo
-- gastó en otra compra, su saldo queda en negativo: es una deuda real, y es
-- mejor verla que esconderla.
-- ---------------------------------------------------------------------------
create or replace function public.fn_order_credit_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.credit_applied <= 0 or new.buyer_id is null then
    return new;
  end if;

  if new.payment_status = 'approved'
     and old.payment_status is distinct from 'approved'
     and new.credit_released_at is not null then
    insert into public.buyer_credit_movements (buyer_id, amount, kind, order_id, notes)
    values (new.buyer_id, -new.credit_applied, 'redemption', new.id,
            'El pago se aprobó después de vencer el pedido: el saldo se vuelve a usar.');
    new.credit_released_at := null;

  elsif new.credit_released_at is null
        and new.payment_status is distinct from 'approved'
        and (new.status = 'cancelled' or new.expired_at is not null) then
    insert into public.buyer_credit_movements (buyer_id, amount, kind, order_id, notes)
    values (new.buyer_id, new.credit_applied, 'release', new.id, null);
    new.credit_released_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_order_credit_guard on public.orders;
create trigger trg_order_credit_guard
  before update on public.orders
  for each row execute function public.fn_order_credit_guard();

-- ---------------------------------------------------------------------------
-- Apartar el saldo para un pedido recién creado.
--
-- Devuelve cuánto se apartó. Si cubre el total, deja el pedido pagado: registra
-- el pago (proveedor 'saldo') y marca el pedido como aprobado y confirmado, que
-- es lo mismo que hacen las funciones de la pasarela cuando un pago se aprueba,
-- así que dispara lo mismo: la tienda recibe el pedido, se descuenta el
-- inventario y la factura queda en cola.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_order_credit(p_order uuid, p_buyer uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.orders%rowtype;
  saldo numeric;
  aparta numeric;
begin
  -- Mismo candado que `apply_buyer_credit`: dos pedidos a la vez no apartan el
  -- mismo saldo.
  perform pg_advisory_xact_lock(hashtextextended('buyer_credit:' || p_buyer::text, 0));

  select * into o from public.orders where id = p_order and buyer_id = p_buyer for update;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE' using errcode = 'P0001';
  end if;

  -- Ya tiene saldo apartado, o ya no es un pedido por pagar: no se toca.
  if o.credit_applied > 0 then
    return o.credit_applied;
  end if;
  if o.client_id is not null
     or o.status <> 'pending'
     or o.payment_status = 'approved'
     or o.expired_at is not null then
    return 0;
  end if;

  saldo := public.buyer_credit_balance(p_buyer);
  aparta := least(saldo, o.total);

  if aparta <= 0 then
    return 0;
  end if;

  perform public.apply_buyer_credit(p_buyer, -aparta, 'redemption', null, p_order, null, p_buyer);

  update public.orders set credit_applied = aparta, updated_at = now() where id = p_order;

  if aparta = o.total then
    insert into public.payments (order_id, provider, str_id_pago, status, amount, payment_method, payment_method_label)
    values (p_order, 'saldo', 'saldo-' || p_order::text, 'approved', aparta, 'credit', 'Saldo a favor');

    update public.orders
       set payment_status = 'approved', status = 'confirmed', updated_at = now()
     where id = p_order;

    -- Como al aprobarse un pago: lo comprado sale del carrito.
    delete from public.cart_items where order_id = p_order;
  end if;

  return aparta;
end;
$$;

revoke all on function public.reserve_order_credit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_order_credit(uuid, uuid) to service_role;
revoke all on function public.fn_order_credit_guard() from public, anon, authenticated;
