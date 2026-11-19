-- Un caso o un mensaje del chat de Meteor con la misma llave no se duplica; la
-- misma llave de otra persona, o sin llave (la app), sí entra.
-- Migración: 20261119150000_pqrs_idempotencia_chat.sql

begin;
\ir _helpers/fixtures.inc
select plan(7);

insert into public.pqrs (id, kind, reason, opened_by, opened_as, subject, description, status, client_idempotency_key)
values ('00000000-0000-0000-0000-000000000c01', 'peticion', 'peticion', '00000000-0000-0000-0000-000000000001', 'buyer',
        'Petición', 'Necesito la factura del pedido.', 'in_review', 'llave-del-chat-1');

select throws_ok(
  $$insert into public.pqrs (kind, reason, opened_by, opened_as, subject, description, status, client_idempotency_key)
    values ('peticion', 'peticion', '00000000-0000-0000-0000-000000000001', 'buyer', 'Petición', 'Otra vez lo mismo.', 'in_review', 'llave-del-chat-1')$$,
  '23505', null, 'la misma llave de la misma persona no radica otro caso');

select lives_ok(
  $$insert into public.pqrs (kind, reason, opened_by, opened_as, subject, description, status, client_idempotency_key)
    values ('peticion', 'peticion', '00000000-0000-0000-0000-000000000004', 'buyer', 'Petición', 'Otra persona.', 'in_review', 'llave-del-chat-1')$$,
  'la misma llave de otra persona sí entra');

select lives_ok(
  $$insert into public.pqrs (kind, reason, opened_by, opened_as, subject, description, status)
    values ('peticion', 'peticion', '00000000-0000-0000-0000-000000000001', 'buyer', 'Petición', 'Desde la app.', 'in_review'),
           ('peticion', 'peticion', '00000000-0000-0000-0000-000000000001', 'buyer', 'Petición', 'Desde la app, otra.', 'in_review')$$,
  'sin llave (desde la app) no hay restricción');

select throws_ok(
  $$insert into public.pqrs (kind, reason, opened_by, opened_as, subject, description, status, client_idempotency_key)
    values ('peticion', 'peticion', '00000000-0000-0000-0000-000000000001', 'buyer', 'Petición', 'Llave corta.', 'in_review', 'corta')$$,
  '23514', null, 'una llave de menos de 8 caracteres no se acepta');

insert into public.pqrs_messages (pqrs_id, author_id, author_as, body, client_idempotency_key)
values ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000001', 'buyer', 'Adjunto la foto.', 'mensaje-del-chat-1');

select throws_ok(
  $$insert into public.pqrs_messages (pqrs_id, author_id, author_as, body, client_idempotency_key)
    values ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000001', 'buyer', 'Adjunto la foto.', 'mensaje-del-chat-1')$$,
  '23505', null, 'el mismo mensaje con la misma llave no se repite');

select lives_ok(
  $$insert into public.pqrs_messages (pqrs_id, author_id, author_as, body)
    values ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000001', 'buyer', 'Sin llave.'),
           ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000001', 'buyer', 'Sin llave.')$$,
  'los mensajes de la app, sin llave, no chocan');

select is((select count(*)::int from public.pqrs_messages where pqrs_id = '00000000-0000-0000-0000-000000000c01'),
  3, 'quedan el mensaje del chat y los dos de la app');

select * from finish();
rollback;
