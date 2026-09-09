-- Versiona el trigger de stock que hasta ahora solo existía en la base.
--
-- `fn_process_store_order_status_change` es lo que descuenta y reingresa el
-- inventario, pero fue creado directamente en el proyecto remoto y no estaba en
-- `supabase/migrations/`. Eso significa que un entorno nuevo levantado desde las
-- migraciones NO descontaría stock, y nadie se enteraría hasta auditar el
-- inventario.
--
-- Esta migración no cambia el comportamiento: es la definición vigente, copiada
-- tal cual desde la base, para que el repositorio pueda reproducirla.

create or replace function public.fn_process_store_order_status_change()
returns trigger
language plpgsql
security definer
as $function$
DECLARE
    item_record RECORD;
    is_new_confirmed BOOLEAN;
    is_new_cancelled BOOLEAN;
BEGIN
    -- Detectar si la orden entra a un estado que requiere descuento de stock
    IF TG_OP = 'INSERT' THEN
        is_new_confirmed := (NEW.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
        is_new_cancelled := false;
    ELSE -- TG_OP = 'UPDATE'
        is_new_confirmed := (NEW.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'))
                            AND (OLD.status NOT IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
        is_new_cancelled := (NEW.status IN ('cancelled', 'returned'))
                            AND (OLD.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
    END IF;

    -- A) DESCONTAR STOCK (Crear movimiento de salida)
    IF is_new_confirmed THEN
        FOR item_record IN
            SELECT oi.store_product_id, oi.quantity, sp.store_id
            FROM public.order_items oi
            JOIN public.store_products sp ON sp.id = oi.store_product_id
            WHERE oi.order_id = NEW.order_id AND sp.store_id = NEW.store_id
        LOOP
            INSERT INTO public.product_stock_movements (
                store_product_id, store_id, type, quantity,
                reference_id, reference_type, notes
            ) VALUES (
                item_record.store_product_id,
                item_record.store_id,
                'exit',
                item_record.quantity,
                NEW.id,
                'order',
                'Salida automática por confirmación de pedido #' || NEW.order_id
            );

            UPDATE public.store_products
            SET stock = stock - item_record.quantity
            WHERE id = item_record.store_product_id;
        END LOOP;

    -- B) RESTAURAR STOCK (Crear movimiento de entrada)
    ELSIF is_new_cancelled THEN
        FOR item_record IN
            SELECT oi.store_product_id, oi.quantity, sp.store_id
            FROM public.order_items oi
            JOIN public.store_products sp ON sp.id = oi.store_product_id
            WHERE oi.order_id = NEW.order_id AND sp.store_id = NEW.store_id
        LOOP
            INSERT INTO public.product_stock_movements (
                store_product_id, store_id, type, quantity,
                reference_id, reference_type, notes
            ) VALUES (
                item_record.store_product_id,
                item_record.store_id,
                'entry',
                item_record.quantity,
                NEW.id,
                'order',
                'Reingreso automático por cancelación de pedido #' || NEW.order_id
            );

            UPDATE public.store_products
            SET stock = stock + item_record.quantity
            WHERE id = item_record.store_product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;

drop trigger if exists trg_store_order_status_change on public.store_orders;

create trigger trg_store_order_status_change
after insert or update of status on public.store_orders
for each row
execute function public.fn_process_store_order_status_change();
