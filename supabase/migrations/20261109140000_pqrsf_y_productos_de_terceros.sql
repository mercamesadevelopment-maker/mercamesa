-- PQRSF y los conceptos de la factura electrónica.
--
-- 1. La factura pasa a tener dos conceptos, definidos con los contadores:
--    «Productos de terceros» (lo del tendero, una línea por producto con el
--    mismo código de Siigo) y «Domicilio» (todo lo de MercaMesa: el domicilio,
--    los gastos administrativos y los operativos). Ya no hay una línea de
--    «Servicio MercaMesa»: un servicio lleva IVA.
-- 2. Las PQRS pasan a PQRSF: se agrega la felicitación.

alter table public.pricing_settings_history
  add column siigo_third_party_product_code text;

comment on column public.pricing_settings_history.siigo_third_party_product_code is
  'Código del producto de Siigo «Productos de terceros»: va en cada línea de producto del tendero en la factura.';
comment on column public.pricing_settings_history.siigo_platform_product_code is
  'Ya no se usa al facturar (antes, la línea «Servicio MercaMesa»). Se conserva por la historia y por las facturas viejas.';

-- La columna vieja deja de ser obligatoria: los ajustes nuevos ya no la llenan.
alter table public.pricing_settings_history
  alter column siigo_platform_product_code drop not null;

alter table public.pqrs drop constraint pqrs_kind_check;
alter table public.pqrs add constraint pqrs_kind_check
  check (kind in ('peticion', 'queja', 'reclamo', 'sugerencia', 'felicitacion'));

-- El menú dice PQRSF. Los módulos vienen de las migraciones, así que existen en
-- cualquier base recién creada.
update public.modules set label = 'PQRSF',
  description = 'Peticiones, quejas, reclamos, sugerencias y felicitaciones del comprador'
where key = 'my-pqrs';
update public.modules set label = 'PQRSF' where key = 'seller-pqrs';
update public.modules set label = 'PQRSF', description = 'Todas las PQRSF de la plataforma' where key = 'admin-pqrs';
