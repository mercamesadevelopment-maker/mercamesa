-- Código de pedido legible para el usuario final.
--
-- Hasta ahora cada pantalla identificaba el mismo pedido de una forma distinta:
-- el comprador veía 8 caracteres del UUID de `orders`, el vendedor 8 caracteres
-- del UUID de `store_orders`, el admin el UUID completo y el historial de ventas
-- el `consecutive`. Ninguno de esos identificadores es citable entre roles ni
-- dictable por teléfono, así que soporte no podía cruzar un reclamo del
-- comprador con el panel del vendedor.
--
-- Se persiste un único código con este formato:
--
--   orders.code        MM-2026-001017     -> la compra completa
--   store_orders.code  MM-2026-001017-1   -> la parte que le toca a cada tienda
--
-- MM es el prefijo de marca, el año sale de created_at en hora de Colombia y el
-- número es `orders.consecutive` (identity que ya existía, hoy en 1001..1017)
-- rellenado a 6 dígitos. El consecutivo NO se reinicia cada año: el año es
-- contexto visual para el lector y la unicidad la garantiza el consecutivo, así
-- se evita tener que coordinar un reinicio anual y se conserva el orden
-- cronológico global.
--
-- Todo lo visible en la aplicación es el código del `store_order`, porque cada
-- tarjeta de pedido (comprador, vendedor y admin por igual) representa la parte
-- de una tienda, no la compra completa.

-- Nullables en este punto para poder rellenar los pedidos existentes; al final
-- del archivo pasan a not null.
alter table public.orders add column code text;
alter table public.store_orders add column split_index integer;
alter table public.store_orders add column code text;

comment on column public.orders.code is
  'Codigo legible de la compra completa, formato MM-AAAA-NNNNNN (ej. MM-2026-001017). Derivado de consecutive. Lo asigna el trigger set_order_code; no se escribe desde la aplicacion.';

comment on column public.store_orders.split_index is
  'Posicion de esta tienda dentro de la compra (1, 2, 3...). Solo sirve para construir el sufijo del codigo.';

comment on column public.store_orders.code is
  'Codigo legible del pedido tal como lo ven comprador, vendedor y admin: el codigo de la compra mas el sufijo de la tienda (ej. MM-2026-001017-1). Lo asigna el trigger set_store_order_code.';

-- El código se arma en un trigger y no en una columna generada porque
-- `created_at at time zone 'America/Bogota'` es STABLE (depende del catálogo de
-- zonas horarias) y Postgres solo admite expresiones IMMUTABLE en columnas
-- generadas. Cuando corre un trigger BEFORE ROW los valores por defecto ya están
-- resueltos, así que `consecutive` (identity) y `created_at` ya tienen valor.
create or replace function public.set_order_code()
returns trigger
language plpgsql
as $$
begin
  new.code := 'MM-'
    || to_char(new.created_at at time zone 'America/Bogota', 'YYYY')
    || '-' || lpad(new.consecutive::text, 6, '0');
  return new;
end;
$$;

create trigger orders_set_code
  before insert on public.orders
  for each row
  execute function public.set_order_code();

-- El sufijo por tienda se asigna contando las tiendas ya insertadas para esa
-- compra. El `for update` sobre la fila padre serializa a los inserts del mismo
-- pedido: sin ese bloqueo, un checkout que inserta varias tiendas en paralelo
-- podría calcular el mismo split_index dos veces y chocar contra el índice
-- único. Pedidos distintos no se estorban porque cada uno bloquea su propia fila.
create or replace function public.set_store_order_code()
returns trigger
language plpgsql
as $$
declare
  parent_code text;
begin
  select o.code into parent_code
  from public.orders o
  where o.id = new.order_id
  for update;

  if parent_code is null then
    raise exception 'La orden % no tiene codigo asignado', new.order_id;
  end if;

  new.split_index := coalesce(
    (select max(so.split_index)
       from public.store_orders so
      where so.order_id = new.order_id),
    0
  ) + 1;

  new.code := parent_code || '-' || new.split_index;

  return new;
end;
$$;

create trigger store_orders_set_code
  before insert on public.store_orders
  for each row
  execute function public.set_store_order_code();

-- Relleno de los pedidos que ya existían (17 al momento de esta migración).
update public.orders
set code = 'MM-'
  || to_char(created_at at time zone 'America/Bogota', 'YYYY')
  || '-' || lpad(consecutive::text, 6, '0')
where code is null;

-- El orden histórico de las tiendas dentro de una compra se reconstruye por
-- fecha de creación, con el id como desempate para que el resultado sea estable
-- si dos filas comparten el mismo timestamp.
update public.store_orders so
set split_index = numbered.split_index,
    code = numbered.parent_code || '-' || numbered.split_index
from (
  select prev.id,
         o.code as parent_code,
         row_number() over (
           partition by prev.order_id order by prev.created_at, prev.id
         ) as split_index
  from public.store_orders prev
  join public.orders o on o.id = prev.order_id
) as numbered
where numbered.id = so.id
  and so.code is null;

alter table public.orders alter column code set not null;
alter table public.store_orders alter column split_index set not null;
alter table public.store_orders alter column code set not null;

create unique index orders_code_key on public.orders (code);
create unique index store_orders_code_key on public.store_orders (code);
