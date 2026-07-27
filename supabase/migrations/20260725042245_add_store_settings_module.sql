insert into public.modules (key, label, path, icon, sort_order, is_active)
values ('store-settings', 'Mi Tienda', '/seller/settings', 'Store', 100, true);

insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from public.roles r
cross join public.modules m
cross join public.actions a
where r.name in ('seller', 'store_owner')
  and m.key = 'store-settings'
  and a.name in ('read', 'update');
