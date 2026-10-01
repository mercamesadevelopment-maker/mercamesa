create table public.store_favorites (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, store_id)
);

create index store_favorites_buyer_id_idx on public.store_favorites (buyer_id);
create index store_favorites_store_id_idx on public.store_favorites (store_id);

alter table public.store_favorites enable row level security;

create policy "Buyers manage their own favorite stores"
  on public.store_favorites
  for all
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());
