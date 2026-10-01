-- Ajustes que solo valen para la base local. Corre después de la copia de
-- producción (`prod_data.sql`) en cada `supabase db reset`.

-- Secretos de Vault. Son valores de mentira: el de verdad vive solo en el Vault
-- de cada proyecto y nunca en un archivo. `CRON_SECRET` de `.env.local` tiene
-- que decir lo mismo que `app_cron_secret`.
select vault.create_secret('http://host.docker.internal:4005', 'app_base_url')
where not exists (select 1 from vault.secrets where name = 'app_base_url');

select vault.create_secret('local-cron-secret', 'app_cron_secret')
where not exists (select 1 from vault.secrets where name = 'app_cron_secret');

-- Las tareas programadas que llaman hacia afuera se apagan en local. La sonda de
-- pagos apunta a las funciones del proyecto de producción, y las demás le
-- pegarían a la aplicación cada pocos minutos: la de facturas, sin credenciales
-- de Siigo, agotaría los intentos de cada factura y las dejaría en «failed».
-- Cuando haga falta probar una, se llama a mano:
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
-- menú antes de que su código esté desplegado. En local el código siempre está:
-- se activan todos, o las pantallas nuevas no se verían mientras se desarrollan.
update public.modules set is_active = true where not is_active;
