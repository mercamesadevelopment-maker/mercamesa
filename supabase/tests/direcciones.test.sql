-- Una dirección nueva o editada lleva punto en el mapa e indicaciones; las
-- direcciones viejas siguen funcionando mientras no se toque su ubicación.
-- Migración: 20261009000000_direccion_desde_el_mapa.sql

begin;
\ir _helpers/fixtures.inc
select plan(5);

select throws_ok(
  $$ insert into public.delivery_addresses (buyer_id, address_line, delivery_instructions)
     values ('00000000-0000-0000-0000-000000000001', 'Calle 1', 'Torre 2, apto 301') $$,
  '23514', null, 'sin punto en el mapa no se crea');

select throws_ok(
  $$ insert into public.delivery_addresses (buyer_id, address_line, latitude, longitude, delivery_instructions)
     values ('00000000-0000-0000-0000-000000000001', 'Calle 1', 4.65, -74.05, 'casa') $$,
  '23514', null, 'con indicaciones de menos de 10 caracteres no se crea');

select lives_ok(
  $$ insert into public.delivery_addresses (id, buyer_id, address_line, latitude, longitude, delivery_instructions)
     values ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000001',
             'Calle 1', 4.65, -74.05, 'Torre 2, apto 301') $$,
  'con punto e indicaciones se crea');

-- Una dirección vieja, sin punto ni indicaciones (como las de producción).
alter table public.delivery_addresses disable trigger delivery_addresses_requires_location;
insert into public.delivery_addresses (id, buyer_id, address_line, is_default)
values ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'Calle vieja', true);
alter table public.delivery_addresses enable trigger delivery_addresses_requires_location;

select lives_ok(
  $$ update public.delivery_addresses set is_default = false
     where id = '00000000-0000-0000-0000-000000000301' $$,
  'desmarcar una dirección vieja como predeterminada no falla');

select throws_ok(
  $$ update public.delivery_addresses set address_line = 'Calle vieja 2'
     where id = '00000000-0000-0000-0000-000000000301' $$,
  '23514', null, 'pero editar su ubicación sí exige el punto');

select * from finish();
rollback;
