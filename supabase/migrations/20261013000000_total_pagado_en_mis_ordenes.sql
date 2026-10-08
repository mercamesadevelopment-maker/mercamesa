-- «Mis Órdenes» rotulaba «Total pagado» el valor de los productos.
--
-- La vista expone `so.subtotal as total`: lo que suman los productos de la
-- tienda de la fila. No traía nada de lo que se le cobra al comprador, así que
-- la pantalla mostraba esa cifra como el total: en MM-2026-001091, $79.000 de
-- un pedido por el que se pagaron $111.194.
--
-- Se agregan los datos de cobro del PEDIDO. Son los mismos en todas las filas
-- de un pedido con varias tiendas, porque el comprador paga el pedido, no cada
-- parte:
--
--   order_total                 lo que vale el pedido completo
--   order_subtotal              los productos de todo el pedido
--   delivery_fee                el domicilio
--   service_commission_amount,
--   messages_amount             con los productos, «Productos y servicio de compra»
--   platform_commission_amount  «Servicio MercaMesa»
--   credit_applied              saldo a favor apartado; la pasarela cobra el resto
--
-- `total` se queda como estaba, y las columnas nuevas van al final:
-- `create or replace view` no deja renombrarlas ni moverlas.
create or replace view public.orders_detail_view as
 select o.id as order_id,
    o.buyer_id,
    so.store_id,
    s.name as store_name,
    o.created_at,
    so.status,
    o.payment_status,
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
    ) as discount_total,
    o.total as order_total,
    o.subtotal as order_subtotal,
    o.delivery_fee,
    o.service_commission_amount,
    o.messages_amount,
    o.platform_commission_amount,
    o.credit_applied
   from public.orders o
     join public.store_orders so on so.order_id = o.id
     join public.stores s on s.id = so.store_id
     left join lateral (
       select p_1.payment_method, p_1.payment_method_label
         from public.payments p_1
        where p_1.order_id = o.id
        order by (p_1.status = 'approved') desc, p_1.created_at desc
        limit 1
     ) p on true
     left join lateral (select public.payable_until(o.*) as payable_until) pu on true
     left join public.delivery_addresses da on da.id = o.delivery_address_id
     left join (
       public.order_items oi
       join public.store_products sp on sp.id = oi.store_product_id
     ) on oi.order_id = o.id and sp.store_id = so.store_id
  group by o.id, o.buyer_id, so.store_id, s.name, o.created_at, so.status, o.payment_status, p.payment_method,
    p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department,
    da.delivery_instructions, so.subtotal, so.code, o.code, pu.payable_until;
