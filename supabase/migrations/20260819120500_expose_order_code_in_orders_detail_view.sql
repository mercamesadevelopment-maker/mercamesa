-- La vista que alimenta el listado de pedidos del comprador (/orders) no exponía
-- ningún código, por eso la interfaz recortaba el UUID. Se añaden las dos
-- columnas nuevas para que el comprador vea exactamente el mismo código que el
-- vendedor y el admin.
--
-- `order_code` es el del store_order (cada fila de esta vista ya es la parte de
-- una tienda) y es el que se muestra; `parent_code` queda disponible para
-- agrupar visualmente las tiendas de una misma compra.
--
-- Van al final de la lista de columnas porque `create or replace view` solo
-- permite agregar columnas después de las existentes. El resto de la definición
-- se conserva tal cual estaba.
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
    o.code AS parent_code
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
     LEFT JOIN delivery_addresses da ON da.id = o.delivery_address_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN store_products sp ON sp.id = oi.store_product_id AND sp.store_id = so.store_id
  GROUP BY o.id, o.buyer_id, so.store_id, s.name, o.created_at, so.status, p.status, p.payment_method, p.payment_method_label, da.id, da.address_line, da.neighborhood, da.municipality, da.department, so.subtotal, so.code, o.code;
