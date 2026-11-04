-- Una oferta puede limitar cuántas unidades se llevan a ese precio en cada
-- pedido (por ejemplo, máximo 3 kg). Sin valor, no hay límite: las ofertas que
-- ya existen siguen igual.
--
-- `numeric` y no entero porque hay productos por kg, con cantidades decimales
-- igual que `order_items.quantity`. La regla se aplica al cotizar y al crear el
-- pedido (`lib/offers/offer-limit.ts`); la canasta y las tarjetas solo la
-- muestran.

alter table public.store_offers
  add column max_qty_per_order numeric
    constraint store_offers_max_qty_per_order_positive
    check (max_qty_per_order is null or max_qty_per_order > 0);

comment on column public.store_offers.max_qty_per_order is
  'Máximo de unidades (en la unidad del producto) a precio de oferta por pedido. Null: sin límite.';
