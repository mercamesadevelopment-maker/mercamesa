-- La vitrina pública de productos, como una sola tabla plana.
--
-- `/sections/products` y `/stores/[slug]` traían TODOS los productos y
-- filtraban, buscaban, ordenaban y paginaban en el navegador. Con 3.746
-- productos de tienda eso son ~4,3 MB por visita y, peor, PostgREST corta en
-- 1.000 filas sin avisar: el catálogo público llevaba tiempo escondiendo 2.746
-- productos y la tienda más grande (2.233 productos) mostraba menos de la mitad
-- de su inventario.
--
-- Para paginar contra el servidor hay que poder ORDENAR contra el servidor, y
-- ahí está el motivo de esta vista: el nombre del producto vive en
-- `catalog_products`, y PostgREST no ordena el nivel superior por una columna
-- embebida (`order` con `referencedTable` ordena las filas embebidas, no las de
-- arriba). Con la vista, `product_name` es una columna más y el orden A-Z que la
-- página ya ofrecía sigue funcionando.
--
-- Solo lleva las columnas que pinta la tarjeta de producto. Es a propósito: el
-- `select('*')` que había dejaba salir `wholesale_price`, `stock` interno y
-- `code` de cada producto hacia cualquiera que llamara la ruta sin sesión.

create or replace view public.vitrina_productos as
select
  sp.id,
  sp.store_id,
  sp.price_per_unit,
  sp.stock,
  sp.is_featured,
  sp.featured_at,
  cp.name          as product_name,
  -- Minúscula y sin tildes, calculada por la base. La usa la búsqueda para que
  -- "platano" siga encontrando "plátano": 661 de los 3.588 nombres llevan tilde.
  cp.search_text   as product_search_text,
  cp.image_url     as product_image_url,
  c.name           as category_name,
  s.name           as store_name,
  s.slug           as store_slug,
  s.marketplace_id,
  m.name           as marketplace_name,
  mu.abbreviation  as unit_abbreviation
from public.store_products sp
join public.catalog_products cp on cp.id = sp.catalog_product_id
left join public.categories c on c.id = cp.category_id
join public.stores s on s.id = sp.store_id
left join public.marketplaces m on m.id = s.marketplace_id
left join public.measurement_units mu on mu.id = sp.unit_id
-- Las dos condiciones que definen "estar en la vitrina". Estaban sueltas en la
-- ruta; acá quedan en la definición, que es lo que impide que una consulta nueva
-- se olvide de una de ellas y publique lo que no debe.
where sp.is_active
  and s.is_active;

comment on view public.vitrina_productos is
  'Productos publicados de tiendas activas, aplanados para poder buscar, ordenar y paginar contra el servidor. Solo columnas públicas: no expone precio mayorista ni código interno.';

grant select on public.vitrina_productos to anon, authenticated;

-- Las categorías que de verdad tienen productos en la vitrina.
--
-- El carrusel de categorías las sacaba de los productos ya cargados. Al paginar
-- solo vería las de la página actual, así que necesita su propia fuente. No
-- sirve la lista completa de `categories`: mostraría categorías vacías que al
-- tocarlas no devuelven nada.
create or replace function public.vitrina_categorias(p_store_id uuid default null)
returns table (name text, total bigint)
language sql
stable
set search_path = ''
as $$
  select v.category_name, count(*)
  from public.vitrina_productos v
  where v.category_name is not null
    and (p_store_id is null or v.store_id = p_store_id)
  group by v.category_name
  order by v.category_name;
$$;

comment on function public.vitrina_categorias(uuid) is
  'Categorías con productos publicados, para el carrusel de la vitrina. Con p_store_id, las de esa tienda.';

grant execute on function public.vitrina_categorias(uuid) to anon, authenticated;
