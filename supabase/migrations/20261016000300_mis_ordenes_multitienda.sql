-- «Mis Órdenes» con pedidos de varias tiendas.
--
-- La vista ya trae una fila por tienda, con sus productos y el cobro del
-- pedido (20261013). Para que cada tarjeta sepa si es parte de un pedido de
-- varias tiendas —y solo la primera muestre el botón de pagar— le faltaban:
--
--   store_order_id   la parte de la fila (el id del pedido se repite)
--   split_index      su orden dentro del pedido: 1, 2, ...
--   store_count      cuántas tiendas tiene el pedido
--
-- Van al final: `create or replace view` no deja mover columnas.
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
    o.credit_applied,
    so.id as store_order_id,
    so.split_index,
    (select count(*) from public.store_orders so2 where so2.order_id = o.id)::integer as store_count
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
  group by o.id, o.buyer_id, so.id, so.store_id, s.name, o.created_at, so.status, o.payment_status, p.payment_method,
    p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department,
    da.delivery_instructions, so.subtotal, so.code, o.code, pu.payable_until;
