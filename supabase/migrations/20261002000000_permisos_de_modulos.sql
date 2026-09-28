-- Permisos de módulos: quién los escribe, y Clientes solo para superadmin.

-- ---------------------------------------------------------------------------
-- a) Nadie escribe roles ni permisos desde la sesión de un usuario.
--
-- `roles`, `actions` y `role_permissions` no tenían RLS, y Supabase les concede
-- INSERT, UPDATE y DELETE a `anon` y `authenticated`. Con solo la llave pública
-- —sin iniciar sesión— se podía insertar en `role_permissions` el permiso que
-- uno quisiera, o marcar `buyer` como `is_system`, que `verifyPermission` trata
-- como permiso total.
--
-- En la aplicación nadie escribe estas tablas con la sesión del usuario: el
-- permiso `read` de cada módulo lo edita `PUT /api/admin/modules/[id]/read-roles`
-- con la llave de servicio, detrás de `system-settings:update`. Las lecturas sí
-- hacen falta, incluso sin sesión (`register-buyer` busca el rol `buyer` antes
-- de crear la cuenta; `proxy.ts` y el menú leen los permisos), así que se
-- conservan tal cual. `has_permission` es SECURITY DEFINER y no depende de esto.
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.actions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select to anon, authenticated using (true);

drop policy if exists actions_select on public.actions;
create policy actions_select on public.actions
  for select to anon, authenticated using (true);

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- b) Los módulos se crean y se borran por código.
--
-- Cada módulo es una página: crearlo o borrarlo desde la pantalla deja una ruta
-- sin protección fina en `proxy.ts`, o una protección sin página. Queda la
-- edición de lo visible (etiqueta, ícono, orden, activo).
-- ---------------------------------------------------------------------------

drop policy if exists modules_insert_policy on public.modules;
drop policy if exists modules_delete_policy on public.modules;

-- ---------------------------------------------------------------------------
-- c) Rutas con barra final.
--
-- `proxy.ts` le quita la barra final a la URL antes de buscar el módulo, así
-- que un `path` guardado con barra nunca se encontraba y la página se saltaba
-- el permiso fino: Clientes y Registro de Tienda nunca se protegieron por
-- `role_permissions`.
--
-- `/seller/sales/` (insiteSales) se deja: está inactivo y sin la barra chocaría
-- con `/seller/sales`, que es otro módulo.
-- ---------------------------------------------------------------------------

update public.modules set path = '/seller/clients' where key = 'clients' and path = '/seller/clients/';
update public.modules set path = '/seller/onboarding' where key = 'onboarding' and path = '/seller/onboarding/';

-- ---------------------------------------------------------------------------
-- d) Clientes, solo para superadmin.
--
-- Se quitan TODAS las acciones de tenderos sobre el módulo, no solo `read`: un
-- rol que no ve un módulo no debe poder actuar sobre él por la API.
-- ---------------------------------------------------------------------------

delete from public.role_permissions rp
using public.modules m, public.roles r
where rp.module_id = m.id
  and rp.role_id = r.id
  and m.key = 'clients'
  and r.name in ('seller', 'store_owner');

insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r, public.modules m, public.actions a
where r.name = 'superadmin' and m.key = 'clients' and a.name = 'read'
on conflict (role_id, module_id, action_id) do nothing;
