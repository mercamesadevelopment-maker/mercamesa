-- Búsqueda tolerante a errores de ortografía.
--
-- El cliente quiere que «bino», «hagua» o «aros» encuentren vino, agua y arroz.
-- Son errores de sonido (b/v, h muda, s/z/c, ll/y, rr/r), y se resuelven con una
-- clave fonética: lo que suena igual da la misma clave. Para los errores de
-- tecleo («aguacte») queda una segunda red con trigramas (pg_trgm).
--
-- - `clave_fonetica(texto)`: la misma función que `phoneticKey` de
--   `lib/search/phonetic.ts`, con las reglas en el mismo orden. Se prueban con
--   los mismos casos (`phonetic.cases.ts` y `busqueda_tolerante.test.sql`).
-- - `catalog_products.search_phonetic`: la clave del nombre y la descripción.
-- - Índices de trigramas sobre `search_text` y `search_phonetic`, que también
--   sirven al `ilike '%…%'` que ya se usaba (el btree de antes no lo cubría).
-- - `vitrina_productos` suma `product_search_phonetic` y `catalog_product_id`.
-- - `buscar_productos_parecidos(texto)`: los productos del catálogo que más se
--   parecen, para cuando la búsqueda no encuentra nada.

create extension if not exists pg_trgm with schema extensions;

create function public.clave_fonetica(texto text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public, extensions
as $$
declare
  s text := lower(public.immutable_unaccent(coalesce(texto, '')));
begin
  s := regexp_replace(s, '[^a-z0-9]+', ' ', 'g');
  s := replace(s, 'ch', '_');                      -- la «ch» suena; se protege
  s := replace(s, 'h', '');                        -- la h es muda
  s := replace(s, 'qu', 'k');
  s := regexp_replace(s, 'c([ei])', 's\1', 'g');   -- ce, ci suenan s
  s := replace(s, 'c', 'k');                       -- ca, co, cu y ante consonante
  s := replace(s, 'z', 's');
  s := replace(s, 'v', 'b');
  s := replace(s, 'w', 'b');
  s := replace(s, 'll', 'y');
  s := regexp_replace(s, 'g([ei])', 'j\1', 'g');   -- ge, gi suenan j
  s := regexp_replace(s, 'gu([ei])', 'g\1', 'g');  -- gue, gui suenan ge, gi
  s := regexp_replace(s, '(.)\1+', '\1', 'g');     -- rr → r, ss → s…
  s := replace(s, '_', 'ch');
  return btrim(regexp_replace(s, '\s+', ' ', 'g'));
end;
$$;

comment on function public.clave_fonetica(text) is
  'Cómo suena un texto en español: «vino» y «bino» dan «bino». Igual a phoneticKey de lib/search/phonetic.ts; si cambia una, cambia la otra.';

alter table public.catalog_products
  add column search_phonetic text
  generated always as (public.clave_fonetica(coalesce(name, '') || ' ' || coalesce(description, ''))) stored;

comment on column public.catalog_products.search_phonetic is
  'Clave fonética del nombre y la descripción (clave_fonetica). La calcula la base. Para buscar con errores de ortografía.';

create index catalog_products_search_text_trgm_idx
  on public.catalog_products using gin (search_text extensions.gin_trgm_ops);
create index catalog_products_search_phonetic_trgm_idx
  on public.catalog_products using gin (search_phonetic extensions.gin_trgm_ops);

-- Las columnas nuevas van al final: `create or replace view` solo deja agregar
-- al final. `security_invoker` se repite o la vista dejaría de respetar la RLS.
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
    coalesce(pc.name, c.name) as parent_category_name,
    cp.search_phonetic as product_search_phonetic,
    cp.id as catalog_product_id
   from store_products sp
     join catalog_products cp on cp.id = sp.catalog_product_id
     left join categories c on c.id = cp.category_id
     left join categories pc on pc.id = c.parent_id
     join stores s on s.id = sp.store_id
     left join marketplaces m on m.id = s.marketplace_id
     left join measurement_units mu on mu.id = sp.unit_id
  where sp.is_active and s.is_active;

-- Los productos del catálogo que más se parecen a lo buscado, para cuando la
-- búsqueda normal no encuentra nada («aguacte»). Compara el texto y su clave
-- fonética, palabra por palabra (word_similarity), y se queda con el mejor.
create function public.buscar_productos_parecidos(p_texto text, p_limite int default 60)
returns table (catalog_product_id uuid, parecido real)
language sql
stable
set search_path = public, extensions
as $$
  with q as (
    select lower(public.immutable_unaccent(btrim(p_texto))) as texto,
           public.clave_fonetica(p_texto) as clave
  )
  select cp.id,
         greatest(word_similarity(q.texto, cp.search_text), word_similarity(q.clave, cp.search_phonetic)) as parecido
  from public.catalog_products cp, q
  where length(q.texto) >= 3
    and greatest(word_similarity(q.texto, cp.search_text), word_similarity(q.clave, cp.search_phonetic)) >= 0.45
  order by parecido desc, cp.id
  limit least(greatest(p_limite, 1), 200);
$$;

comment on function public.buscar_productos_parecidos(text, int) is
  'Ids del catálogo que más se parecen a p_texto (trigramas sobre el texto y su clave fonética). La segunda red de la búsqueda, para errores de tecleo.';

grant execute on function public.clave_fonetica(text) to anon, authenticated, service_role;
grant execute on function public.buscar_productos_parecidos(text, int) to anon, authenticated, service_role;
