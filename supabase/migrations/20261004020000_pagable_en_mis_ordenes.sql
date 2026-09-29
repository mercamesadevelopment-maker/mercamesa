-- «Mis órdenes» necesita saber si un pedido todavía se puede pagar, para
-- ofrecer el botón «Pagar». Se agrega al final de la vista (un `create or
-- replace view` solo admite columnas nuevas al final) con la misma definición
-- que usan el vencimiento y `zonapagos-inicio`: `public.payable_until`.

create or replace view public.orders_detail_view as
 SELECT o.id AS order_id,
    o.buyer_id,
    so.store_id,
    s.name AS store_name,
    o.created_at,
    so.status,
    p.status AS payment_status,
    p.payment_method,
    p.payment_method_label,
    da.id AS delivery_address_id,
    da.address_line,
    da.neighborhood,
    da.municipality,
    da.department,
    so.subtotal AS total,
    COALESCE(jsonb_agg(jsonb_build_object('store_product_id', oi.store_product_id, 'catalog_name', oi.catalog_name, 'unit_name', oi.unit_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'total_price', oi.total_price)) FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS products,
    so.code AS order_code,
    o.code AS parent_code,
    da.delivery_instructions,
    pu.payable_until
   FROM orders o
     JOIN store_orders so ON so.order_id = o.id
     JOIN stores s ON s.id = so.store_id
     LEFT JOIN LATERAL ( SELECT p_1.status,
            p_1.payment_method,
            p_1.payment_method_label
           FROM payments p_1
          WHERE p_1.order_id = o.id
          ORDER BY p_1.created_at DESC
         LIMIT 1) p ON true
     LEFT JOIN LATERAL ( SELECT public.payable_until(o) AS payable_until) pu ON true
     LEFT JOIN delivery_addresses da ON da.id = o.delivery_address_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN store_products sp ON sp.id = oi.store_product_id AND sp.store_id = so.store_id
  GROUP BY o.id, o.buyer_id, so.store_id, s.name, o.created_at, so.status, p.status, p.payment_method, p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department, da.delivery_instructions, so.subtotal, so.code, o.code, pu.payable_until;
