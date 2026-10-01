-- Ubicación del local dentro de la plaza.
--
-- `stores` no tenía ninguna columna de dirección, y el tendero no encontraba
-- dónde poner la suya. No es un olvido: para la logística no hace falta, porque
-- el operador recoge en la dirección de la PLAZA
-- (`lib/pibox/mappers/order-to-booking.ts` usa `marketplace.address`), no en la
-- del local.
--
-- Lo que sí necesita el tendero es decir DÓNDE ESTÁ dentro de la plaza, para que
-- el comprador lo ubique. Por eso se agrega como texto libre y sin coordenadas:
-- no participa en ningún cálculo de envío.

alter table public.stores
  add column if not exists local_address text;

comment on column public.stores.local_address is
  'Ubicación del local DENTRO de la plaza ("Local 234, pasillo 3"). Es informativa para el comprador: la logística recoge en la dirección de la plaza (marketplaces.address), no acá.';
