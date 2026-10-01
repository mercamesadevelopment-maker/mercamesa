-- Dirección propia de la tienda: el punto donde el mensajero recoge.
--
-- Hasta ahora el origen de todo despacho era la plaza, y estaba escrito así a
-- propósito: `stores` no guardaba ubicación porque el local vivía dentro de la
-- plaza (ver 20260909020000_stores_local_address.sql).
--
-- Esa premisa dejó de ser cierta. MercaMesa puede asociarse con una plaza
-- entera o con una sola tienda, y en el segundo caso no hay plaza de la que
-- sacar la dirección: la cotización y el despacho fallaban con
-- "La plaza de X no tiene dirección registrada".
--
-- Todas nulas y opcionales: vacías, se sigue recogiendo en la plaza, que es lo
-- que hace hoy la mayoría de las tiendas. `numeric(10,7)` igual que
-- `marketplaces`, por eso el front trunca a 7 decimales.

alter table public.stores
  add column if not exists address text,
  add column if not exists latitude numeric(10,7),
  add column if not exists longitude numeric(10,7),
  add column if not exists city text,
  add column if not exists department text;

comment on column public.stores.address is
  'Dirección de recogida propia de la tienda. Si está vacía, el despacho usa la dirección de su plaza (marketplaces.address).';

comment on column public.stores.latitude is
  'Latitud del punto de recogida de la tienda. Va siempre junto a `address`: una dirección sin coordenadas obliga a Pibox a geocodificar el texto contra el city_code del DESTINO, y el paquete termina recogiéndose donde no es.';

comment on column public.stores.longitude is
  'Longitud del punto de recogida de la tienda. Ver el comentario de `latitude`.';

comment on column public.stores.city is
  'Ciudad del punto de recogida de la tienda. Alimenta el city_code de Pibox cuando faltan coordenadas.';

comment on column public.stores.department is
  'Departamento del punto de recogida de la tienda.';

-- Dirección y coordenadas viajan juntas, en los dos sentidos: una dirección sin
-- punto en el mapa es despachable a ciegas, y un punto sin dirección no le dice
-- nada al mensajero. La API también lo valida; esto es la red de seguridad para
-- cualquier escritura que no pase por ella.
alter table public.stores
  drop constraint if exists stores_direccion_completa;

alter table public.stores
  add constraint stores_direccion_completa check (
    (address is null and latitude is null and longitude is null)
    or (address is not null and latitude is not null and longitude is not null)
  );

-- El comentario anterior daba por sentado que la logística SIEMPRE recoge en la
-- plaza. Ya no: sigue siendo informativo para el comprador, pero ahora también
-- viaja a Pibox como referencia secundaria para que el mensajero encuentre el
-- local dentro de la plaza.
comment on column public.stores.local_address is
  'Ubicación del local DENTRO de la plaza ("Local 234, pasillo 3"). No es una dirección postal ni define el punto de recogida: eso lo deciden stores.address o, si está vacía, marketplaces.address. Se le manda al mensajero como referencia para encontrar el local.';
