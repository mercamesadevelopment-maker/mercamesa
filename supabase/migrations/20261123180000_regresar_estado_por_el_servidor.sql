-- Regresar el estado de una parte pasa por el servidor.
--
-- Antes la pantalla llamaba `revert_store_order_status` directo desde el
-- navegador, y la función solo cambiaba el estado: si la parte ya tenía un
-- mensajero pedido en Pibox, la reserva seguía viva. En MM-2026-001100 (22 de
-- noviembre) la tienda cerró, se regresó la parte a «Empacando» y aun así
-- llegaron tres conductores. Ahora la ruta `POST /api/store-orders/[id]/revert`
-- cancela la reserva y después llama esta función con el cliente de servicio.
--
-- Como el cliente de servicio no trae `auth.uid()`, quién regresa el pedido
-- llega en `p_actor`, y la función valida con ese id lo mismo que antes. Solo la
-- ejecuta `service_role`: nadie se salta la cancelación del mensajero llamándola
-- desde el navegador.

drop function if exists public.revert_store_order_status(uuid, public.order_status, text);

create or replace function public.revert_store_order_status(
  p_store_order_id uuid,
  p_target_status public.order_status,
  p_notes text,
  p_actor uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_current public.order_status;
  v_liquidado boolean := false;
begin
  if p_actor is null then
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

  if not (
    exists (
      select 1 from store_members sm
       where sm.store_id = v_store_id and sm.user_id = p_actor
    )
    or exists (
      select 1
        from profiles p
        join roles r on r.id = p.role_id
       where p.id = p_actor
         and p.is_active
         and r.name in ('admin', 'superadmin')
    )
  ) then
    raise exception 'No tienes permiso para modificar este pedido.' using errcode = '42501';
  end if;

  if p_target_status = v_current then
    raise exception 'El pedido ya está en ese estado.' using errcode = '22023';
  end if;

  if p_target_status <> 'pending' and not exists (
    select 1
      from store_order_status_history
     where store_order_id = p_store_order_id
       and status = p_target_status
  ) then
    raise exception 'Solo puedes regresar a un estado por el que el pedido ya pasó.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
      from payout_items pi
      join payouts po on po.id = pi.payout_id
     where pi.store_order_id = p_store_order_id
       and po.status <> 'cancelled'
  ) into v_liquidado;

  if v_liquidado then
    raise exception 'El pedido ya está incluido en una dispersión; anula la dispersión antes de regresarlo.'
      using errcode = '22023';
  end if;

  update store_orders
     set status = p_target_status
   where id = p_store_order_id;

  insert into store_order_status_history (store_order_id, status, notes, changed_by, is_reversal)
  values (p_store_order_id, p_target_status, trim(p_notes), p_actor, true);
end;
$$;

comment on function public.revert_store_order_status(uuid, public.order_status, text, uuid) is
  'Regresa un store_order a un estado por el que ya pasó, con observación obligatoria. Solo miembros de la tienda o admin (p_actor). La llama el servidor, que antes cancela el mensajero de Pibox si hace falta.';

revoke all on function public.revert_store_order_status(uuid, public.order_status, text, uuid) from public, anon, authenticated;
grant execute on function public.revert_store_order_status(uuid, public.order_status, text, uuid) to service_role;
