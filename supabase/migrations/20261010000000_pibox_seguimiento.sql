-- Seguimiento del domicilio de Pibox: quién puede leerlo y en qué orden se
-- aplican los eventos.

-- ---------------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------------
-- La política anterior era `using (true)`: cualquier usuario con sesión leía
-- todos los domicilios, incluido `raw`, que trae nombre, teléfono, correo y
-- dirección del comprador, el teléfono del conductor y los códigos de
-- validación. Ahora solo el comprador del pedido, los miembros de la tienda y
-- los administradores. Las pantallas no leen la tabla directo: pasan por
-- `GET /api/pibox/bookings`, que además recorta los campos según el rol.
drop policy if exists "pibox_bookings_select_policy" on public.pibox_bookings;

create policy "pibox_bookings_select_policy" on public.pibox_bookings
  for select to authenticated
  using (
    exists (
      select 1
        from public.store_orders so
        join public.orders o on o.id = so.order_id
       where so.id = pibox_bookings.store_order_id
         and (
           o.buyer_id = auth.uid()
           or public.is_store_member(so.store_id)
           or public.is_platform_admin()
         )
    )
  );

-- ---------------------------------------------------------------------------
-- Orden de los eventos
-- ---------------------------------------------------------------------------
-- Pibox no promete que los webhooks lleguen en orden. Sin esto, un «Paquete a
-- bordo» atrasado que llegara después de «Pedido finalizado» devolvía el
-- pedido de «Entregado» a «Despachado». Se guarda la fecha del último evento
-- aplicado y se descartan los anteriores.
alter table public.pibox_bookings
  add column last_event_at timestamptz;

comment on column public.pibox_bookings.last_event_at is
  'created_at del último evento de Pibox aplicado (webhook o consulta). Los eventos anteriores se descartan.';
