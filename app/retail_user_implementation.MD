create table public.stores (
  id uuid not null default extensions.uuid_generate_v4 (),
  marketplace_id uuid not null,
  owner_id uuid not null,
  name text not null,
  slug text not null,
  description text null,
  logo_url text null,
  cover_image_url text null,
  phone text null,
  whatsapp text null,
  contact_name text null,
  contact_email text null,
  reputation_score numeric(3, 2) null default 5.00,
  is_active boolean not null default true,
  is_verified boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint stores_pkey primary key (id),
  constraint stores_slug_key unique (slug),
  constraint stores_marketplace_id_fkey foreign KEY (marketplace_id) references marketplaces (id) on delete RESTRICT,
  constraint stores_owner_id_fkey foreign KEY (owner_id) references profiles (id) on delete RESTRICT
) TABLESPACE pg_default;

create table public.store_products (
  id uuid not null default extensions.uuid_generate_v4 (),
  store_id uuid not null,
  catalog_product_id uuid not null,
  unit_id uuid not null,
  price_per_unit numeric(12, 2) not null,
  stock numeric(12, 3) not null default 0,
  min_order_qty numeric(12, 3) not null default 1,
  wholesale_min_qty numeric(12, 3) null,
  wholesale_price numeric(12, 2) null,
  is_active boolean not null default true,
  last_price_update timestamp with time zone null default now(),
  updated_by_bot boolean not null default false,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint store_products_pkey primary key (id),
  constraint store_products_store_id_catalog_product_id_key unique (store_id, catalog_product_id),
  constraint store_products_catalog_product_id_fkey foreign KEY (catalog_product_id) references catalog_products (id) on delete RESTRICT,
  constraint store_products_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE,
  constraint store_products_unit_id_fkey foreign KEY (unit_id) references measurement_units (id)
) TABLESPACE pg_default;

create table public.store_orders (
  id uuid not null default extensions.uuid_generate_v4 (),
  order_id uuid not null,
  store_id uuid not null,
  status public.order_status not null default 'pending'::order_status,
  subtotal numeric(14, 2) not null default 0,
  has_refrigerated boolean not null default false,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint store_orders_pkey primary key (id),
  constraint store_orders_order_id_fkey foreign KEY (order_id) references orders (id) on delete CASCADE,
  constraint store_orders_store_id_fkey foreign KEY (store_id) references stores (id)
) TABLESPACE pg_default;

create table public.store_offers (
  id uuid not null default extensions.uuid_generate_v4 (),
  store_product_id uuid not null,
  discount_pct numeric(5, 2) null,
  special_price numeric(12, 2) null,
  label text null,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint store_offers_pkey primary key (id),
  constraint store_offers_store_product_id_fkey foreign KEY (store_product_id) references store_products (id) on delete CASCADE
) TABLESPACE pg_default;

create table public.store_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  store_id uuid not null,
  user_id uuid not null,
  role text not null,
  invited_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint store_members_pkey primary key (id),
  constraint store_members_store_id_user_id_key unique (store_id, user_id),
  constraint store_members_invited_by_fkey foreign KEY (invited_by) references profiles (id),
  constraint store_members_store_id_fkey foreign KEY (store_id) references stores (id),
  constraint store_members_user_id_fkey foreign KEY (user_id) references profiles (id)
) TABLESPACE pg_default;

create table public.orders (
  id uuid not null default extensions.uuid_generate_v4 (),
  buyer_id uuid not null,
  delivery_address_id uuid null,
  status public.order_status not null default 'pending'::order_status,
  buyer_type public.buyer_type not null default 'retail'::buyer_type,
  subtotal numeric(14, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  address_change_fee numeric(10, 2) not null default 0,
  discount numeric(10, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  client_idempotency_key character varying(255) null,
  payment_status public.payment_status not null default 'pending'::payment_status,
  constraint orders_pkey primary key (id),
  constraint orders_client_idempotency_key_key unique (client_idempotency_key),
  constraint orders_buyer_id_fkey foreign KEY (buyer_id) references profiles (id),
  constraint orders_delivery_address_id_fkey foreign KEY (delivery_address_id) references delivery_addresses (id)
) TABLESPACE pg_default;

create index IF not exists idx_orders_payment_status on public.orders using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_orders_client_idempotency_key on public.orders using btree (client_idempotency_key) TABLESPACE pg_default;

create table public.order_items (
  id uuid not null default extensions.uuid_generate_v4 (),
  order_id uuid not null,
  store_product_id uuid not null,
  catalog_name text not null,
  unit_name text not null,
  quantity numeric(12, 3) not null,
  unit_price numeric(12, 2) not null,
  total_price numeric(14, 2) not null,
  created_at timestamp with time zone not null default now(),
  constraint order_items_pkey primary key (id),
  constraint order_items_order_id_fkey foreign KEY (order_id) references orders (id) on delete CASCADE,
  constraint order_items_store_product_id_fkey foreign KEY (store_product_id) references store_products (id)
) TABLESPACE pg_default;

create table public.marketplaces (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  slug text not null,
  description text null,
  address text null,
  city text not null default 'Medellín'::text,
  department text not null default 'Antioquia'::text,
  latitude numeric(10, 7) null,
  longitude numeric(10, 7) null,
  cover_image_url text null,
  logo_url text null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint marketplaces_pkey primary key (id),
  constraint marketplaces_slug_key unique (slug),
  constraint marketplaces_created_by_fkey foreign KEY (created_by) references profiles (id)
) TABLESPACE pg_default;

create table public.marketplace_members (
  id uuid not null default extensions.uuid_generate_v4 (),
  marketplace_id uuid not null,
  user_id uuid not null,
  role text not null,
  invited_by uuid null,
  created_at timestamp with time zone null default now(),
  constraint marketplace_members_pkey primary key (id),
  constraint marketplace_members_marketplace_id_user_id_key unique (marketplace_id, user_id),
  constraint marketplace_members_invited_by_fkey foreign KEY (invited_by) references profiles (id),
  constraint marketplace_members_marketplace_id_fkey foreign KEY (marketplace_id) references marketplaces (id),
  constraint marketplace_members_user_id_fkey foreign KEY (user_id) references profiles (id)
) TABLESPACE pg_default;

este enum: order_status: pending, confirmed, paid, packing, at_collection, dispatched, delivered, cancelled, returned