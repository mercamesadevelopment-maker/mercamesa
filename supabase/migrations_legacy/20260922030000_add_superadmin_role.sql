-- Rol de super administrador.
--
-- Había un solo rol con acceso total, y con él se repartían tanto la operación
-- diaria (plazas, tiendas, productos, pedidos) como las dos cosas que no son
-- operación: quién entra a la plataforma (`users`) y cómo está parametrizada
-- (`system-settings`). Cualquier persona que necesitara lo primero recibía
-- también lo segundo.
--
-- A partir de acá: `admin` opera, `superadmin` además administra la plataforma.

insert into public.roles (name, label, description, is_system)
select 'superadmin', 'Super administrador',
       'Administra la plataforma: usuarios, roles y parametrización.', true
where not exists (select 1 from public.roles where name = 'superadmin');

-- Nace con exactamente lo que admin tiene hoy. Copiarlo en vez de enumerarlo
-- evita que las dos listas se separen si admin cambia mientras tanto.
insert into public.role_permissions (role_id, module_id, action_id)
select (select id from public.roles where name = 'superadmin'),
       rp.module_id, rp.action_id
from public.role_permissions rp
join public.roles r on r.id = rp.role_id
where r.name = 'admin'
  and not exists (
    select 1 from public.role_permissions existente
    where existente.role_id = (select id from public.roles where name = 'superadmin')
      and existente.module_id = rp.module_id
      and existente.action_id = rp.action_id
  );

-- La cuenta que venía usándose como administrador general pasa a ser la
-- superadministradora. Se mueve por correo y no por id para no escribir un id
-- concreto en una migración.
update public.profiles
set role_id = (select id from public.roles where name = 'superadmin')
where email = 'administrador@mercamesa.com';

-- Y recién ahora admin pierde las dos. En este orden: si se quitaran antes de
-- copiar, superadmin nacería sin ellas.
delete from public.role_permissions rp
using public.roles r, public.modules m
where rp.role_id = r.id
  and rp.module_id = m.id
  and r.name = 'admin'
  and m.key in ('users', 'system-settings');

-- Nota: no se crean cuentas acá. Una contraseña en un archivo de migración
-- queda en el historial del repositorio para siempre; las cuentas se crean con
-- un script aparte.
