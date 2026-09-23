-- Regresar un pedido de tienda a un estado anterior, para casos extremos.
--
-- El flujo normal solo avanza (`updateStoreOrderStatus`). Cuando alguien marca
-- "Entregado" por error, o hay que reabrir un pedido cancelado, no había forma de
-- corregirlo sin tocar la base a mano y sin dejar rastro.
--
-- Va como función y no como update + insert desde el navegador porque las dos
-- escrituras tienen que ser atómicas, y las reglas (a qué estado se puede volver,
-- quién puede hacerlo) no pueden depender del cliente.

alter table public.store_order_status_history
  add column if not exists is_reversal boolean not null default false;

comment on column public.store_order_status_history.is_reversal is
  'true cuando la fila la creó revert_store_order_status: una corrección manual, no un avance del flujo.';

create or replace function public.revert_store_order_status(
  p_store_order_id uuid,
  p_target_status public.order_status,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_current public.order_status;
  v_liquidado boolean := false;
begin
  if auth.uid() is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_notes), '') = '' then
    raise exception 'La observación es obligatoria para regresar un pedido de estado.'
      using errcode = '22023';
  end if;

  select store_id, status
    into v_store_id, v_current
    from store_orders
   where id = p_store_order_id
     for update;

  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;

  -- `store_orders` no tiene RLS: este es el único control de acceso. Mismo
  -- criterio que `lib/auth/can-manage-store.ts`: pertenecer a la tienda o ser admin.
  if not (
    is_store_member(v_store_id)
    or exists (
      select 1
        from profiles p
        join roles r on r.id = p.role_id
       where p.id = auth.uid()
         and p.is_active
         and r.name in ('admin', 'superadmin')
    )
  ) then
    raise exception 'No tienes permiso para modificar este pedido.' using errcode = '42501';
  end if;

  if p_target_status = v_current then
    raise exception 'El pedido ya está en ese estado.' using errcode = '22023';
  end if;

  -- Solo se vuelve a un estado por el que el pedido ya pasó. `pending` se acepta
  -- siempre: es el estado con el que nace y el historial puede no tenerlo.
  if p_target_status <> 'pending' and not exists (
    select 1
      from store_order_status_history
     where store_order_id = p_store_order_id
       and status = p_target_status
  ) then
    raise exception 'Solo puedes regresar a un estado por el que el pedido ya pasó.'
      using errcode = '22023';
  end if;

  -- Un pedido ya incluido en una liquidación vigente no se toca: el dinero ya se
  -- calculó (o se giró) sobre él. Se consulta con SQL dinámico porque la tabla
  -- de dispersiones puede no existir en un entorno levantado sin ese módulo.
  if to_regclass('public.payout_items') is not null then
    execute
      'select exists (
         select 1
           from public.payout_items pi
           join public.payouts po on po.id = pi.payout_id
          where pi.store_order_id = $1
            and po.status <> ''cancelled''
       )'
      into v_liquidado
      using p_store_order_id;

    if v_liquidado then
      raise exception 'El pedido ya está incluido en una dispersión; anula la dispersión antes de regresarlo.'
        using errcode = '22023';
    end if;
  end if;

  update store_orders
     set status = p_target_status
   where id = p_store_order_id;

  insert into store_order_status_history (store_order_id, status, notes, changed_by, is_reversal)
  values (p_store_order_id, p_target_status, trim(p_notes), auth.uid(), true);
end;
$$;

comment on function public.revert_store_order_status(uuid, public.order_status, text) is
  'Regresa un store_order a un estado por el que ya pasó, con observación obligatoria. Solo miembros de la tienda o admin.';

revoke all on function public.revert_store_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.revert_store_order_status(uuid, public.order_status, text) to authenticated;

-- Reingreso de stock al volver a 'pending'.
--
-- El trigger solo devolvía inventario al cancelar o devolver. Con la reversión,
-- un pedido puede pasar de Confirmado (stock ya descontado) a Nuevo; sin este
-- ajuste el stock quedaría descontado, y al confirmarlo otra vez se descontaría
-- una segunda vez. Resto idéntico a 20260909025000_version_existing_stock_trigger.sql.
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
        is_new_cancelled := (NEW.status IN ('cancelled', 'returned', 'pending'))
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
                CASE
                    WHEN NEW.status = 'pending'
                        THEN 'Reingreso automático por reversión a Nuevo del pedido #' || NEW.order_id
                    ELSE 'Reingreso automático por cancelación de pedido #' || NEW.order_id
                END
            );

            UPDATE public.store_products
            SET stock = stock + item_record.quantity
            WHERE id = item_record.store_product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$function$;
