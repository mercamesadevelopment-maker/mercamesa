create table public.buyer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'card',
  label text not null,
  brand text,
  last4 text,
  exp text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buyer_payment_methods_buyer_id_idx on public.buyer_payment_methods (buyer_id);

alter table public.buyer_payment_methods enable row level security;

create policy "Buyers manage their own payment methods"
  on public.buyer_payment_methods
  for all
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());
