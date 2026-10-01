-- Cuánto se ahorró el comprador en un pedido con productos en oferta.
--
-- `order_items.unit_price` guarda el precio que se cobró, ya con la oferta
-- aplicada, y el precio de lista se perdía al crear el pedido. Sin él no hay
-- forma de decirle al comprador, después de pagar, cuánto se ahorró: las ofertas
-- cambian y se acaban, así que no se puede reconstruir mirando las de hoy.

-- ---------------------------------------------------------------------------
-- El precio de lista de cada línea
-- ---------------------------------------------------------------------------
-- Opcional: los pedidos anteriores no lo tienen y no se inventa. Una línea sin
-- precio de lista, o con uno igual al cobrado, no tuvo descuento.
alter table public.order_items
  add column list_unit_price numeric
    constraint order_items_list_unit_price_check check (list_unit_price is null or list_unit_price >= 0);

comment on column public.order_items.list_unit_price is
  'Precio por unidad antes de la oferta, al momento de la compra. Nulo en pedidos anteriores a esta columna.';

-- ---------------------------------------------------------------------------
-- «Mis Órdenes»
-- ---------------------------------------------------------------------------
-- Tres cambios sobre la vista:
--
-- 1. Cada producto trae su `list_unit_price`.
-- 2. `discount_total`: lo ahorrado en los productos de la fila.
-- 3. Los productos son solo los de la tienda de la fila. Antes el `join` con
--    `store_products` era `left` y no filtraba nada: en un pedido con dos
--    tiendas, cada fila mostraba los productos de las dos.
--
-- La columna nueva va al final: `create or replace view` no deja moverlas.
create or replace view public.orders_detail_view as
 select o.id as order_id,
    o.buyer_id,
    so.store_id,
    s.name as store_name,
    o.created_at,
    so.status,
    p.status as payment_status,
    p.payment_method,
    p.payment_method_label,
    da.id as delivery_address_id,
    da.address_line,
    da.neighborhood,
    da.municipality,
    da.department,
    so.subtotal as total,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'store_product_id', oi.store_product_id,
          'catalog_name', oi.catalog_name,
          'unit_name', oi.unit_name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'total_price', oi.total_price,
          'list_unit_price', oi.list_unit_price
        )
      ) filter (where oi.id is not null),
      '[]'::jsonb
    ) as products,
    so.code as order_code,
    o.code as parent_code,
    da.delivery_instructions,
    pu.payable_until,
    coalesce(
      sum((oi.list_unit_price - oi.unit_price) * oi.quantity)
        filter (where oi.list_unit_price > oi.unit_price),
      0
    ) as discount_total
   from public.orders o
     join public.store_orders so on so.order_id = o.id
     join public.stores s on s.id = so.store_id
     left join lateral (
       select p_1.status, p_1.payment_method, p_1.payment_method_label
         from public.payments p_1
        where p_1.order_id = o.id
        order by p_1.created_at desc
        limit 1
     ) p on true
     left join lateral (select public.payable_until(o.*) as payable_until) pu on true
     left join public.delivery_addresses da on da.id = o.delivery_address_id
     left join (
       public.order_items oi
       join public.store_products sp on sp.id = oi.store_product_id
     ) on oi.order_id = o.id and sp.store_id = so.store_id
  group by o.id, o.buyer_id, so.store_id, s.name, o.created_at, so.status, p.status, p.payment_method,
    p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department,
    da.delivery_instructions, so.subtotal, so.code, o.code, pu.payable_until;
