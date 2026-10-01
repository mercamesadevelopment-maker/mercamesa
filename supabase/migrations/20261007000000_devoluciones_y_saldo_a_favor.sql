-- Devoluciones y saldo a favor.
--
-- Cuando se aprueba un reclamo por un producto, el comprador recibe saldo a
-- favor que podrá usar en cualquier tienda. El dinero no sale de MercaMesa: la
-- plataforma recauda todo y le paga a la tienda después, así que basta con
-- pagarle menos a la tienda que asume el costo.
--
-- Cuatro piezas:
--   order_refunds            la devolución, con su desglose
--   order_refund_items       qué líneas del pedido y cuánto de cada una
--   buyer_credit_movements   el libro del saldo a favor de cada comprador
--   store_charges            lo que se le descuenta a la tienda en su próximo pago
--
-- Todas con RLS y sin políticas: las toca el servidor, y lo que es plata se
-- escribe solo por las funciones de abajo, que lo hacen en una sola transacción.

-- ---------------------------------------------------------------------------
-- La devolución.
-- ---------------------------------------------------------------------------
create table if not exists public.order_refunds (
  id uuid primary key default gen_random_uuid(),
  -- Una devolución por caso: es también lo que hace que aprobar dos veces no
  -- acredite dos veces.
  pqrs_id uuid not null unique references public.pqrs(id),
  order_id uuid not null references public.orders(id),
  store_order_id uuid references public.store_orders(id),
  store_id uuid not null references public.stores(id),
  buyer_id uuid not null references public.profiles(id),

  -- 'items': unos productos. 'order': el pedido completo, con domicilio.
  scope text not null check (scope in ('items', 'order')),

  products_amount numeric not null check (products_amount >= 0),
  service_commission_amount numeric not null default 0 check (service_commission_amount >= 0),
  platform_commission_amount numeric not null default 0 check (platform_commission_amount >= 0),
  messages_amount numeric not null default 0 check (messages_amount >= 0),
  delivery_amount numeric not null default 0 check (delivery_amount >= 0),
  total_amount numeric not null check (total_amount > 0),

  -- Quién asume el valor de los productos. Las comisiones las asume siempre
  -- MercaMesa, que es quien las cobró.
  liable text not null check (liable in ('store', 'logistics', 'platform')),

  -- Saldo a favor por defecto. 'money' es la excepción: el comprador exigió su
  -- dinero y un administrador lo gestiona por fuera de la plataforma.
  method text not null default 'credit' check (method in ('credit', 'money')),
  status text not null default 'credited' check (status in ('credited', 'money_pending', 'money_paid')),
  money_reference text,
  money_paid_at timestamptz,
  money_paid_by uuid references public.profiles(id),

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.order_refunds is
  'Devoluciones aprobadas por PQRS. El total es lo que se le acreditó al comprador.';

create index if not exists order_refunds_order_idx on public.order_refunds (order_id);
create index if not exists order_refunds_buyer_idx on public.order_refunds (buyer_id, created_at desc);

alter table public.order_refunds enable row level security;

create table if not exists public.order_refund_items (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.order_refunds(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id),
  quantity numeric not null check (quantity > 0),
  amount numeric not null check (amount >= 0),
  unique (refund_id, order_item_id)
);

create index if not exists order_refund_items_item_idx on public.order_refund_items (order_item_id);

alter table public.order_refund_items enable row level security;

-- ---------------------------------------------------------------------------
-- El saldo a favor: un libro de movimientos. El saldo es la suma.
-- ---------------------------------------------------------------------------
create table if not exists public.buyer_credit_movements (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  -- Positivo abona, negativo descuenta.
  amount numeric not null check (amount <> 0),
  kind text not null check (kind in ('refund', 'redemption', 'release', 'reversal', 'adjustment')),
  refund_id uuid references public.order_refunds(id),
  order_id uuid references public.orders(id),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.buyer_credit_movements is
  'Movimientos del saldo a favor. Solo se escribe con apply_buyer_credit().';

create index if not exists buyer_credit_movements_buyer_idx
  on public.buyer_credit_movements (buyer_id, created_at desc);

alter table public.buyer_credit_movements enable row level security;

create or replace function public.buyer_credit_balance(p_buyer uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0) from public.buyer_credit_movements where buyer_id = p_buyer;
$$;

-- El único camino para mover saldo. El candado por comprador es lo que impide
-- que dos operaciones a la vez gasten el mismo saldo: sin él, ambas leerían el
-- mismo total antes de que la otra escribiera.
create or replace function public.apply_buyer_credit(
  p_buyer uuid,
  p_amount numeric,
  p_kind text,
  p_refund uuid default null,
  p_order uuid default null,
  p_notes text default null,
  p_by uuid default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  saldo numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('buyer_credit:' || p_buyer::text, 0));

  saldo := public.buyer_credit_balance(p_buyer);

  if saldo + p_amount < 0 then
    raise exception 'SALDO_INSUFICIENTE' using errcode = 'P0001';
  end if;

  insert into public.buyer_credit_movements (buyer_id, amount, kind, refund_id, order_id, notes, created_by)
  values (p_buyer, p_amount, p_kind, p_refund, p_order, p_notes, p_by);

  return saldo + p_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lo que se le descuenta a la tienda.
-- ---------------------------------------------------------------------------
create table if not exists public.store_charges (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  store_order_id uuid references public.store_orders(id),
  refund_id uuid not null unique references public.order_refunds(id),
  amount numeric not null check (amount > 0),
  created_at timestamptz not null default now(),

  -- Anular no borra: queda el rastro de que existió y por qué se quitó.
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_notes text
);

comment on table public.store_charges is
  'Descuentos a una tienda por devoluciones que asume. Se restan en su siguiente dispersión.';

create index if not exists store_charges_store_idx on public.store_charges (store_id) where voided_at is null;

alter table public.store_charges enable row level security;

-- Un descuento entra a la liquidación como una línea negativa. Así el pedido se
-- sigue viendo pagado completo y el descuento aparte, con su propio rastro, en
-- vez de un pedido «pagado por menos» sin explicación.
alter table public.payout_items alter column store_order_id drop not null;

alter table public.payout_items
  add column if not exists store_charge_id uuid references public.store_charges(id);

-- Un descuento se aplica una sola vez. Cancelar una liquidación borra sus
-- líneas, y con eso el descuento vuelve a quedar pendiente.
create unique index if not exists payout_items_store_charge_unico
  on public.payout_items (store_charge_id)
  where store_charge_id is not null;

alter table public.payout_items drop constraint if exists payout_items_amount_check;
alter table public.payout_items add constraint payout_items_amount_check check (
  (store_charge_id is null and store_order_id is not null and amount > 0)
  or (store_charge_id is not null and store_order_id is null and amount < 0)
);

-- ---------------------------------------------------------------------------
-- Crear la devolución: todo o nada.
--
-- El servidor calcula los montos (lib/pqrs/refund-amount.ts) y acá se guardan,
-- se abona el saldo y se anota el descuento a la tienda en una transacción.
-- Lo que sí se vuelve a comprobar acá, con el pedido bloqueado, es que no se
-- devuelva más de lo que se pagó ni más unidades de las que se pidieron: son
-- las dos cosas que dos aprobaciones simultáneas podrían romper.
-- ---------------------------------------------------------------------------
create or replace function public.create_order_refund(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pqrs uuid := (p->>'pqrs_id')::uuid;
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
  -- Reintento de la misma aprobación: se devuelve la que ya existe.
  select id into v_id from public.order_refunds where pqrs_id = v_pqrs;
  if found then
    return v_id;
  end if;

  select total, payment_status::text into v_order_total, v_payment
    from public.orders where id = v_order for update;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_payment is distinct from 'approved' then
    raise exception 'PEDIDO_SIN_PAGO' using errcode = 'P0001';
  end if;

  -- Otra aprobación pudo entrar mientras se esperaba el candado.
  select id into v_id from public.order_refunds where pqrs_id = v_pqrs;
  if found then
    return v_id;
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
    pqrs_id, order_id, store_order_id, store_id, buyer_id, scope,
    products_amount, service_commission_amount, platform_commission_amount,
    messages_amount, delivery_amount, total_amount, liable, created_by
  ) values (
    v_pqrs, v_order, nullif(p->>'store_order_id', '')::uuid, (p->>'store_id')::uuid, v_buyer, p->>'scope',
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

  -- La tienda solo asume el valor de sus productos, nunca las comisiones.
  if p->>'liable' = 'store' and v_products > 0 then
    insert into public.store_charges (store_id, store_order_id, refund_id, amount)
    values ((p->>'store_id')::uuid, nullif(p->>'store_order_id', '')::uuid, v_id, v_products);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- La excepción en dinero: se le quita el saldo y queda un reembolso por pagar.
-- Falla si el comprador ya usó ese saldo.
-- ---------------------------------------------------------------------------
create or replace function public.refund_to_money(p_refund uuid, p_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.order_refunds%rowtype;
begin
  select * into r from public.order_refunds where id = p_refund for update;

  if not found then
    raise exception 'DEVOLUCION_NO_EXISTE' using errcode = 'P0001';
  end if;
  if r.method <> 'credit' or r.status <> 'credited' then
    raise exception 'DEVOLUCION_YA_EN_DINERO' using errcode = 'P0001';
  end if;

  perform public.apply_buyer_credit(
    r.buyer_id, -r.total_amount, 'reversal', r.id, r.order_id,
    'El saldo se cambia por un reembolso en dinero.', p_by
  );

  update public.order_refunds set method = 'money', status = 'money_pending' where id = p_refund;
end;
$$;

-- ---------------------------------------------------------------------------
-- Quitarle el descuento a la tienda: lo asume MercaMesa. Solo mientras el
-- descuento no haya entrado a una liquidación.
-- ---------------------------------------------------------------------------
create or replace function public.void_store_charge(p_refund uuid, p_by uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.store_charges%rowtype;
begin
  select * into c from public.store_charges where refund_id = p_refund for update;

  if not found or c.voided_at is not null then
    raise exception 'SIN_DESCUENTO_VIGENTE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.payout_items where store_charge_id = c.id) then
    raise exception 'DESCUENTO_YA_LIQUIDADO' using errcode = 'P0001';
  end if;

  update public.store_charges
     set voided_at = now(), voided_by = p_by, void_notes = p_notes
   where id = c.id;

  update public.order_refunds set liable = 'platform' where id = p_refund;
end;
$$;

-- Solo el servidor (service role) llama estas funciones.
revoke all on function public.buyer_credit_balance(uuid) from public, anon, authenticated;
revoke all on function public.apply_buyer_credit(uuid, numeric, text, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_order_refund(jsonb) from public, anon, authenticated;
revoke all on function public.refund_to_money(uuid, uuid) from public, anon, authenticated;
revoke all on function public.void_store_charge(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.buyer_credit_balance(uuid) to service_role;
grant execute on function public.apply_buyer_credit(uuid, numeric, text, uuid, uuid, text, uuid) to service_role;
grant execute on function public.create_order_refund(jsonb) to service_role;
grant execute on function public.refund_to_money(uuid, uuid) to service_role;
grant execute on function public.void_store_charge(uuid, uuid, text) to service_role;
