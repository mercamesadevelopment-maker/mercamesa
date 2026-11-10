-- IVA por producto.
--
-- La tarifa va en el producto del catálogo y no en Tarifas y Comisiones: en
-- Colombia una reforma mueve bienes puntuales entre 0 %, 5 % y 19 %, y un
-- porcentaje global no lo podría representar. Hoy todo queda en 0 %.
--
-- El precio que pone el tendero YA incluye el IVA: el total no cambia y el
-- comprador ve qué parte es impuesto. La factura de Siigo sigue sin IVA
-- discriminado (decisión del tributarista del cliente); antes de poner un
-- producto en 5 % o 19 % hay que llevar el impuesto a la factura.

alter table public.catalog_products
  add column iva_rate numeric(5,4) not null default 0
  constraint catalog_products_iva_rate_check check (iva_rate in (0, 0.05, 0.19));

comment on column public.catalog_products.iva_rate is
  'Tarifa de IVA del producto (0, 0.05 o 0.19). Va incluida en el precio de cada tienda.';

-- La tarifa copiada al comprar: una reforma no cambia los pedidos viejos (el
-- mismo criterio que `list_unit_price`).
alter table public.order_items
  add column iva_rate numeric(5,4) not null default 0;

comment on column public.order_items.iva_rate is
  'Tarifa de IVA del producto al momento de la compra. El IVA va incluido en `total_price`.';

-- «Mis Órdenes»: el IVA incluido en TODO el pedido, como `order_total` y
-- `order_subtotal`. Va en un subselect porque el `join` de la vista ya filtra
-- los productos por tienda. Al final: `create or replace view` no deja mover
-- columnas.
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
    (select count(*) from public.store_orders so2 where so2.order_id = o.id)::integer as store_count,
    (select coalesce(round(sum(oi2.total_price * oi2.iva_rate / (1 + oi2.iva_rate))), 0)
       from public.order_items oi2
      where oi2.order_id = o.id) as order_iva_total
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
