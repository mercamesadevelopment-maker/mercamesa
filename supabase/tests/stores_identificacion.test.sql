-- La identificación de la tienda (NIT, cédula…).
-- Migración: 20261122150000_stores_identificacion.sql

begin;
\ir _helpers/fixtures.inc
select plan(6);

-- En el CI la base no trae tipos de identificación: se crea uno.
insert into public.identification_types (id, name, code, slug)
values ('00000000-0000-0000-0000-000000000800', 'NIT de prueba', 'NITP', 'nit-prueba');

select lives_ok(
  $$update public.stores
       set identification_type_id = '00000000-0000-0000-0000-000000000800', document_number = '900123456', document_dv = '8'
     where id = '00000000-0000-0000-0000-000000000101'$$,
  'una tienda guarda su tipo, número y dígito de verificación'
);

select throws_ok(
  $$update public.stores set identification_type_id = null where id = '00000000-0000-0000-0000-000000000101'$$,
  '23514', null,
  'un número no queda sin su tipo'
);

select throws_ok(
  $$update public.stores set document_dv = '12' where id = '00000000-0000-0000-0000-000000000101'$$,
  '23514', null,
  'el dígito de verificación es un solo dígito'
);

select throws_ok(
  $$update public.stores set document_number = '123' where id = '00000000-0000-0000-0000-000000000101'$$,
  '23514', null,
  'un número demasiado corto no se guarda'
);

select throws_ok(
  $$delete from public.identification_types where id = '00000000-0000-0000-0000-000000000800'$$,
  '23503', null,
  'no se puede borrar un tipo que una tienda usa'
);

select lives_ok(
  $$update public.stores set identification_type_id = null, document_number = null, document_dv = null
     where id = '00000000-0000-0000-0000-000000000101'$$,
  'la identificación se puede borrar entera'
);

select * from finish();
rollback;
