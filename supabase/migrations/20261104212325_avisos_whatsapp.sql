-- Avisos del pedido para que Meteor los envíe por WhatsApp.
--
-- Meteor arma y envía los mensajes con sus plantillas de Meta; lo único que no
-- puede saber es CUÁNDO pasa algo, porque pasa en nuestra base. Prefirieron
-- consultar cada cierto tiempo en vez de recibir un webhook: esta tabla es la
-- lista que consultan (`GET /api/meteor/avisos?desde=<seq>`), con `seq` como
-- cursor.
--
-- Los triggers guardan solo la referencia. Los datos del aviso (productos,
-- destinatario, enlace de seguimiento) se arman al consultar, con lo que haya
-- en ese momento, y ahí también se decide si se avisa: teléfono verificado,
-- avisos encendidos y la regla de los pedidos de varias tiendas
-- (`lib/whatsapp-events/`).

create table public.whatsapp_events (
  -- El cursor de Meteor: siempre crece.
  seq bigserial primary key,
  -- Lo que Meteor usa para no enviar dos veces el mismo aviso.
  id uuid not null default gen_random_uuid() unique,
  event_type text not null check (event_type in ('pedido_confirmado', 'parte_estado', 'domicilio_en_camino')),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- La parte (tienda) del cambio de estado o del domicilio. Vacío cuando el
  -- aviso es del pedido completo.
  store_order_id uuid references public.store_orders (id) on delete cascade,
  status_to text,
  created_at timestamptz not null default now()
);

comment on table public.whatsapp_events is
  'Avisos del pedido que Meteor consulta para enviar por WhatsApp. Solo referencias; el contenido se arma al consultar. Se borran a los 7 días. Solo el servidor la usa.';

-- El webhook de Pibox y los reintentos repiten estados: el mismo aviso no entra dos veces.
create unique index whatsapp_events_unico on public.whatsapp_events
  (event_type, order_id, coalesce(store_order_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(status_to, ''));
create index whatsapp_events_por_fecha on public.whatsapp_events (created_at);

alter table public.whatsapp_events enable row level security;
revoke all on public.whatsapp_events from anon, authenticated;

-- --------------------------------------------------------------------------
-- Pago aprobado: «recibimos tu pedido»
-- --------------------------------------------------------------------------

create function public.whatsapp_aviso_pago_aprobado() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
begin
  insert into whatsapp_events (event_type, order_id)
  values ('pedido_confirmado', new.id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger whatsapp_aviso_pago_aprobado
  after insert or update of payment_status on public.orders
  for each row
  when (new.payment_status = 'approved')
  execute function public.whatsapp_aviso_pago_aprobado();

-- --------------------------------------------------------------------------
-- Cambio de estado de una parte
-- --------------------------------------------------------------------------

-- Pasa por `store_order_status_history` porque todas las rutas que cambian un
-- estado (tendero, patinador, logística, Pibox, cancelar) escriben ahí. No se
-- avisan las correcciones manuales (`is_reversal`).
--
-- En un pedido de varias tiendas sale un solo mensajero para todas: la entrega
-- se avisa una vez, para el pedido completo, cuando la última parte termina.
create function public.whatsapp_aviso_estado() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  v_order uuid;
  v_fulfillment text;
begin
  if new.is_reversal
     or new.status not in ('packing', 'at_collection', 'dispatched', 'delivered', 'cancelled', 'returned') then
    return new;
  end if;

  select so.order_id, o.fulfillment into v_order, v_fulfillment
  from store_orders so join orders o on o.id = so.order_id
  where so.id = new.store_order_id;

  if v_order is null then
    return new;
  end if;

  if v_fulfillment = 'consolidated' and new.status = 'delivered' then
    if exists (
      select 1 from store_orders
      where order_id = v_order and status not in ('delivered', 'cancelled', 'returned')
    ) then
      return new;
    end if;
    insert into whatsapp_events (event_type, order_id, status_to)
    values ('parte_estado', v_order, 'delivered')
    on conflict do nothing;
    return new;
  end if;

  insert into whatsapp_events (event_type, order_id, store_order_id, status_to)
  values ('parte_estado', v_order, new.store_order_id, new.status::text)
  on conflict do nothing;
  return new;
end;
$$;

create trigger whatsapp_aviso_estado
  after insert on public.store_order_status_history
  for each row execute function public.whatsapp_aviso_estado();

-- --------------------------------------------------------------------------
-- El domicilio tiene enlace de seguimiento
-- --------------------------------------------------------------------------

-- Una reserva es del pedido completo (consolidado) o de una parte, nunca de
-- los dos (`pibox_bookings_un_dueno`).
create function public.whatsapp_aviso_domicilio() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  v_order uuid := new.order_id;
begin
  if tg_op = 'UPDATE' and old.tracking_link is not null then
    return new;
  end if;

  if v_order is null then
    select order_id into v_order from store_orders where id = new.store_order_id;
  end if;
  if v_order is null then
    return new;
  end if;

  insert into whatsapp_events (event_type, order_id, store_order_id)
  values ('domicilio_en_camino', v_order, new.store_order_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger whatsapp_aviso_domicilio
  after insert or update of tracking_link on public.pibox_bookings
  for each row
  when (new.tracking_link is not null and btrim(new.tracking_link) <> '')
  execute function public.whatsapp_aviso_domicilio();

revoke all on function public.whatsapp_aviso_pago_aprobado() from public, anon, authenticated;
revoke all on function public.whatsapp_aviso_estado() from public, anon, authenticated;
revoke all on function public.whatsapp_aviso_domicilio() from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Retención: 7 días
-- --------------------------------------------------------------------------

-- SQL puro: corre también en local y en staging (no lo apaga `post.sql`).
select cron.schedule(
  'whatsapp_events_cleanup',
  '0 8 * * *',
  $$delete from public.whatsapp_events where created_at < now() - interval '7 days'$$
);
