-- Facturación en Siigo al confirmarse el pago.
--
-- El pago se confirma en TRES Edge Functions distintas (zonapagos-sync,
-- zonapagos-sonda y zonapagos-pago-token), que duplican la misma lógica. No hay
-- un punto único en el código donde enganchar la facturación, pero sí en la
-- base: las tres terminan haciendo `update payments set status='approved'`.
--
-- Por eso el enganche es un trigger sobre `payments`. Además de cubrir las tres
-- rutas (y cualquiera futura), la guarda `is distinct from` hace el encolado
-- idempotente: hoy `sync` y `sonda` pueden confirmar el mismo pago casi a la vez,
-- y sin esto se emitirían dos facturas por el mismo pedido.

create table if not exists public.siigo_invoices (
  id uuid primary key default gen_random_uuid(),
  -- El unique es la pieza clave: un pedido, una factura. Pase lo que pase.
  order_id uuid not null unique references public.orders(id) on delete cascade,
  status text not null default 'pending',
  siigo_invoice_id text,
  siigo_number text,
  -- Si se transmitió a la DIAN. En las primeras pruebas va en false.
  stamped boolean not null default false,
  attempts int not null default 0,
  last_error text,
  -- Se guarda siempre lo enviado: cuando Siigo rechaza algo, el cuerpo exacto y
  -- el error crudo son lo único que permite entender por qué.
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint siigo_invoices_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

create index if not exists siigo_invoices_status_idx
  on public.siigo_invoices (status, attempts);

create or replace function public.set_siigo_invoices_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_siigo_invoices_updated_at on public.siigo_invoices;
create trigger set_siigo_invoices_updated_at
  before update on public.siigo_invoices
  for each row execute function public.set_siigo_invoices_updated_at();

-- El encolado no llama a Siigo: solo deja constancia. Un procesador aparte
-- (cron) hace la llamada. Así una caída de Siigo nunca afecta la confirmación
-- del pago del comprador, que es lo único que no se puede perder.
create or replace function public.enqueue_siigo_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.siigo_invoices (order_id)
  values (new.order_id)
  on conflict (order_id) do nothing;

  return new;
end;
$$;

drop trigger if exists siigo_invoice_on_payment_approved on public.payments;
create trigger siigo_invoice_on_payment_approved
  after update on public.payments
  for each row
  when (old.status is distinct from new.status and new.status = 'approved')
  execute function public.enqueue_siigo_invoice();

-- Un pago puede nacer ya aprobado (cobro con tarjeta tokenizada inserta la fila
-- en su estado final), así que el INSERT también tiene que encolar.
drop trigger if exists siigo_invoice_on_payment_inserted on public.payments;
create trigger siigo_invoice_on_payment_inserted
  after insert on public.payments
  for each row
  when (new.status = 'approved')
  execute function public.enqueue_siigo_invoice();

-- Cache del tercero ya creado en Siigo, para no buscarlo en cada factura.
alter table public.profiles
  add column if not exists siigo_customer_id text;

-- null = el producto nunca se ha subido a Siigo. Hoy 2.390 de 2.896 productos
-- comprables no existen allá, y `POST /v1/invoices` exige que el código exista.
alter table public.catalog_products
  add column if not exists siigo_synced_at timestamptz;

create index if not exists catalog_products_siigo_synced_at_idx
  on public.catalog_products (siigo_synced_at)
  where siigo_synced_at is null;

-- El tipo de identificación de la DIAN ("13" cédula, "31" NIT) es una
-- convención, no lógica: vive en el catálogo que el admin ya administra en
-- Parametrización, no escondido en el código.
alter table public.identification_types
  add column if not exists siigo_id_type text;

update public.identification_types set siigo_id_type = '13' where slug = 'cedula';
update public.identification_types set siigo_id_type = '22' where slug = 'cedula-extranjeria';
update public.identification_types set siigo_id_type = '41' where slug = 'pasaporte';
update public.identification_types set siigo_id_type = '31' where slug = 'nit';
update public.identification_types set siigo_id_type = '31' where slug = 'rut';

alter table public.siigo_invoices enable row level security;

-- Solo lectura, y solo para quien administra la parametrización del sistema.
-- La escritura la hace el procesador con service role, que salta RLS.
drop policy if exists "siigo_invoices_select_policy" on public.siigo_invoices;
create policy "siigo_invoices_select_policy" on public.siigo_invoices
  for select to authenticated
  using (public.has_permission('system-settings', 'read'));
