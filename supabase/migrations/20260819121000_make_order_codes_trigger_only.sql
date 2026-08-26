-- `code` y `split_index` los llena un trigger, pero el generador de tipos de
-- Supabase solo mira el esquema: al verlos `not null` y sin default los declaró
-- obligatorios en el tipo `Insert`, obligando a la aplicación a mandar un valor
-- que en realidad no le corresponde calcular.
--
-- Se les da un default vacío para que el tipo generado los marque opcionales, y
-- acto seguido un `check` de formato que ese default nunca podría satisfacer.
-- Es decir: la aplicación no está obligada a mandarlos, y si por alguna razón el
-- trigger no llegara a ejecutarse, la fila es rechazada en vez de guardarse con
-- un código inválido. El default es un artefacto de tipado, no un valor válido.
alter table public.orders alter column code set default '';
alter table public.store_orders alter column code set default '';
alter table public.store_orders alter column split_index set default 0;

alter table public.orders
  add constraint orders_code_format
  check (code ~ '^MM-[0-9]{4}-[0-9]{6}$');

alter table public.store_orders
  add constraint store_orders_code_format
  check (code ~ '^MM-[0-9]{4}-[0-9]{6}-[0-9]+$');

alter table public.store_orders
  add constraint store_orders_split_index_positive
  check (split_index > 0);
