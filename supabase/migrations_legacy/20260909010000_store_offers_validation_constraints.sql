-- Reglas mínimas de una oferta, en la base.
--
-- `store_offers` no tenía ninguna restricción más allá de la clave foránea: se
-- podía crear una oferta escogiendo solo el producto y dejando el resto vacío,
-- con lo que quedaba una "oferta" que no descontaba nada. Eso fue justamente lo
-- que reportó el cliente.
--
-- Van como NOT VALID a propósito: existe una fila anterior con todo vacío (la
-- oferta de prueba de "Casabe", en estado `pending`, del 2026-08-06). NOT VALID
-- aplica la regla a todo INSERT y UPDATE futuro pero no rechaza lo ya guardado,
-- así que la restricción entra sin destruir datos. Cuando se decida qué hacer
-- con esa fila, se puede promover con:
--   alter table public.store_offers validate constraint <nombre>;

alter table public.store_offers
  drop constraint if exists store_offers_discount_xor_price;

alter table public.store_offers
  add constraint store_offers_discount_xor_price
  check (
    (discount_pct is not null and special_price is null)
    or (discount_pct is null and special_price is not null)
  )
  not valid;

alter table public.store_offers
  drop constraint if exists store_offers_discount_pct_range;

alter table public.store_offers
  add constraint store_offers_discount_pct_range
  check (discount_pct is null or (discount_pct > 0 and discount_pct < 100))
  not valid;

alter table public.store_offers
  drop constraint if exists store_offers_special_price_positive;

alter table public.store_offers
  add constraint store_offers_special_price_positive
  check (special_price is null or special_price > 0)
  not valid;

alter table public.store_offers
  drop constraint if exists store_offers_dates_ordered;

alter table public.store_offers
  add constraint store_offers_dates_ordered
  check (ends_at is null or ends_at > starts_at)
  not valid;

comment on constraint store_offers_discount_xor_price on public.store_offers is
  'Una oferta descuenta por porcentaje o fija un precio, nunca ambos ni ninguno.';

-- Nota: que el precio especial sea menor al del inventario NO va como CHECK
-- porque `price_per_unit` vive en otra tabla y un CHECK no puede consultarla.
-- Esa regla se valida en `lib/offers/validate-offer.ts` y en la API.
