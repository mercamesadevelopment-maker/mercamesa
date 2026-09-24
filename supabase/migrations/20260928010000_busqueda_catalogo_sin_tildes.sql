-- Columna de búsqueda del catálogo, para poder paginar en el servidor.
--
-- /admin/products traía las 3.588 filas de una sola vez —2,78 MB— y filtraba,
-- buscaba y ordenaba en el navegador. Para paginar en el servidor la búsqueda
-- tiene que subir también: si no, buscar solo buscaría dentro de la página
-- actual, que es peor que el problema original.
--
-- El detalle que obliga a esta columna: el buscador de hoy usa `normalizeText`,
-- que quita las tildes, y 661 de los 3.588 nombres llevan tilde. Con un `ilike`
-- a secas, buscar "platano" dejaría de encontrar "plátano". Eso sería una
-- regresión silenciosa para quien usa esta pantalla todos los días.

create extension if not exists unaccent;

-- `unaccent` es STABLE, no IMMUTABLE, porque depende del diccionario que tenga
-- cargado la sesión. Una columna generada exige IMMUTABLE, así que se envuelve
-- fijando el diccionario de forma explícita: con el diccionario fijo el
-- resultado sí es constante para una misma entrada.
create or replace function public.immutable_unaccent(texto text)
returns text
language sql
immutable
strict
parallel safe
set search_path = public, extensions
as $$
  select unaccent('unaccent', texto)
$$;

comment on function public.immutable_unaccent(text) is
  'unaccent() con el diccionario fijo, para poder usarlo en columnas generadas e índices. No usar para otra cosa: unaccent() a secas es suficiente en consultas normales.';

-- Se indexan nombre y descripción juntos porque es lo que busca la pantalla hoy
-- (`name` + `description` en el mismo filtro). La descripción está vacía en las
-- 3.588 filas, pero incluirla mantiene el comportamiento idéntico si algún día
-- se llena.
alter table public.catalog_products
  add column if not exists search_text text
  generated always as (
    lower(public.immutable_unaccent(coalesce(name, '') || ' ' || coalesce(description, '')))
  ) stored;

comment on column public.catalog_products.search_text is
  'Nombre y descripción en minúscula y sin tildes. La calcula la base; no se escribe desde la aplicación. El cliente normaliza el término de búsqueda con `normalizeText`, que hace lo mismo.';

create index if not exists catalog_products_search_text_idx
  on public.catalog_products (search_text text_pattern_ops);
