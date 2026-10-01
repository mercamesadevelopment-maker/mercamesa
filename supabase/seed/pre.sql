-- Corre antes de la copia de producción (`prod_data.sql`).
--
-- Las cuatro validaciones de `store_offers` se crearon como NOT VALID porque en
-- producción ya había ofertas viejas que no las cumplen. Postgres las perdona a
-- las filas que ya estaban, pero no a un INSERT: al copiar esas mismas filas a
-- una base nueva las rechaza. Se quitan para cargar y `local.sql` las vuelve a
-- poner, igual que en producción.
alter table public.store_offers
  drop constraint if exists store_offers_dates_ordered,
  drop constraint if exists store_offers_discount_pct_range,
  drop constraint if exists store_offers_discount_xor_price,
  drop constraint if exists store_offers_special_price_positive;
