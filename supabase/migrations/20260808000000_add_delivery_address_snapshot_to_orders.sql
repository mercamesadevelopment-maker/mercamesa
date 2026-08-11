-- La dirección de entrega es parte del registro histórico del pedido: una vez
-- comprado, no debe cambiar porque el comprador edite su libreta de direcciones.
-- Hoy se arma por JOIN al momento de mostrarla, así que editar una dirección
-- reescribe retroactivamente el histórico de órdenes pasadas.
alter table public.orders
  add column delivery_address_snapshot jsonb;

comment on column public.orders.delivery_address_snapshot is
  'Copia congelada de la dirección al momento de comprar. delivery_address_id dice cuál eligió el comprador; esta columna dice a dónde se envió realmente.';

-- Con la copia guardada ya se puede permitir borrar una dirección sin perder el
-- histórico. Antes la FK era NO ACTION y el borrado fallaba con un error crudo
-- de Postgres que se le mostraba al usuario tal cual.
alter table public.orders
  drop constraint orders_delivery_address_id_fkey;

alter table public.orders
  add constraint orders_delivery_address_id_fkey
    foreign key (delivery_address_id)
    references public.delivery_addresses(id)
    on delete set null;

-- Backfill de las órdenes que sí tienen dirección, para que su histórico quede
-- correcto desde ya. Las que están en null no se pueden recuperar.
update public.orders o
set delivery_address_snapshot = jsonb_build_object(
  'label', d.label,
  'address_line', d.address_line,
  'neighborhood', d.neighborhood,
  'municipality', d.municipality,
  'department', d.department,
  'latitude', d.latitude,
  'longitude', d.longitude
)
from public.delivery_addresses d
where d.id = o.delivery_address_id
  and o.delivery_address_snapshot is null;
