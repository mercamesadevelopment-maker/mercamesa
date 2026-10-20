-- Primer cierre de seguridad (revisión de la base, 20 de octubre de 2026).
--
-- Catorce tablas de `public` no tienen RLS, así que valen los permisos que
-- Supabase da por defecto: `anon` y `authenticated` pueden leer y escribir todo.
-- La llave `anon` es pública (va en el navegador) y cualquiera puede registrarse
-- como comprador, así que en la práctica cualquiera podía marcar un pago como
-- aprobado o cambiar un pedido ajeno.
--
-- Esta migración quita lo que ninguna pantalla usa. La RLS de esas tablas va en
-- una migración posterior.

-- 1. Con la llave pública no se escribe nada en ninguna tabla. Las pantallas
--    sin sesión solo leen (vitrina, plazas, tiendas, ofertas); lo demás pasa por
--    el servidor.
revoke insert, update, delete, truncate on all tables in schema public from anon;
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate on tables from anon;

-- 2. Sin sesión tampoco se leen pedidos, pagos, direcciones ni invitaciones.
revoke select on
  public.orders,
  public.order_items,
  public.store_orders,
  public.payments,
  public.delivery_addresses,
  public.invitations,
  public.marketplace_members,
  public.marketplace_delivery_users,
  public.orders_detail_view
from anon;

-- 3. Una sesión no escribe pedidos, pagos ni el historial de estados. Crear el
--    pedido, cambiar su estado y registrar el pago lo hace el servidor después de
--    comprobar quién pregunta (`/api/orders`, `/api/store-orders/[id]/status`,
--    ZonaPagos). Las funciones y triggers que escriben en estas tablas son
--    `security definer` y no dependen de estos permisos.
revoke insert, update, delete, truncate on
  public.orders,
  public.order_items,
  public.store_orders,
  public.payments,
  public.store_order_status_history
from authenticated;

-- 4. Las dos funciones `security definer` que no fijaban `search_path`.
alter function public.fn_process_store_order_status_change() set search_path = public;
alter function public.update_store_reputation() set search_path = public;
