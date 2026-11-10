-- Avisos con los códigos de Pibox, para que Meteor los envíe por WhatsApp.
--
-- - `codigo_recogida`: Pibox dio el código que el mensajero valida al recoger. Va
--   a quien le entrega el paquete: el equipo de la tienda o, si el pedido sale de
--   la bahía de la plaza, logística o el patinador (línea de tenderos).
-- - `domicilio_recogido`: el mensajero ya recogió y va hacia el comprador. Va al
--   comprador con su código de entrega.
--
-- Como en los demás avisos, la fila guarda solo la referencia: los códigos, el
-- conductor y los destinatarios se leen al consultar (`lib/whatsapp-events/`).

alter table public.whatsapp_events drop constraint whatsapp_events_event_type_check;
alter table public.whatsapp_events add constraint whatsapp_events_event_type_check
  check (event_type in ('pedido_confirmado', 'parte_estado', 'domicilio_en_camino', 'codigo_recogida', 'domicilio_recogido'));

-- El pedido de una reserva: la tiene directa si es consolidada; si no, por su parte.
create function public.whatsapp_pedido_de_reserva(p_order uuid, p_store_order uuid) returns uuid
    language sql
    stable
    security definer
    set search_path to 'public'
    as $$
  select coalesce(p_order, (select order_id from store_orders where id = p_store_order));
$$;

-- --------------------------------------------------------------------------
-- Pibox dio el código de recogida
-- --------------------------------------------------------------------------

-- Una vez por reserva: si el webhook lo repite, o cambia, no se vuelve a avisar
-- (el índice único de `whatsapp_events` lo impide).
create function public.whatsapp_aviso_codigo_recogida() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  v_order uuid := whatsapp_pedido_de_reserva(new.order_id, new.store_order_id);
begin
  if v_order is null then
    return new;
  end if;

  insert into whatsapp_events (event_type, order_id, store_order_id)
  values ('codigo_recogida', v_order, new.store_order_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger whatsapp_aviso_codigo_recogida
  after insert or update of pickup_validation_code on public.pibox_bookings
  for each row
  when (new.pickup_validation_code is not null and btrim(new.pickup_validation_code) <> '')
  execute function public.whatsapp_aviso_codigo_recogida();

-- --------------------------------------------------------------------------
-- El mensajero recogió: va hacia el comprador
-- --------------------------------------------------------------------------

-- `status_cd` 6 es «paquete a bordo» en Pibox (`lib/pibox/constants.ts`).
create function public.whatsapp_aviso_domicilio_recogido() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  v_order uuid;
begin
  if tg_op = 'UPDATE' and old.status_cd is not distinct from 6 then
    return new;
  end if;

  v_order := whatsapp_pedido_de_reserva(new.order_id, new.store_order_id);
  if v_order is null then
    return new;
  end if;

  insert into whatsapp_events (event_type, order_id, store_order_id)
  values ('domicilio_recogido', v_order, new.store_order_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger whatsapp_aviso_domicilio_recogido
  after insert or update of status_cd on public.pibox_bookings
  for each row
  when (new.status_cd = 6)
  execute function public.whatsapp_aviso_domicilio_recogido();

revoke all on function public.whatsapp_pedido_de_reserva(uuid, uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_aviso_codigo_recogida() from public, anon, authenticated;
revoke all on function public.whatsapp_aviso_domicilio_recogido() from public, anon, authenticated;
