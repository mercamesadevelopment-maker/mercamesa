-- Modelo de precios de Mercamesa: comisiones parametrizables + domicilio real.
--
-- Hasta ahora la plataforma cobraba un domicilio fijo de $5.000 y ninguna
-- comisión. El costo real de Pibox está entre $10.200 y $17.700, así que cada
-- pedido perdía plata. El cliente definió este modelo:
--
--   productos                                    50.000
--   + comisión de servicio 2,99%                  1.495
--   + mensajes (6 × $120)                           720
--   = VALOR NETO DE COMPRA                       52.215
--   + comisión de plataforma 15% (sobre el neto)  7.832
--   + domicilio (valor real de Pibox)            11.161
--   = TOTAL A PAGAR                              71.208
--
-- Las comisiones se componen: el 15% se aplica sobre un neto que ya incluye el
-- 2,99% y los mensajes. El tendero recibe el 100% del valor de sus productos,
-- así que `store_orders.subtotal` y `order_items.total_price` no cambian.

-- ── Tarifas vigentes ────────────────────────────────────────────────────────
--
-- Append-only, igual que `order_min_price_history`: el valor vigente es la fila
-- más reciente. Se escoge histórico y no fila única porque un cambio de tarifa
-- tiene que quedar auditado (quién y cuándo) y los pedidos viejos deben poder
-- reconstruirse con las tarifas que realmente se les aplicaron.

create table if not exists public.pricing_settings_history (
  id uuid primary key default gen_random_uuid(),

  -- Comisión que se suma al valor de los productos (0.0299 = 2,99%)
  service_commission_rate numeric(6,4) not null,

  -- Mensajes de seguimiento que se le cobran al comprador en todo pedido
  message_unit_price numeric(10,2) not null,
  messages_per_order integer not null,

  -- Comisión de plataforma, sobre el valor NETO de compra (0.1500 = 15%)
  platform_commission_rate numeric(6,4) not null,

  -- Códigos de los productos de Siigo con los que se facturan el domicilio y la
  -- comisión de plataforma. Van acá y no en variables de entorno para que el
  -- administrador pueda cambiarlos sin un despliegue.
  siigo_delivery_product_code text not null,
  siigo_platform_product_code text not null,

  notes text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint pricing_rates_sane check (
    service_commission_rate between 0 and 1
    and platform_commission_rate between 0 and 1
    and message_unit_price >= 0
    and messages_per_order >= 0
  )
);

comment on table public.pricing_settings_history is
  'Tarifas y comisiones vigentes. La fila más reciente es la que aplica.';

create index if not exists idx_pricing_settings_history_created_at
  on public.pricing_settings_history (created_at desc);

alter table public.pricing_settings_history enable row level security;

-- Lectura para cualquier usuario autenticado: el carrito necesita las tarifas
-- para mostrar el desglose antes de pagar.
drop policy if exists pricing_settings_select on public.pricing_settings_history;
create policy pricing_settings_select
  on public.pricing_settings_history for select
  to authenticated
  using (true);

-- Escritura solo con permiso de parametrización, igual que el resto de catálogos.
drop policy if exists pricing_settings_insert on public.pricing_settings_history;
create policy pricing_settings_insert
  on public.pricing_settings_history for insert
  to authenticated
  with check (public.has_permission('system-settings', 'create'));

-- Valores acordados con el cliente (hoja "MOMENTO 1" del Excel).
insert into public.pricing_settings_history (
  service_commission_rate,
  message_unit_price,
  messages_per_order,
  platform_commission_rate,
  siigo_delivery_product_code,
  siigo_platform_product_code,
  notes
)
select 0.0299, 120, 6, 0.1500, 'DOMICILIO', 'SERVICIOMERCAMESA',
       'Modelo inicial acordado con el cliente'
where not exists (select 1 from public.pricing_settings_history);

-- ── Desglose congelado en cada pedido ───────────────────────────────────────
--
-- Sin esto, cambiar una tarifa reescribiría la historia: la factura de un pedido
-- viejo se recalcularía con las tarifas nuevas y dejaría de cuadrar contra lo que
-- el comprador pagó.

alter table public.orders
  add column if not exists service_commission_amount numeric(12,2) not null default 0,
  add column if not exists messages_amount numeric(12,2) not null default 0,
  add column if not exists platform_commission_amount numeric(12,2) not null default 0,
  add column if not exists pricing_settings_id uuid references public.pricing_settings_history(id);

comment on column public.orders.service_commission_amount is
  'Comisión de servicio (2,99%) cobrada al comprador. Incluida en total.';
comment on column public.orders.messages_amount is
  'Mensajes de seguimiento cobrados al comprador. Incluidos en total.';
comment on column public.orders.platform_commission_amount is
  'Comisión de plataforma (15% del neto). Incluida en total.';
comment on column public.orders.pricing_settings_id is
  'Tarifas que se le aplicaron a este pedido. Null en pedidos anteriores al modelo.';

-- Invariante:
--   total = subtotal
--         + service_commission_amount + messages_amount + platform_commission_amount
--         + delivery_fee - discount
