-- «Mis Órdenes» mostraba «rechazado» en un pedido ya pagado.
--
-- La vista tomaba el estado de pago del ÚLTIMO intento del pedido. Un pedido
-- puede tener varios intentos (el botón «Pagar» abre uno nuevo cada vez), y el
-- que lo paga no siempre es el último: en MM-2026-001091 el comprador pagó con
-- un banco y abrió después otro intento, que fue rechazado. El pedido quedó
-- confirmado y la tienda lo recibió, pero el comprador seguía viendo
-- «rechazado».
--
-- Dos cambios sobre la vista:
--
-- 1. `payment_status` es el del pedido (`orders.payment_status`), que es el que
--    deciden las funciones de ZonaPagos con todos los intentos y el que ya usan
--    la tienda y el administrador.
-- 2. El medio de pago es el del intento aprobado; si no hay ninguno, el del
--    último intento, como antes.
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
    ) as discount_total
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
