-- Un producto exclusivo de un grupo de tiendas aparece solo en cada tienda del
-- grupo: sin publicar, con precio 0 y stock 0, para que la tienda le ponga
-- precio y lo publique.
--
-- Antes, `catalog_products.owner_group_id` solo decía quién *podía* agregarlo, y
-- la tienda tenía que buscarlo y agregarlo a mano. Fres Carnes tenía 24 de los
-- 50 productos de su grupo y no sabía que le faltaban los otros.
--
-- Va en la base y no en la aplicación porque el grupo de un producto cambia por
-- muchos lados (la ventana del producto, la tabla tipo Excel, el cambio de grupo
-- en lote, la aprobación de los que están en revisión) y la tienda entra a un
-- grupo por otros dos. Así todos quedan cubiertos.
--
-- No quita nada: si el producto sale del grupo o la tienda se va, lo que ya
-- tenía asignado se queda (puede tener pedidos). Tampoco vuelve a crear lo que
-- la tienda borró, porque solo actúa cuando cambia el grupo, la aprobación o el
-- estado del producto, o el grupo de la tienda.

-- Lo que falte de (producto exclusivo, tienda de su grupo). Con `p_producto`
-- solo ese producto, con `p_tienda` solo esa tienda; sin ninguno, todo.
-- `security definer`: la escribe un trigger, y quien cambia el catálogo (el
-- admin) no siempre es miembro de la tienda.
create function public.asignar_productos_de_grupo(p_producto uuid default null, p_tienda uuid default null)
    returns integer
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  n integer;
begin
  insert into store_products (store_id, catalog_product_id, unit_id, price_per_unit, stock, is_active)
  select s.id, cp.id, cp.default_unit_id, 0, 0, false
  from catalog_products cp
  join stores s on s.store_group_id = cp.owner_group_id
  where cp.owner_group_id is not null
    and cp.is_active
    and cp.review_status = 'approved'
    and cp.default_unit_id is not null
    and (p_producto is null or cp.id = p_producto)
    and (p_tienda is null or s.id = p_tienda)
  on conflict (store_id, catalog_product_id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.asignar_productos_de_grupo(uuid, uuid) from public, anon, authenticated;

create function public.catalog_products_asignar_a_su_grupo() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
begin
  if new.owner_group_id is not null and new.is_active and new.review_status = 'approved' then
    perform asignar_productos_de_grupo(new.id, null);
  end if;
  return null;
end;
$$;

create trigger catalog_products_asignar_a_su_grupo
  after insert or update of owner_group_id, review_status, is_active, default_unit_id on public.catalog_products
  for each row execute function public.catalog_products_asignar_a_su_grupo();

create function public.stores_recibir_productos_del_grupo() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
begin
  if new.store_group_id is not null then
    perform asignar_productos_de_grupo(null, new.id);
  end if;
  return null;
end;
$$;

create trigger stores_recibir_productos_del_grupo
  after insert or update of store_group_id on public.stores
  for each row execute function public.stores_recibir_productos_del_grupo();

-- Nada se vende a $0: lo que llega solo por el grupo, o cualquier otro producto,
-- se publica cuando tiene precio. La aplicación lo dice antes en la celda
-- (`publishesWithoutPrice` de `lib/store-products/price-grid.ts`).
alter table public.store_products
  add constraint store_products_publicado_con_precio check (not is_active or price_per_unit > 0);

-- Lo que falta hoy. En una base recién creada no hay datos y no hace nada; la
-- copia de producción lo completa en `supabase/seed/post.sql`.
select public.asignar_productos_de_grupo();
