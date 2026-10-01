-- Que aprobar el pago descuente el stock.
--
-- El descuento lo hace `fn_process_store_order_status_change`, un trigger sobre
-- **store_orders**. Pero al aprobarse un pago solo se actualiza **orders**
-- (`app/api/zonapagos-callback/route.ts`, y las edge functions `zonapagos-sync`
-- y `zonapagos-sonda`). Como no hay nada que propague el estado de una tabla a
-- la otra, el trigger nunca disparaba: el stock solo bajaba cuando una persona
-- movía el pedido a mano desde el panel.
--
-- Mientras tanto el producto seguía figurando disponible aunque ya estuviera
-- pagado, y se podía vender dos veces.
--
-- Va como trigger de base y no como parche en la ruta a propósito: hay TRES
-- caminos que aprueban un pago (callback, sync y sonda). Arreglarlo acá los
-- cubre todos a la vez y no se puede olvidar en el siguiente.

create or replace function public.fn_confirm_store_orders_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.payment_status = 'approved'
     and OLD.payment_status is distinct from 'approved' then

    -- Solo los que siguen pendientes. Si alguien ya adelantó el pedido a mano,
    -- su stock ya se descontó y volver a tocarlo lo descontaría dos veces.
    update public.store_orders
    set status = 'confirmed'
    where order_id = NEW.id
      and status = 'pending';
  end if;

  return NEW;
end;
$$;

comment on function public.fn_confirm_store_orders_on_payment() is
  'Al aprobarse el pago, pasa los store_orders pendientes a confirmed. Es lo que dispara fn_process_store_order_status_change y con ello el descuento de stock.';

drop trigger if exists trg_confirm_store_orders_on_payment on public.orders;

-- AFTER UPDATE OF payment_status, no INSERT: las ventas en sitio ya nacen con el
-- pago aprobado y su `store_orders` en 'delivered', así que su stock lo descuenta
-- el trigger existente al insertar. Un trigger de INSERT acá las descontaría dos
-- veces.
create trigger trg_confirm_store_orders_on_payment
after update of payment_status on public.orders
for each row
execute function public.fn_confirm_store_orders_on_payment();

-- Sobre el stock negativo: NO se agrega un CHECK `stock >= 0`.
--
-- Es tentador, pero el descuento ocurre dentro de la transacción que aprueba el
-- pago. Un CHECK abortaría esa transacción, y quedaría un pago cobrado de verdad
-- en la pasarela con la orden sin actualizar en la plataforma — un fallo callado
-- y mucho peor que un inventario en negativo, que al menos se ve y se concilia.
--
-- Lo que sí evita el problema de raíz es validar las existencias ANTES de crear
-- la orden, que es lo que ahora hace `app/api/orders/route.ts` (409 con el
-- detalle de qué falta). Quedan expuestos únicamente los pedidos creados antes de
-- esa validación: hay al menos uno (10 unidades pedidas con 9 en inventario) que
-- dejaría el stock en -1 si se llegara a aprobar su pago.
