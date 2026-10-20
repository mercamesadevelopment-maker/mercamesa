-- Dos tablas de equipo de plaza que nunca se usaron, y el precio mínimo de
-- compra dentro del historial de tarifas.


-- 1. Equipo de una plaza
--
-- `marketplace_staff` ya modela a una persona con un rol en una plaza (patinador,
-- logística). `marketplace_members` y `marketplace_delivery_users` eran intentos
-- anteriores de lo mismo: ningún código las lee ni las escribe y están vacías.
-- Si alguna tuviera filas, la migración se detiene en vez de borrarlas.
do $$
begin
  if exists (select 1 from public.marketplace_members)
     or exists (select 1 from public.marketplace_delivery_users) then
    raise exception 'marketplace_members o marketplace_delivery_users tienen filas: pasarlas a marketplace_staff antes de borrarlas';
  end if;
end
$$;

drop table public.marketplace_members;
drop table public.marketplace_delivery_users;


-- 2. El precio mínimo de compra, en el historial de tarifas
--
-- Cada fila de `pricing_settings_history` pasa a ser la configuración completa
-- de un momento: tarifas y mínimo. Un ajuste del mínimo es una fila nueva que
-- repite las tarifas vigentes, y uno de tarifas repite el mínimo. `change_type`
-- dice qué se ajustó, para que cada pestaña de Parametrización muestre solo
-- su historial. El valor por defecto es para las filas que ya existen y para
-- la copia de producción que cargan local y staging; las rutas lo ponen siempre.
alter table public.pricing_settings_history
  add column order_min_price numeric(12,2)
    constraint pricing_settings_history_order_min_price_check check (order_min_price >= 0),
  add column change_type text not null default 'rates'
    constraint pricing_settings_history_change_type_check check (change_type in ('rates', 'order_min_price'));

comment on column public.pricing_settings_history.order_min_price is
  'Valor mínimo de los productos de un pedido. Null: no hay mínimo.';
comment on column public.pricing_settings_history.change_type is
  'Qué se ajustó en esta fila: las tarifas (rates) o el mínimo de compra (order_min_price). Lo demás se copia de la fila anterior.';

-- Pasa el historial de `order_min_price_history` a esta tabla. Es una función y
-- no un bloque suelto porque las migraciones corren antes de cargar los datos:
-- en local y en staging la vuelve a llamar `supabase/seed/post.sql` después de
-- la copia de producción. Solo corre una vez: si ya hay un mínimo, no hace nada.
--
-- Los ajustes del mínimo anteriores a la primera tarifa no tienen tarifas que
-- repetir: no entran como filas, pero su valor queda en la primera tarifa.
create function public.copiar_precio_minimo_al_historial() returns void
    language plpgsql
    set search_path to 'public'
    as $$
begin
  if to_regclass('public.order_min_price_history') is null then
    return;
  end if;
  if exists (select 1 from pricing_settings_history where order_min_price is not null) then
    return;
  end if;

  -- Cada tarifa lleva el mínimo que estaba vigente cuando se registró.
  update pricing_settings_history p
  set order_min_price = (
    select m.min_price from order_min_price_history m
    where m.created_at <= p.created_at
    order by m.created_at desc
    limit 1
  );

  -- Cada ajuste del mínimo es una fila con las tarifas de ese momento.
  insert into pricing_settings_history (
    service_commission_rate, message_unit_price, messages_per_order, platform_commission_rate,
    siigo_delivery_product_code, siigo_platform_product_code,
    order_min_price, change_type, notes, changed_by, created_at)
  select
    p.service_commission_rate, p.message_unit_price, p.messages_per_order, p.platform_commission_rate,
    p.siigo_delivery_product_code, p.siigo_platform_product_code,
    m.min_price, 'order_min_price', m.notes, m.changed_by, m.created_at
  from order_min_price_history m
  cross join lateral (
    select * from pricing_settings_history t
    where t.created_at <= m.created_at
    order by t.created_at desc
    limit 1
  ) p;
end;
$$;

revoke all on function public.copiar_precio_minimo_al_historial() from public, anon, authenticated;

select public.copiar_precio_minimo_al_historial();

-- La tabla vieja se queda hasta que el código nuevo esté publicado: entre esta
-- migración y el despliegue de Vercel, el código anterior todavía la lee. La
-- borra una migración posterior, junto con la función de arriba.
comment on table public.order_min_price_history is
  'En desuso: el mínimo vive en pricing_settings_history.order_min_price. Se borra en una migración posterior.';
