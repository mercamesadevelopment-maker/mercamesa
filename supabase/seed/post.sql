-- Corre después de la copia de producción (`prod_data.sql`), tanto en la base
-- local (`pnpm db:reset`) como en staging (`pnpm staging:refresh`). Lo que es
-- solo de local —los secretos de Vault de mentira— está en `local.sql`.

-- Las tareas programadas que llaman hacia afuera se apagan. La sonda de pagos
-- apunta a las funciones del proyecto de producción (`call_edge_cron` tiene su
-- URL escrita), y las demás le pegarían a la aplicación cada pocos minutos: la
-- de facturas, sin credenciales de Siigo, agotaría los intentos de cada factura
-- y las dejaría en «failed». Cuando haga falta probar una, se llama a mano:
--   curl -X POST http://localhost:4005/api/siigo/invoices/process -H "Authorization: Bearer local-cron-secret"
-- Las dos que son SQL puro (vencer pedidos sin pagar y escalar PQRS) siguen activas.
select cron.unschedule(jobname)
from cron.job
where jobname in ('sonda', 'pibox_sync', 'siigo_invoices', 'siigo_credit_notes', 'payouts_draft');

-- Las validaciones de ofertas que `pre.sql` quitó para poder cargar los datos.
-- Mismas definiciones que la migración base.
alter table public.store_offers
  add constraint store_offers_dates_ordered
    check (ends_at is null or ends_at > starts_at) not valid,
  add constraint store_offers_discount_pct_range
    check (discount_pct is null or (discount_pct > 0 and discount_pct < 100)) not valid,
  add constraint store_offers_discount_xor_price
    check ((discount_pct is not null and special_price is null) or (discount_pct is null and special_price is not null)) not valid,
  add constraint store_offers_special_price_positive
    check (special_price is null or special_price > 0) not valid;

comment on constraint store_offers_discount_xor_price on public.store_offers is
  'Una oferta descuenta por porcentaje o fija un precio, nunca ambos ni ninguno.';

-- Los módulos nuevos nacen inactivos para que en producción no aparezcan en el
-- menú antes de que su código esté desplegado. En local y en staging el código
-- nuevo siempre está: se activan todos, o las pantallas nuevas no se verían.
update public.modules set is_active = true where not is_active;

-- El precio mínimo de compra pasó a `pricing_settings_history`, pero las
-- migraciones corren antes de cargar los datos: lo que traiga la copia en
-- `order_min_price_history` se pasa acá. Se quita cuando se borre esa tabla.
select public.copiar_precio_minimo_al_historial();
