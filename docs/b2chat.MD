Debo entregarle a unos desarrolladores la URL de las apis disponibles, documentación técnica de integración, credenciales o mecanismos de autenticación, endpoints disponibles para consulta e información relacionada con inventarios, productos, pedidos y disponibilidad, las tablas que vendrían a acolación serían estas:
create table public.catalog_products (
  id uuid not null default extensions.uuid_generate_v4 (),
  category_id uuid null,
  default_unit_id uuid null,
  name text not null,
  slug text not null,
  description text null,
  image_url text null,
  is_ancestral_food boolean not null default false,
  is_medicinal_plant boolean not null default false,
  is_non_food boolean not null default false,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  dane_unit_code text null,
  dane_unit_name text null,
  constraint catalog_products_pkey primary key (id),
  constraint catalog_products_slug_key unique (slug),
  constraint catalog_products_category_id_fkey foreign KEY (category_id) references categories (id) on delete set null,
  constraint catalog_products_created_by_fkey foreign KEY (created_by) references profiles (id),
  constraint catalog_products_default_unit_id_fkey foreign KEY (default_unit_id) references measurement_units (id)
) TABLESPACE pg_default;

create index IF not exists idx_catalog_products_category_id on public.catalog_products using btree (category_id) TABLESPACE pg_default;

create index IF not exists idx_catalog_products_default_unit_id on public.catalog_products using btree (default_unit_id) TABLESPACE pg_default;

create index IF not exists idx_catalog_products_is_active on public.catalog_products using btree (is_active) TABLESPACE pg_default;

create table public.categories (
  id uuid not null default extensions.uuid_generate_v4 (),
  parent_id uuid null,
  name text not null,
  slug text not null,
  description text null,
  image_url text null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint categories_pkey primary key (id),
  constraint categories_slug_key unique (slug),
  constraint categories_parent_id_fkey foreign KEY (parent_id) references categories (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_categories_parent_id on public.categories using btree (parent_id) TABLESPACE pg_default;

create table public.clients (
  id uuid not null default extensions.uuid_generate_v4 (),
  profile_id uuid null,
  document_number text not null,
  full_name text not null,
  email text null,
  phone text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint clients_pkey primary key (id),
  constraint clients_document_number_key unique (document_number),
  constraint clients_profile_id_fkey foreign KEY (profile_id) references profiles (id) on delete set null
) TABLESPACE pg_default;

create index IF not exists idx_clients_document_number on public.clients using btree (document_number) TABLESPACE pg_default;

create index IF not exists idx_clients_email on public.clients using btree (email) TABLESPACE pg_default;

create table public.measurement_units (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  abbreviation text not null,
  is_active boolean not null default true,
  constraint measurement_units_pkey primary key (id)
) TABLESPACE pg_default;

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

create table public.orders (
  id uuid not null default extensions.uuid_generate_v4 (),
  buyer_id uuid null,
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
  client_id uuid null,
  consecutive integer generated by default as identity not null,
  constraint orders_pkey primary key (id),
  constraint orders_client_idempotency_key_key unique (client_idempotency_key),
  constraint orders_buyer_id_fkey foreign KEY (buyer_id) references profiles (id),
  constraint orders_client_id_fkey foreign KEY (client_id) references clients (id) on delete set null,
  constraint orders_delivery_address_id_fkey foreign KEY (delivery_address_id) references delivery_addresses (id)
) TABLESPACE pg_default;

create index IF not exists idx_orders_payment_status on public.orders using btree (payment_status) TABLESPACE pg_default;

create index IF not exists idx_orders_client_idempotency_key on public.orders using btree (client_idempotency_key) TABLESPACE pg_default;

create table public.payments (
  id uuid not null default gen_random_uuid (),
  order_id uuid not null,
  provider character varying(50) not null default 'zonapagos'::character varying,
  provider_payment_id character varying(255) null,
  str_id_pago character varying(255) not null,
  status public.payment_status not null default 'pending'::payment_status,
  amount numeric(12, 2) not null,
  payment_url text null,
  callback_response jsonb null,
  created_at timestamp without time zone not null default now(),
  updated_at timestamp without time zone not null default now(),
  payment_method text null,
  payment_method_label text null,
  constraint payments_pkey primary key (id),
  constraint fk_payments_order foreign KEY (order_id) references orders (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_payments_order_id on public.payments using btree (order_id) TABLESPACE pg_default;

create index IF not exists idx_payments_status on public.payments using btree (status) TABLESPACE pg_default;

create index IF not exists idx_payments_provider_payment_id on public.payments using btree (provider_payment_id) TABLESPACE pg_default;

create index IF not exists idx_payments_str_id_pago on public.payments using btree (str_id_pago) TABLESPACE pg_default;


create table public.product_stock_movements (
  id uuid not null default gen_random_uuid (),
  store_product_id uuid not null,
  store_id uuid not null,
  type public.stock_movement_type not null,
  quantity numeric(12, 3) not null,
  reference_id uuid null,
  reference_type text null,
  registered_by uuid null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  notes text null,
  constraint product_stock_movements_pkey primary key (id),
  constraint product_stock_movements_registered_by_fkey foreign KEY (registered_by) references profiles (id) on delete set null,
  constraint product_stock_movements_store_id_fkey foreign KEY (store_id) references stores (id) on delete CASCADE,
  constraint product_stock_movements_store_product_id_fkey foreign KEY (store_product_id) references store_products (id) on delete CASCADE
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

create table public.store_order_status_history (
  id uuid not null default gen_random_uuid (),
  store_order_id uuid not null,
  status public.order_status not null,
  notes text null,
  changed_by uuid null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint store_order_status_history_pkey primary key (id),
  constraint store_order_status_history_changed_by_fkey foreign KEY (changed_by) references profiles (id) on delete set null,
  constraint store_order_status_history_store_order_id_fkey foreign KEY (store_order_id) references store_orders (id) on delete CASCADE
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

create trigger trg_store_order_status_change
after INSERT
or
update OF status on store_orders for EACH row
execute FUNCTION fn_process_store_order_status_change ();

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

create table public.stores (
  id uuid not null default extensions.uuid_generate_v4 (),
  marketplace_id uuid not null,
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
  constraint stores_contact_email_unique unique (contact_email),
  constraint stores_slug_key unique (slug),
  constraint stores_marketplace_id_fkey foreign KEY (marketplace_id) references marketplaces (id) on delete RESTRICT
) TABLESPACE pg_default;