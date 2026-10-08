-- La dirección de entrega se marca en el mapa y lleva indicaciones.
--
-- Lo que lleva al mensajero a la puerta es el punto en el mapa, y lo que el
-- mapa no sabe —piso, apartamento, portón— son las indicaciones. Los textos
-- (dirección, barrio, municipio, departamento) los llena el mapa solo y se
-- siguen guardando: Pibox, la copia de cada pedido y las pantallas del tendero
-- los usan. Ninguna columna se elimina.
--
-- Por qué un trigger y no un `check ... not valid`: un check sin validar no
-- revisa las filas viejas al crearse, pero sí cada vez que se actualizan, por
-- cualquier columna. Al crear una dirección predeterminada la API desmarca las
-- demás del comprador (`update ... set is_default = false`), y eso fallaría en
-- las direcciones viejas sin indicaciones. El trigger solo revisa al crear una
-- dirección o al cambiar sus datos de ubicación.

-- Mismo mínimo que `MIN_DELIVERY_INSTRUCTIONS` en lib/addresses/limits.ts.
create or replace function public.fn_delivery_address_requires_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.latitude is null or new.longitude is null then
    raise exception 'Marca la ubicación de la dirección en el mapa.'
      using errcode = 'check_violation';
  end if;

  if length(btrim(coalesce(new.delivery_instructions, ''))) < 10 then
    raise exception 'Escribe las indicaciones para la entrega (mínimo 10 caracteres).'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.fn_delivery_address_requires_location() is
  'Exige punto en el mapa e indicaciones al crear una dirección o al cambiar sus datos de ubicación. Las direcciones anteriores siguen sirviendo mientras no se editen.';

create trigger delivery_addresses_requires_location
  before insert or update of address_line, neighborhood, municipality, department,
    latitude, longitude, delivery_instructions
  on public.delivery_addresses
  for each row
  execute function public.fn_delivery_address_requires_location();

comment on column public.delivery_addresses.address_line is
  'La llena el mapa (Mapbox) al marcar el punto; el comprador puede corregirla.';
comment on column public.delivery_addresses.latitude is
  'Punto marcado en el mapa. Obligatorio desde 2026-10 para direcciones nuevas o editadas.';
