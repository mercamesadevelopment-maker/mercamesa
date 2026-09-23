-- Anonimizar a un comprador que pide la supresión de sus datos.
--
-- Borrar la fila de `profiles` no es una opción: 26 claves foráneas apuntan a
-- ella, `admin_user_actions.actor_id` es RESTRICT y `orders.buyer_id` es NO
-- ACTION, así que el borrado revienta en cuanto la persona haya comprado. Y lo
-- que sí se borraría en cascada es lo que hay que conservar —`legal_acceptances`,
-- la prueba de que aceptó los términos—, o sea que borrar destruye justamente la
-- evidencia que se necesita si esa persona reclama después.
--
-- La Ley 1581 de 2012 tampoco obliga a borrarlo todo: el derecho de supresión no
-- procede cuando hay un deber legal de permanecer en la base, y la facturación
-- ante la DIAN es ese caso. Se conserva el pedido y la factura, se suprime todo
-- lo demás.
--
-- Lo difícil no es `profiles`: los datos personales están en otros nueve
-- lugares, y el peor es la dirección congelada en cada pedido. Anonimizar el
-- perfil dejando esa dirección sería una anonimización aparente — con un pedido
-- se llega a la casa de la persona.

-- ---------------------------------------------------------------------------
-- 1. El permiso
--
-- El superadmin tenía `users: create, read, update`. Esto es un borrado y por
-- eso pide `delete`, explícito y auditable. El admin no tiene el módulo
-- `users` en absoluto, así que queda fuera por construcción.
-- ---------------------------------------------------------------------------
insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r, public.modules m, public.actions a
where r.name = 'superadmin' and m.key = 'users' and a.name = 'delete'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
  );


-- ---------------------------------------------------------------------------
-- 1b. La bitácora admite la acción nueva
--
-- `admin_user_actions.action` tiene un check cerrado con las dos acciones que
-- existían. Sin esto, la supresión se ejecutaría y el registro de quién la hizo
-- fallaría al final — que es exactamente lo que no puede pasar con una acción
-- irreversible.
-- ---------------------------------------------------------------------------
alter table public.admin_user_actions
  drop constraint if exists admin_user_actions_action_check;

alter table public.admin_user_actions
  add constraint admin_user_actions_action_check
  check (action in ('password_reset_sent', 'sessions_revoked', 'data_anonymized'));


-- ---------------------------------------------------------------------------
-- 2. La marca
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists anonymized_at timestamptz;

comment on column public.profiles.anonymized_at is
  'Cuándo se anonimizó. La fila ya no representa a una persona: existe solo para sostener los pedidos.';


-- ---------------------------------------------------------------------------
-- 3. La función
--
-- Vive en la base y no en la ruta porque son diez escrituras sobre tablas
-- distintas y tiene que ser todo o nada: a medias dejaría a la persona peor que
-- antes —sin nombre pero con la dirección—, y sin forma de saber en qué quedó.
-- Una función es una sola transacción; diez llamadas desde la ruta, no.
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_buyer(target uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  correo_original text;
  documento_original text;
begin
  select email, document_number into correo_original, documento_original
  from profiles where id = target;

  if correo_original is null then
    raise exception 'No existe el perfil %', target using errcode = 'no_data_found';
  end if;

  -- a) `clients`: la copia del mostrador. Se busca por documento además de por
  --    `profile_id` porque el vendedor registra al cliente por documento y el
  --    vínculo al perfil puede no haberse hecho. Va PRIMERO: más abajo se borra
  --    el documento y ya no habría con qué encontrarla.
  delete from clients
  where profile_id = target
     or (documento_original is not null and document_number = documento_original);

  -- b) Las direcciones guardadas.
  delete from delivery_addresses where buyer_id = target;

  -- c) La dirección congelada de cada pedido queda en municipio y departamento.
  --    Se pierde calle, barrio, coordenadas e indicaciones; el tendero conserva
  --    a dónde despachó a grandes rasgos y la persona deja de ser ubicable.
  update orders
  set delivery_address_snapshot = jsonb_build_object(
        'municipality', delivery_address_snapshot -> 'municipality',
        'department', delivery_address_snapshot -> 'department',
        'anonymized', true
      )
  where buyer_id = target
    and delivery_address_snapshot is not null;

  -- d) Texto libre. La gente escribe ahí su nombre, su teléfono y cómo llegar.
  update orders set notes = null where buyer_id = target and notes is not null;

  update store_orders so set notes = null
  from orders o
  where so.order_id = o.id and o.buyer_id = target and so.notes is not null;

  update store_reviews set comment = null
  where buyer_id = target and comment is not null;

  -- e) La respuesta cruda de la pasarela trae el correo de quien pagó. Se deja
  --    lo mínimo que la conciliación contable necesita.
  update payments p
  set callback_response = jsonb_build_object(
        'anonymized', true,
        'status', p.status,
        'provider_payment_id', p.provider_payment_id,
        'amount', p.amount
      )
  from orders o
  where p.order_id = o.id and o.buyer_id = target and p.callback_response is not null;

  -- f) La respuesta cruda del operador logístico repite nombre, teléfono, correo
  --    y dirección del destinatario. `driver_name` y `driver_phone` se conservan:
  --    son del mensajero, no del comprador.
  update pibox_bookings pb
  set raw = jsonb_build_object('anonymized', true)
  from store_orders so
  join orders o on o.id = so.order_id
  where pb.store_order_id = so.id and o.buyer_id = target and pb.raw is not null;

  -- g) Las tablas de códigos guardan el correo en claro y la IP.
  delete from password_change_codes where user_id = target or email = correo_original;
  delete from admin_login_codes where user_id = target or email = correo_original;
  delete from password_reset_codes where email = correo_original;
  delete from email_change_codes
    where user_id = target or current_email = correo_original or new_email = correo_original;
  delete from signup_email_codes where email = correo_original;

  -- h) La constancia de consentimiento SE CONSERVA, sin la IP. Es lo que permite
  --    responder un reclamo posterior; borrarla dejaría a la plataforma sin cómo
  --    demostrar que esa persona aceptó los términos cuando compró.
  update legal_acceptances set accepted_ip = null
  where user_id = target and accepted_ip is not null;

  -- i) Y por último el perfil. `full_name` y `email` son NOT NULL, así que se
  --    sobrescriben en vez de vaciarse. El correo lleva el id para que sea único
  --    —hay índice único— y el dominio `.invalid` está reservado justamente para
  --    que nunca se pueda enrutar un correo ahí.
  update profiles
  set full_name = 'Usuario eliminado',
      email = 'eliminado+' || target::text || '@mercamesa.invalid',
      phone = null,
      document_number = null,
      document_type = null,
      avatar_url = null,
      business_name = null,
      contact_name = null,
      identification_type_id = null,
      person_type = null,
      person_type_id = null,
      siigo_customer_id = null,
      is_active = false,
      anonymized_at = now()
  where id = target;

  -- NO se toca `siigo_invoices` (deber legal de conservación ante la DIAN; el
  -- documento de identidad va dentro de la factura) ni `orders.buyer_id`, que es
  -- lo que sostiene el historial de compras.
end;
$$;

comment on function public.anonymize_buyer(uuid) is
  'Suprime los datos personales de un comprador conservando sus pedidos y la constancia de aceptación de términos. Todo o nada.';

revoke all on function public.anonymize_buyer(uuid) from public, anon, authenticated;
