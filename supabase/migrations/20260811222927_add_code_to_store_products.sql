-- Código propio de la tienda para cada producto publicado, del estilo de un
-- código de barras: lo escribe el vendedor y debe ser único dentro de su tienda.
--
-- Queda nullable a propósito: al crear la columna ya había 751 productos
-- publicados sin código, y el cliente prefirió dejarlos vacíos antes que
-- inventarles un código que no corresponde al producto físico. La
-- obligatoriedad se aplica en la aplicación (formularios, endpoints y carga
-- masiva), que es donde hay una persona escribiéndolo.
alter table public.store_products add column code text;

comment on column public.store_products.code is
  'Codigo propio de la tienda para este producto (tipo codigo de barras). Unico dentro de la tienda. Nullable solo por los productos creados antes de existir la columna: la aplicacion lo exige.';

-- Único por tienda e insensible a mayúsculas, para que "abc12" y "ABC12" no
-- convivan. Parcial, porque los productos sin código no deben chocar entre sí.
-- Dos tiendas distintas sí pueden usar el mismo código: es el mismo producto de
-- fábrica en dos negocios.
create unique index store_products_store_code_key
  on public.store_products (store_id, upper(code))
  where code is not null;

-- 50 caracteres es el límite del campo `barcode` de Siigo, con quien el
-- proyecto ya se integra, para que el dato pueda mapearse tal cual.
alter table public.store_products
  add constraint store_products_code_length
  check (code is null or char_length(btrim(code)) between 1 and 50);
