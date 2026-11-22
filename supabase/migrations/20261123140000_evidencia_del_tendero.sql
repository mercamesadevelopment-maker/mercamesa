-- Evidencia del tendero al marcar «Listo Recogida».
--
-- La evidencia de cómo salió cada parte (fotos de los productos y las bolsas,
-- y una observación) la registra logística al recibir en la bahía. Cuando
-- nadie de logística la recibe —la plaza no la tiene, el pedido de varias
-- tiendas no la usa o la tienda despacha desde su dirección— la deja el
-- tendero, y es obligatoria (`lib/orders/store-evidence-rules.ts`).
--
-- Va aparte de `bay_received_at`: no es una recepción en la bahía y no cuenta
-- como servicio de logística (`logistics_services_by_day`).

alter table public.store_orders
  add column store_evidence_at timestamptz,
  add column store_evidence_by uuid references auth.users (id) on delete set null,
  add column store_observation text
    constraint store_orders_store_observation_largo check (char_length(store_observation) <= 500);

comment on column public.store_orders.store_evidence_at is
  'Cuándo el tendero dejó la evidencia de la parte (fotos al marcar «Listo Recogida»), si le tocaba a él.';
comment on column public.store_orders.store_observation is
  'Lo que anotó el tendero al dejar la evidencia: cómo empacó, cuántas bolsas.';

-- Las fotos van en la misma tabla y el mismo bucket privado que las de
-- logística; `source` dice quién las tomó.
alter table public.store_order_bay_photos
  add column source text not null default 'logistics'
    constraint store_order_bay_photos_source check (source in ('logistics', 'store'));

comment on column public.store_order_bay_photos.source is
  'Quién tomó la foto: logística al recibir en la bahía, o la tienda al marcar «Listo Recogida».';
