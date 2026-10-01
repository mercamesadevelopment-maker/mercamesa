-- «Mis Órdenes» con pedidos de varias tiendas.
--
-- La vista ya devolvía una fila por tienda, pero:
--
-- - Los productos de cada fila eran TODOS los del pedido. El `join` con
--   `store_products` filtraba por tienda pero era `left`, así que no filtraba
--   nada: con dos tiendas, cada tarjeta mostraba los productos de las dos.
-- - No traía lo que se cobró por el pedido (domicilio, comisiones, saldo a
--   favor usado), así que «Total a pagar» mostraba solo el valor de los
--   productos de esa tienda.
--
-- Las columnas nuevas van al final: `create or replace view` no deja moverlas.
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
          'total_price', oi.total_price
        )
      ) filter (where oi.id is not null),
      '[]'::jsonb
    ) as products,
    so.code as order_code,
    o.code as parent_code,
    da.delivery_instructions,
    pu.payable_until,
    -- Nuevas
    so.id as store_order_id,
    so.split_index,
    (select count(*) from public.store_orders so2 where so2.order_id = o.id)::integer as store_count,
    o.total as order_total,
    o.credit_applied
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
     -- Solo los productos de la tienda de esta fila.
     left join (
       public.order_items oi
       join public.store_products sp on sp.id = oi.store_product_id
     ) on oi.order_id = o.id and sp.store_id = so.store_id
  group by o.id, o.buyer_id, so.id, so.store_id, s.name, o.created_at, so.status, p.status, p.payment_method,
    p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department,
    da.delivery_instructions, so.subtotal, so.code, o.code, pu.payable_until, so.split_index, o.total, o.credit_applied;
