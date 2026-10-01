-- Devolución cuando una tienda no puede cumplir su parte de un pedido.
--
-- En un pedido de varias tiendas, que una no tenga el producto no puede tumbar
-- lo de las demás: esa tienda cancela su parte, el resto se despacha y al
-- comprador se le abona como saldo a favor lo que pagó por esos productos.
--
-- Hasta ahora toda devolución nacía de una PQRS aprobada. Esta no: no hay nada
-- que reclamar ni que decidir, la tienda misma dice que no va a entregar.

-- ---------------------------------------------------------------------------
-- De dónde sale una devolución
-- ---------------------------------------------------------------------------
alter table public.order_refunds
  alter column pqrs_id drop not null,
  add column origin text not null default 'pqrs'
    constraint order_refunds_origin_check check (origin in ('pqrs', 'store_cancel')),
  -- Una de PQRS siempre tiene su caso; una por cancelación, nunca.
  add constraint order_refunds_origen_coherente
    check ((origin = 'pqrs') = (pqrs_id is not null));

comment on column public.order_refunds.origin is
  'pqrs: la aprobó un caso. store_cancel: la tienda canceló su parte de un pedido ya pagado.';

-- Una parte se cancela una sola vez: es lo que hace idempotente la devolución.
create unique index order_refunds_cancelacion_unica
  on public.order_refunds (store_order_id)
  where origin = 'store_cancel';

-- ---------------------------------------------------------------------------
-- create_order_refund: acepta devoluciones sin caso
-- ---------------------------------------------------------------------------
-- Lo único que cambia es cómo se reconoce un reintento: por el caso si lo hay,
-- o por la parte cancelada si no. La cuenta de la plata sigue llegando hecha
-- desde el servidor (`lib/pqrs/refund-amount.ts`).
create or replace function public.create_order_refund(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pqrs uuid := nullif(p->>'pqrs_id', '')::uuid;
  v_origin text := case when nullif(p->>'pqrs_id', '') is null then 'store_cancel' else 'pqrs' end;
  v_store_order uuid := nullif(p->>'store_order_id', '')::uuid;
  v_order uuid := (p->>'order_id')::uuid;
  v_buyer uuid := (p->>'buyer_id')::uuid;
  v_total numeric := (p->>'total_amount')::numeric;
  v_products numeric := (p->>'products_amount')::numeric;
  v_by uuid := nullif(p->>'created_by', '')::uuid;
  v_order_total numeric;
  v_payment text;
  v_previo numeric;
  item jsonb;
  v_pedida numeric;
  v_devuelta numeric;
begin
  if v_origin = 'store_cancel' and v_store_order is null then
    raise exception 'CANCELACION_SIN_PARTE' using errcode = 'P0001';
  end if;

  -- El candado del pedido va primero: dos devoluciones del mismo pedido se
  -- hacen en fila, y la segunda ve lo que dejó la primera.
  select total, payment_status::text into v_order_total, v_payment
    from public.orders where id = v_order for update;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE' using errcode = 'P0001';
  end if;

  -- Reintento de la misma aprobación o de la misma cancelación: se devuelve la
  -- que ya existe.
  if v_origin = 'pqrs' then
    select id into v_id from public.order_refunds where pqrs_id = v_pqrs;
  else
    select id into v_id from public.order_refunds
     where store_order_id = v_store_order and origin = 'store_cancel';
  end if;
  if found then
    return v_id;
  end if;

  if v_payment is distinct from 'approved' then
    raise exception 'PEDIDO_SIN_PAGO' using errcode = 'P0001';
  end if;

  select coalesce(sum(total_amount), 0) into v_previo from public.order_refunds where order_id = v_order;
  if v_previo + v_total > v_order_total then
    raise exception 'DEVOLUCION_EXCEDE_PEDIDO' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    select quantity into v_pedida from public.order_items
     where id = (item->>'order_item_id')::uuid and order_id = v_order;
    if not found then
      raise exception 'PRODUCTO_NO_ES_DEL_PEDIDO' using errcode = 'P0001';
    end if;

    select coalesce(sum(ri.quantity), 0) into v_devuelta
      from public.order_refund_items ri
     where ri.order_item_id = (item->>'order_item_id')::uuid;

    if v_devuelta + (item->>'quantity')::numeric > v_pedida then
      raise exception 'CANTIDAD_EXCEDE_PEDIDO' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.order_refunds (
    pqrs_id, origin, order_id, store_order_id, store_id, buyer_id, scope,
    products_amount, service_commission_amount, platform_commission_amount,
    messages_amount, delivery_amount, total_amount, liable, created_by
  ) values (
    v_pqrs, v_origin, v_order, v_store_order, (p->>'store_id')::uuid, v_buyer, p->>'scope',
    v_products,
    coalesce((p->>'service_commission_amount')::numeric, 0),
    coalesce((p->>'platform_commission_amount')::numeric, 0),
    coalesce((p->>'messages_amount')::numeric, 0),
    coalesce((p->>'delivery_amount')::numeric, 0),
    v_total, p->>'liable', v_by
  )
  returning id into v_id;

  insert into public.order_refund_items (refund_id, order_item_id, quantity, amount)
  select v_id, (i->>'order_item_id')::uuid, (i->>'quantity')::numeric, (i->>'amount')::numeric
    from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) i;

  perform public.apply_buyer_credit(v_buyer, v_total, 'refund', v_id, v_order, null, v_by);

  -- La tienda solo asume el valor de sus productos, nunca las comisiones. En
  -- una cancelación no hay nada que descontarle: esa parte nunca se le va a
  -- pagar, así que quien llama no la marca como responsable.
  if p->>'liable' = 'store' and v_products > 0 then
    insert into public.store_charges (store_id, store_order_id, refund_id, amount)
    values ((p->>'store_id')::uuid, v_store_order, v_id, v_products);
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_order_refund(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_refund(jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- Una parte cancelada y ya devuelta no revive
-- ---------------------------------------------------------------------------
-- `revert_store_order_status` deja regresar un pedido a un estado anterior. Si
-- la tienda canceló su parte y el comprador ya tiene el saldo, reactivarla sería
-- entregarle gratis lo que se le devolvió. Va como disparador y no dentro de
-- esa función para que valga por cualquier camino que cambie el estado.
create or replace function public.fn_no_revivir_parte_devuelta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'cancelled'
     and new.status is distinct from 'cancelled'
     and exists (
       select 1 from public.order_refunds r
        where r.store_order_id = old.id and r.origin = 'store_cancel'
     ) then
    raise exception 'Esta parte del pedido se canceló y al comprador ya se le devolvió su valor: no se puede reactivar.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.fn_no_revivir_parte_devuelta() from public, anon, authenticated;

create trigger trg_no_revivir_parte_devuelta
  before update of status on public.store_orders
  for each row execute function public.fn_no_revivir_parte_devuelta();
