-- Centro de costo de Siigo por plaza de mercado.
--
-- El tipo de documento de factura de venta (26727) tiene `cost_center: true`,
-- así que Siigo exige el campo y responde `parameter_required` sin él.
--
-- Los centros de costo de la cuenta son exactamente las plazas (Plaza Minorista,
-- Placita de Flórez, Central Mayorista...), así que en vez de mandar uno fijo se
-- toma el de la plaza donde está la tienda que vendió. La contabilidad queda
-- discriminada por plaza sin trabajo extra.

alter table public.marketplaces
  add column if not exists siigo_cost_center_id integer;

comment on column public.marketplaces.siigo_cost_center_id is
  'Centro de costo en Siigo. GET /v1/cost-centers';

update public.marketplaces set siigo_cost_center_id = 10119 where name = 'Plaza Minorista';
update public.marketplaces set siigo_cost_center_id = 10121 where name = 'Placita de Flórez';
update public.marketplaces set siigo_cost_center_id = 10131 where name = 'Plaza Mayorista';
