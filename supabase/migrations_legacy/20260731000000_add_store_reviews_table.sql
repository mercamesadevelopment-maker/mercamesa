create table public.store_reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  buyer_id uuid not null references profiles(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, buyer_id)
);

create index store_reviews_store_id_idx on public.store_reviews (store_id, created_at desc);

alter table public.store_reviews enable row level security;

create policy "store_reviews_select_all" on public.store_reviews for select using (true);
create policy "store_reviews_insert_own" on public.store_reviews for insert to authenticated with check (buyer_id = auth.uid());
create policy "store_reviews_update_own" on public.store_reviews for update to authenticated using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "store_reviews_delete_own" on public.store_reviews for delete to authenticated using (buyer_id = auth.uid());

-- Mantiene stores.reputation_score sincronizado con el promedio real de reseñas,
-- para no tener que tocar ningún lugar del código que ya lee esa columna.
create or replace function public.update_store_reputation() returns trigger
language plpgsql security definer as $$
begin
  update public.stores
  set reputation_score = coalesce(
    (select round(avg(stars)::numeric, 2) from public.store_reviews where store_id = coalesce(new.store_id, old.store_id)),
    5.0
  )
  where id = coalesce(new.store_id, old.store_id);
  return null;
end;
$$;

create trigger store_reviews_reputation_trigger
after insert or update or delete on public.store_reviews
for each row execute function public.update_store_reputation();
