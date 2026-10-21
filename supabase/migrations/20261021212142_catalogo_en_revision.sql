-- Productos del catálogo propuestos por un tendero, en revisión.
--
-- Desde la carga masiva, un tendero puede agregar productos que no están en el
-- catálogo maestro. Entran al catálogo «pendientes»: la tienda que los propuso
-- los vende de una vez, pero ninguna otra los ve hasta que el admin los
-- apruebe, los corrija o los una con uno que ya existía. Así el catálogo no se
-- llena de duplicados ni de nombres mal escritos.
--
-- La lectura de `catalog_products` sigue abierta (`using (true)`): la vitrina
-- muestra el producto de la tienda con su nombre del catálogo, también cuando
-- está en revisión. Lo que se filtra es lo que se ofrece para publicar
-- (`lib/catalog/visibility.ts`).

alter table public.catalog_products
  add column review_status text not null default 'approved'
    constraint catalog_products_review_status_check check (review_status in ('pending', 'approved')),
  add column proposed_by_store_id uuid
    constraint catalog_products_proposed_by_store_id_fkey references public.stores (id) on delete set null;

comment on column public.catalog_products.review_status is
  'approved: en el catálogo para todas las tiendas que lo pueden ver. pending: propuesto por una tienda; solo ella lo ve hasta que el admin lo revise.';
comment on column public.catalog_products.proposed_by_store_id is
  'La tienda que propuso el producto desde la carga masiva. Nulo en los que creó el admin.';

create index catalog_products_en_revision on public.catalog_products (created_at)
  where review_status = 'pending';


-- Unir un producto propuesto con uno que ya existía en el catálogo: las tiendas
-- que lo vendían pasan a vender el existente, y el propuesto se borra. Los
-- pedidos no se tocan: `order_items` guarda copia del nombre y la unidad.
--
-- Si una tienda ya vendía el existente, no se puede unir sin perder uno de sus
-- dos productos (precio, stock, código): se detiene y lo dice.
create function public.merge_catalog_product(p_pending uuid, p_target uuid) returns integer
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  movidos integer;
  choque text;
begin
  if p_pending = p_target then
    raise exception 'No se puede unir un producto consigo mismo' using errcode = 'check_violation';
  end if;

  perform 1 from catalog_products where id = p_pending and review_status = 'pending' for update;
  if not found then
    raise exception 'El producto ya no está en revisión' using errcode = 'no_data_found';
  end if;

  perform 1 from catalog_products where id = p_target and review_status = 'approved' and is_active;
  if not found then
    raise exception 'El producto con el que se une debe estar aprobado y activo' using errcode = 'no_data_found';
  end if;

  select s.name into choque
  from store_products propio
  join store_products existente
    on existente.store_id = propio.store_id and existente.catalog_product_id = p_target
  join stores s on s.id = propio.store_id
  where propio.catalog_product_id = p_pending
  limit 1;

  if choque is not null then
    raise exception 'La tienda "%" ya vende ese producto. Retira uno de los dos antes de unirlos.', choque
      using errcode = 'unique_violation';
  end if;

  update store_products set catalog_product_id = p_target where catalog_product_id = p_pending;
  get diagnostics movidos = row_count;

  delete from catalog_products where id = p_pending;

  return movidos;
end;
$$;

-- Solo el servidor, después de comprobar el permiso sobre el catálogo maestro.
revoke all on function public.merge_catalog_product(uuid, uuid) from public, anon, authenticated;
