-- Ajustes que solo valen para la base local. Corre al final de cada
-- `supabase db reset`, después de `post.sql`, que tiene lo que comparte con staging.

-- Secretos de Vault. Son valores de mentira: el de verdad vive solo en el Vault
-- de cada proyecto y nunca en un archivo. `CRON_SECRET` de `.env.local` tiene
-- que decir lo mismo que `app_cron_secret`.
select vault.create_secret('http://host.docker.internal:4005', 'app_base_url')
where not exists (select 1 from vault.secrets where name = 'app_base_url');

select vault.create_secret('local-cron-secret', 'app_cron_secret')
where not exists (select 1 from vault.secrets where name = 'app_cron_secret');

-- Cuentas de prueba para roles que la copia de producción no trae. Las
-- contraseñas son solo de esta base local. En staging y producción se invitan:
-- el contable desde Usuarios, el patinador y logística desde la plaza.
--
--   contable@mercamesa.local   contable-local    Contabilidad. El rol pide código
--                                                 al entrar: `pnpm dev` lo muestra
--                                                 en la consola del servidor.
--   patinador@mercamesa.local  patinador-local   /runner, en Placita de Flórez.
--   logistica@mercamesa.local  logistica-local   /admin/orders (la bahía), en
--                                                 Placita de Flórez.
--   comprador@mercamesa.local  comprador-local   La tienda, con una dirección en
--                                                 Medellín. Es quien compra en
--                                                 `pnpm local:demo-logistica`.
--
-- Se puede volver a correr: salta las cuentas que ya existen.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('00000000-0000-0000-0000-00000000c0a7'::uuid, 'contable@mercamesa.local',  'contable-local',  'Auxiliar contable (local)', 'accountant', null),
      ('00000000-0000-0000-0000-00000000f101'::uuid, 'patinador@mercamesa.local', 'patinador-local', 'Patinador (local)',         'runner',     '+573000000101'),
      ('00000000-0000-0000-0000-00000000f102'::uuid, 'logistica@mercamesa.local', 'logistica-local', 'Logística (local)',         'logistics',  '+573000000102'),
      ('00000000-0000-0000-0000-00000000f103'::uuid, 'comprador@mercamesa.local', 'comprador-local', 'Comprador (local)',         'buyer',      '+573000000103')
    ) as t(id, email, clave, nombre, rol, telefono)
  loop
    if exists (select 1 from auth.users where email = c.email) then
      -- Las creadas antes de que esta lista llevara teléfono.
      update public.profiles set phone = c.telefono where email = c.email and phone is null;
      continue;
    end if;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', c.id, 'authenticated', 'authenticated',
      c.email, extensions.crypt(c.clave, extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', now(), now(),
      '', '', '', ''
    );

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      c.id::text, c.id,
      jsonb_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    insert into public.profiles (id, email, full_name, phone, role_id, language, is_active)
    select c.id, c.email, c.nombre, c.telefono, r.id, 'es', true
    from public.roles r where r.name = c.rol;
  end loop;
end $$;

-- La dirección del comprador de prueba, con punto en el mapa: sin coordenadas
-- Pibox no cotiza el domicilio.
insert into public.delivery_addresses (
  id, buyer_id, label, address_line, neighborhood, municipality, department, delivery_instructions,
  latitude, longitude, is_default
)
select '00000000-0000-0000-0000-00000000fa01', p.id, 'Casa', 'Carrera 43A # 9-50', 'El Poblado',
       'Medellín', 'Antioquia', 'Portería del edificio, apartamento 501 (dirección de prueba)',
       6.2086, -75.5677, true
from public.profiles p
where p.email = 'comprador@mercamesa.local'
on conflict (id) do nothing;

-- Placita de Flórez con patinador y logística, para probar los pedidos de varias
-- tiendas de punta a punta (ver «Pedidos de varias tiendas» en CLAUDE.md). Sin
-- la copia de producción no hay plazas y esto no hace nada.
--
-- En producción Flórez no tiene dirección, y sin ella Pibox no sabe dónde
-- recoger lo que sale de la bahía: se le pone la de su tienda de prueba
-- (Carrera 39 50-25) si no trae una.
update public.marketplaces
set runner_enabled = true,
    logistics_enabled = true,
    runner_commission_type = coalesce(runner_commission_type, 'percent'),
    runner_commission_value = coalesce(runner_commission_value, 5),
    address = coalesce(nullif(btrim(address), ''), 'Carrera 39 50-25'),
    latitude = coalesce(latitude, 6.2458780),
    longitude = coalesce(longitude, -75.5599090)
where slug = 'placita-florez';

-- Las dos tiendas de prueba de Flórez despachan desde la bahía de la plaza, para
-- que se puedan juntar en un pedido. Una tienda con dirección propia despacha
-- desde ahí y no comparte bahía (`stores.pickup_group`); en producción «Tienda
-- de prueba Placita de Flórez» tiene dirección.
update public.stores
set address = null, latitude = null, longitude = null
where id = '3316d71c-040f-4207-80f6-33398c9fd6e0'
  and marketplace_id = (select id from public.marketplaces where slug = 'placita-florez');

insert into public.marketplace_staff (marketplace_id, user_id, role)
select m.id, p.id, r.name
from public.marketplaces m
cross join public.profiles p
join public.roles r on r.id = p.role_id
where m.slug = 'placita-florez'
  and p.email in ('patinador@mercamesa.local', 'logistica@mercamesa.local')
on conflict (marketplace_id, user_id, role) do nothing;
