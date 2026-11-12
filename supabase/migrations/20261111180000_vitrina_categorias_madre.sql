-- La vitrina por categoría y subcategoría.
--
-- Desde las categorías comerciales nuevas del cliente (2026-11-11), cada producto
-- del catálogo cuelga de una SUBcategoría («Frutas y verduras > Frutas frescas»).
-- La vitrina agrupaba por la categoría directa del producto, así que el carrusel
-- mostraba las 68 subcategorías revueltas y nunca las 15 categorías.
--
-- - `vitrina_productos.parent_category_name`: la categoría madre. Si el producto
--   cuelga directo de una categoría sin madre, es esa misma.
-- - `vitrina_arbol_categorias`: categorías y subcategorías con productos
--   publicados, para el carrusel de dos niveles.

-- La columna nueva va al final: `create or replace view` solo deja agregar al
-- final. Conserva los permisos, pero NO las opciones: `security_invoker` se
-- repite acá o la vista dejaría de respetar la RLS de quien consulta.
create or replace view public.vitrina_productos with (security_invoker = true) as
 select sp.id,
    sp.store_id,
    sp.price_per_unit,
    sp.stock,
    sp.is_featured,
    sp.featured_at,
    cp.name as product_name,
    cp.search_text as product_search_text,
    cp.image_url as product_image_url,
    c.name as category_name,
    s.name as store_name,
    s.slug as store_slug,
    s.marketplace_id,
    m.name as marketplace_name,
    mu.abbreviation as unit_abbreviation,
    (exists ( select 1
           from store_offers o
          where o.store_product_id = sp.id and o.status = 'active'::text and o.starts_at <= now() and (o.ends_at is null or o.ends_at >= now()))) as has_active_offer,
    coalesce(pc.name, c.name) as parent_category_name
   from store_products sp
     join catalog_products cp on cp.id = sp.catalog_product_id
     left join categories c on c.id = cp.category_id
     left join categories pc on pc.id = c.parent_id
     join stores s on s.id = sp.store_id
     left join marketplaces m on m.id = s.marketplace_id
     left join measurement_units mu on mu.id = sp.unit_id
  where sp.is_active and s.is_active;

-- Categorías y subcategorías con productos publicados. `subcategoria` es nula
-- para los productos que cuelgan directo de una categoría.
create function public.vitrina_arbol_categorias(p_store_id uuid default null)
returns table (categoria text, subcategoria text, total bigint)
language sql
stable
set search_path = ''
as $$
  select v.parent_category_name,
         case when v.category_name is distinct from v.parent_category_name then v.category_name end,
         count(*)
  from public.vitrina_productos v
  where v.parent_category_name is not null
    and (p_store_id is null or v.store_id = p_store_id)
  group by 1, 2
  order by 1, 2;
$$;

comment on function public.vitrina_arbol_categorias(uuid) is
  'Categorías y subcategorías con productos publicados, para el carrusel de dos niveles de la vitrina. Con p_store_id, las de esa tienda.';

grant execute on function public.vitrina_arbol_categorias(uuid) to anon, authenticated, service_role;
