-- Varias categorías por tienda, y si vende al por mayor, al detal o ambas.
--
-- `stores.category_id` es UNA columna: una tienda de plaza que vende carnes y
-- lácteos tenía que elegir una y perder la otra.
--
-- Y el catálogo de categorías estaba haciendo dos trabajos a la vez: «Mayorista»
-- y «Minorista» existen como categorías, y 2 de las 12 tiendas usan «Mayorista»
-- como la suya. Por eso una tienda mayorista de carnes no podía decir que vende
-- carnes: el campo ya estaba ocupado diciendo a quién le vende. Son dos
-- preguntas distintas y a partir de acá viven en dos lugares distintos.
--
-- `profiles.buyer_type` ya distingue retail/wholesale del lado del COMPRADOR, y
-- `store_products.wholesale_price` ya existe por producto; lo único que faltaba
-- era decirlo de la tienda.

-- ---------------------------------------------------------------------------
-- 1. La tabla de unión
--
-- Misma forma que `store_favorites`: dos claves foráneas y un único compuesto.
-- ---------------------------------------------------------------------------
create table if not exists public.store_category_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid not null references public.store_categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (store_id, category_id)
);

create index if not exists store_category_links_store_id_idx on public.store_category_links (store_id);
create index if not exists store_category_links_category_id_idx on public.store_category_links (category_id);

-- Sin RLS, igual que `stores` y `store_categories`, que tampoco la tienen: en
-- este conjunto de tablas la protección está en la capa de rutas. Activarla solo
-- acá la volvería la única pieza con reglas propias y dejaría a la página
-- pública de la tienda —que consulta sin sesión— sin poder leer las categorías.
-- Si algún día se activa RLS en `stores`, esta entra en el mismo paso.


-- ---------------------------------------------------------------------------
-- 2. Mayorista y minorista
--
-- Dos booleanos y no el enum `buyer_type` que ya existe, precisamente porque una
-- tienda puede ser LAS DOS y un enum obliga a elegir. Es lo normal en la plaza:
-- el mismo local vende un bulto y vende una libra.
-- ---------------------------------------------------------------------------
alter table public.stores
  add column if not exists is_wholesale boolean not null default false,
  add column if not exists is_retail    boolean not null default true;

comment on column public.stores.is_wholesale is 'La tienda vende al por mayor. Independiente de is_retail: puede ser ambas.';
comment on column public.stores.is_retail is 'La tienda vende al detal. Independiente de is_wholesale: puede ser ambas.';


-- ---------------------------------------------------------------------------
-- 3. Migrar lo que ya hay
-- ---------------------------------------------------------------------------

-- a) Las tiendas cuya «categoría» era en realidad su forma de vender. Sin esto
--    perderían el dato al desactivar esas categorías.
update public.stores s
set is_wholesale = true
from public.store_categories c
where s.category_id = c.id and c.slug = 'mayorista';

update public.stores s
set is_retail = true
from public.store_categories c
where s.category_id = c.id and c.slug = 'minorista';

-- b) El resto de categorías pasan a la tabla nueva tal cual. Se excluyen las dos
--    de arriba: ya quedaron registradas como lo que son.
insert into public.store_category_links (store_id, category_id)
select s.id, s.category_id
from public.stores s
join public.store_categories c on c.id = s.category_id
where s.category_id is not null
  and c.slug not in ('mayorista', 'minorista')
on conflict (store_id, category_id) do nothing;

-- c) Se desactivan, no se borran: dejan de aparecer en el desplegable, pero si
--    algo salió mal los nombres y los ids siguen ahí.
update public.store_categories
set is_active = false
where slug in ('mayorista', 'minorista');


-- ---------------------------------------------------------------------------
-- 4. `stores.category_id` queda sin uso
--
-- No se borra la columna todavía: no hay forma de estar seguro de que nada
-- externo a este repo la lea. Pero a partir de acá NADIE la escribe ni la lee —
-- la fuente de verdad es `store_category_links`. Si la ves usada en código
-- nuevo, es un error.
-- ---------------------------------------------------------------------------
comment on column public.stores.category_id is
  'OBSOLETA desde 2026-09-23: usar store_category_links. Se conserva solo por si algún consumidor externo la lee; no la escribas.';
