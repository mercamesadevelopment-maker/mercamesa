-- Los productos en oferta primero en la vitrina.
--
-- La vitrina se pagina contra el servidor (20 por página), así que el orden
-- tiene que salir de la base: reordenar en la página solo acomodaría los 20 que
-- ya llegaron, y una oferta de la página 3 seguiría en la página 3.
--
-- `has_active_offer` usa la misma regla que decide si al comprador se le cobra
-- la oferta (`resolveOfferPrices`): activa, ya empezada y sin terminar. Como la
-- vista se evalúa en cada consulta, una oferta que vence deja de subir sola.
--
-- La columna va al final: `create or replace view` no deja moverlas.
create or replace view public.vitrina_productos as
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
    exists (
      select 1
        from public.store_offers o
       where o.store_product_id = sp.id
         and o.status = 'active'
         and o.starts_at <= now()
         and (o.ends_at is null or o.ends_at >= now())
    ) as has_active_offer
   from public.store_products sp
     join public.catalog_products cp on cp.id = sp.catalog_product_id
     left join public.categories c on c.id = cp.category_id
     join public.stores s on s.id = sp.store_id
     left join public.marketplaces m on m.id = s.marketplace_id
     left join public.measurement_units mu on mu.id = sp.unit_id
  where sp.is_active and s.is_active;
