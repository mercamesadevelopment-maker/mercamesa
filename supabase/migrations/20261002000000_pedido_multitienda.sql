-- Pedido multitienda: varias tiendas de una misma plaza en un solo pedido.
--
-- El modelo ya lo permitía —un `orders` tiene N `store_orders`— pero nada decía
-- QUÉ tiendas se pueden juntar. La regla es física: comparten pedido las que
-- comparten punto de recogida, porque de ahí sale un solo domicilio.

-- ---------------------------------------------------------------------------
-- Punto de recogida de cada tienda
-- ---------------------------------------------------------------------------
-- Una tienda sin dirección propia despacha desde su plaza; una con dirección
-- propia despacha desde ahí y no comparte bahía con nadie. Es la misma decisión
-- que toma `resolverOrigen` (lib/pibox) al pedir el mensajero.
--
-- Va como columna generada para que el carrito pueda leerla sin leer la
-- dirección de la tienda, y para que navegador y servidor no puedan discrepar.
alter table public.stores
  add column pickup_group text generated always as (
    case
      when nullif(btrim(address), '') is null then 'plaza:' || marketplace_id::text
      else 'tienda:' || id::text
    end
  ) stored;

comment on column public.stores.pickup_group is
  'Punto de recogida. Dos tiendas pueden ir en el mismo pedido solo si tienen el mismo valor.';

-- ---------------------------------------------------------------------------
-- Quién lleva el pedido hasta el mensajero
-- ---------------------------------------------------------------------------
-- `store`: una sola tienda; ella misma pide el mensajero al marcar «Listo
-- Recogida», como siempre.
-- `runner`: varias tiendas; un patinador recoge en cada una, junta todo en la
-- bahía y ahí se pide un solo mensajero.
alter table public.orders
  add column fulfillment text not null default 'store'
    constraint orders_fulfillment_check check (fulfillment in ('store', 'runner'));

comment on column public.orders.fulfillment is
  'store: la tienda pide el mensajero. runner: lo junta un patinador en la bahía (pedidos de varias tiendas).';
