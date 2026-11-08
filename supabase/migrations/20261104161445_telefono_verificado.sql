-- El teléfono del perfil pasa a poder verificarse, y deja de poder repetirse.
--
-- Meteor (Carolina, por WhatsApp) identifica a quien escribe por su teléfono y
-- le va a mandar los avisos del pedido. Con un número que no es del dueño, otra
-- persona vería su pedido y su dirección. Hasta ahora el número lo escribía la
-- persona sin comprobar nada, y editar el perfil dejaba poner el de otra cuenta.
--
-- Cómo se verifica: la app le da al usuario un código de 6 dígitos y él se lo
-- manda a Carolina por WhatsApp. WhatsApp garantiza de qué número viene el
-- mensaje, y Meteor llama al MCP (`verificar_telefono`) con ese número y el
-- código. El código vive en `verification_codes`, con el propósito
-- `phone_verification`.

-- --------------------------------------------------------------------------
-- 1. El perfil
-- --------------------------------------------------------------------------

alter table public.profiles
  add column phone_verified_at timestamptz,
  add column whatsapp_notifications boolean not null default true;

comment on column public.profiles.phone_verified_at is
  'Cuándo se comprobó que el teléfono es del dueño de la cuenta (código enviado por WhatsApp). Se borra al cambiar el teléfono. Solo lo escribe el servidor.';
comment on column public.profiles.whatsapp_notifications is
  'Si quiere recibir por WhatsApp los avisos de sus pedidos. Solo aplica con el teléfono verificado.';

-- Va en la base para que lo cumpla cualquier ruta que cambie el teléfono, hoy y
-- las que vengan: el perfil, la invitación, el admin.
create function public.profiles_telefono_verificado() returns trigger
    language plpgsql
    set search_path to 'public'
    as $$
declare
  desde_la_cuenta boolean := coalesce(auth.jwt() ->> 'role', '') in ('anon', 'authenticated');
begin
  if tg_op = 'INSERT' then
    -- Nadie se registra con el teléfono ya verificado.
    if desde_la_cuenta then
      new.phone_verified_at := null;
    end if;
    return new;
  end if;

  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
    return new;
  end if;

  -- Si el usuario pudiera escribirla con su sesión, la verificación no valdría
  -- nada: el perfil tiene política de actualización propia.
  if desde_la_cuenta and new.phone_verified_at is distinct from old.phone_verified_at then
    raise exception 'La verificación del teléfono no se puede cambiar desde la cuenta del propio usuario.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_telefono_verificado
  before insert or update on public.profiles
  for each row execute function public.profiles_telefono_verificado();

-- --------------------------------------------------------------------------
-- 2. Números repetidos
-- --------------------------------------------------------------------------

-- Deja cada número en una sola cuenta. No borra cuentas: a las demás les deja
-- el teléfono vacío, y lo vuelven a poner (y a verificar) desde su perfil.
--
-- Se queda con el número, en este orden: la cuenta activa, la que no es de
-- prueba (`@mercamesa.com`), la que tiene más pedidos y tiendas, la más
-- antigua. También vacía lo que no es un teléfono (hay un correo escrito en la
-- columna).
--
-- La llama también `supabase/seed/post.sql`: la copia de producción se carga
-- después de las migraciones.
create function public.limpiar_telefonos_repetidos() returns integer
    language plpgsql
    set search_path to 'public'
    as $$
declare
  mal_escritos integer;
  repetidos integer;
begin
  update profiles set phone = null
  where phone is not null and phone !~ '^\+[1-9][0-9]{6,14}$';
  get diagnostics mal_escritos = row_count;

  with candidatos as (
    select p.id,
           row_number() over (
             partition by p.phone
             order by p.is_active desc,
                      (p.email ilike '%@mercamesa.com') asc,
                      (select count(*) from orders o where o.buyer_id = p.id)
                        + (select count(*) from store_members m where m.user_id = p.id) desc,
                      p.created_at,
                      p.id
           ) as puesto
    from profiles p
    where p.phone in (
      select phone from profiles where phone is not null group by phone having count(*) > 1
    )
  )
  update profiles p set phone = null
  from candidatos c
  where c.id = p.id and c.puesto > 1;
  get diagnostics repetidos = row_count;

  return mal_escritos + repetidos;
end;
$$;

revoke all on function public.limpiar_telefonos_repetidos() from public, anon, authenticated;

select public.limpiar_telefonos_repetidos();

-- Desde acá un número es de una sola cuenta. El registro ya lo comprobaba; el
-- perfil y las invitaciones no, y por ahí entraron los repetidos.
create unique index profiles_phone_unique on public.profiles (phone) where phone is not null;

-- --------------------------------------------------------------------------
-- 3. El código de verificación
-- --------------------------------------------------------------------------

alter table public.verification_codes
  add column phone text,
  drop constraint verification_codes_purpose_check,
  add constraint verification_codes_purpose_check check (purpose in
    ('admin_login', 'password_change', 'email_change', 'password_reset', 'signup_email', 'phone_verification')),
  -- El código se busca por el número de quien escribe, y se le atribuye a una cuenta.
  add constraint verification_codes_telefono
    check ((purpose = 'phone_verification') = (phone is not null)
           and (purpose <> 'phone_verification' or user_id is not null));

comment on column public.verification_codes.phone is
  'Solo al verificar el teléfono: el número (E.164) desde el que debe llegar el código por WhatsApp.';

create index verification_codes_por_telefono on public.verification_codes (purpose, phone, created_at desc)
  where phone is not null;

comment on table public.verification_codes is
  'Códigos de 6 dígitos: los que se envían por correo (ingreso de admin, registro, cambio de correo y de contraseña, recuperación) y el que el usuario manda por WhatsApp para verificar su teléfono. Solo el servidor la usa.';
