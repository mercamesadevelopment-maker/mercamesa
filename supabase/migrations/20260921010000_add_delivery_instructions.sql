-- Indicaciones de entrega: cómo llegar a la puerta.
--
-- `delivery_addresses` guarda dónde queda la casa (dirección, barrio, municipio
-- y el punto en el mapa), pero no había dónde decir "apartamento 302, segundo
-- piso" o "el timbre no sirve, llamar al llegar". Eso terminaba metido dentro de
-- `address_line` —que Mapbox sobrescribe al elegir una sugerencia en el mapa— o
-- simplemente no se decía, y el mensajero llegaba y llamaba.
--
-- No es solo un campo de texto: viaja a Pibox como `secondary_address` del
-- destino, que es el mismo campo con el que ya se le dice al conductor qué local
-- buscar dentro de la plaza en el origen.
--
-- Nullable y sin default: las direcciones que ya existen quedan en NULL, que es
-- lo correcto (nadie las escribió) y no invalida ninguna.

alter table public.delivery_addresses
  add column if not exists delivery_instructions text;

comment on column public.delivery_addresses.delivery_instructions is
  'Indicaciones del comprador para llegar a la puerta (piso, apartamento, punto de referencia). Viaja a Pibox como secondary_address del destino.';
