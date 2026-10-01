-- Notas crédito en Siigo.
--
-- Una devolución aprobada corrige una factura ya emitida, y en Colombia eso se
-- hace con una nota crédito. Esta es la cola: una fila por devolución, que un
-- trabajo periódico convierte en la nota crédito de Siigo.
--
-- Mismo diseño que `siigo_invoices` (migración 20260826180000), por lo mismo:
-- una caída de Siigo no puede frenar la devolución al comprador. El saldo a
-- favor se le acredita de inmediato; la nota crédito sale después y, si falla,
-- se reintenta.

create table if not exists public.siigo_credit_notes (
  id uuid primary key default gen_random_uuid(),
  -- Una nota por devolución: es la primera red contra notas duplicadas. La
  -- segunda es el `Idempotency-Key` con el que se envía.
  refund_id uuid not null unique references public.order_refunds(id) on delete cascade,
  status text not null default 'pending',
  siigo_credit_note_id text,
  siigo_number text,
  stamped boolean not null default false,
  attempts int not null default 0,
  last_error text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint siigo_credit_notes_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

comment on table public.siigo_credit_notes is
  'Cola de notas crédito de Siigo, una por devolución.';

create index if not exists siigo_credit_notes_status_idx
  on public.siigo_credit_notes (status, attempts);

alter table public.siigo_credit_notes enable row level security;

create or replace function public.set_siigo_credit_notes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_siigo_credit_notes_updated_at on public.siigo_credit_notes;
create trigger set_siigo_credit_notes_updated_at
  before update on public.siigo_credit_notes
  for each row execute function public.set_siigo_credit_notes_updated_at();

-- Se encola desde la base, como las facturas: las devoluciones se crean en una
-- función (`create_order_refund`) y este es el único punto por el que pasan todas.
create or replace function public.enqueue_siigo_credit_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.siigo_credit_notes (refund_id)
  values (new.id)
  on conflict (refund_id) do nothing;
  return new;
end;
$$;

drop trigger if exists siigo_credit_note_on_refund on public.order_refunds;
create trigger siigo_credit_note_on_refund
  after insert on public.order_refunds
  for each row execute function public.enqueue_siigo_credit_note();

revoke all on function public.enqueue_siigo_credit_note() from public, anon, authenticated;

-- El trabajo periódico, con el mismo mecanismo y secreto que el de facturas.
select cron.unschedule('siigo_credit_notes')
where exists (select 1 from cron.job where jobname = 'siigo_credit_notes');

select cron.schedule(
  'siigo_credit_notes',
  '*/5 * * * *',
  $$select public.call_app_cron('/api/siigo/credit-notes/process')$$
);
