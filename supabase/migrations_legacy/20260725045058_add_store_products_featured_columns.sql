alter table public.store_products
  add column is_featured boolean not null default false,
  add column featured_at timestamptz;
