-- Un caso o un mensaje que llega por el chat de Meteor (`registrar_caso`,
-- `agregar_a_caso`) trae una llave de idempotencia: si la red falla y Meteor
-- reintenta, la misma llave devuelve el mismo caso o el mismo mensaje en vez de
-- radicar otro.
--
-- La llave es de quien escribe: dos personas pueden usar la misma sin chocar.
-- Lo que se crea desde la app no la trae (`null`) y no la necesita: ahí el
-- botón se deshabilita mientras guarda.

alter table public.pqrs
  add column client_idempotency_key text
    constraint pqrs_client_idempotency_key_largo check (char_length(client_idempotency_key) between 8 and 120);

create unique index pqrs_idempotencia_unica
  on public.pqrs (opened_by, client_idempotency_key)
  where client_idempotency_key is not null;

alter table public.pqrs_messages
  add column client_idempotency_key text
    constraint pqrs_messages_client_idempotency_key_largo check (char_length(client_idempotency_key) between 8 and 120);

create unique index pqrs_messages_idempotencia_unica
  on public.pqrs_messages (author_id, client_idempotency_key)
  where client_idempotency_key is not null;

comment on column public.pqrs.client_idempotency_key is
  'Llave de idempotencia del chat de Meteor: la misma llave de la misma persona devuelve el mismo caso.';
comment on column public.pqrs_messages.client_idempotency_key is
  'Llave de idempotencia del chat de Meteor: la misma llave de la misma persona devuelve el mismo mensaje.';
