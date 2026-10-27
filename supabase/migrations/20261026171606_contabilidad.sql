-- Módulo «Contabilidad» y rol «Auxiliar contable».
--
-- Contabilidad reúne lo que entra y sale de plata: los pagos de los compradores,
-- las notas crédito, las dispersiones a las tiendas (que se mueven aquí desde
-- su propio módulo) y las devoluciones en dinero.
--
-- El auxiliar contable opera ese módulo completo y nada más. Las rutas de
-- dispersiones, cuentas bancarias y bancos siguen preguntando por el módulo
-- `payouts`, así que también recibe esos permisos.

-- ---------------------------------------------------------------------------
-- Rol
-- ---------------------------------------------------------------------------
insert into public.roles (name, label, description, is_system, is_active)
select 'accountant', 'Auxiliar contable',
       'Consulta pagos, notas crédito y devoluciones, y opera las dispersiones a las tiendas', false, true
where not exists (select 1 from public.roles where name = 'accountant');

-- ---------------------------------------------------------------------------
-- Módulo
-- ---------------------------------------------------------------------------
-- Inactivo al crearse: se activa en Parametrización cuando el código esté
-- desplegado. Al activarlo se apaga «Dispersiones», que pasa a ser una pestaña
-- de este módulo (`/admin/payouts` redirige aquí). Apagar un módulo solo lo saca
-- del menú: `has_permission` no mira `is_active`, así que su API sigue igual.
insert into public.modules (key, label, description, icon, path, sort_order, is_active)
select 'accounting', 'Contabilidad',
       'Pagos, notas crédito, dispersiones a las tiendas y devoluciones en dinero', 'Calculator', '/admin/accounting', 11, false
where not exists (select 1 from public.modules where key = 'accounting');

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
-- `update` sobre Contabilidad es marcar una devolución en dinero como pagada.
insert into public.role_permissions (role_id, module_id, action_id)
select r.id, m.id, a.id
from (values
  ('superadmin', 'accounting', 'read'),
  ('superadmin', 'accounting', 'update'),
  ('accountant', 'accounting', 'read'),
  ('accountant', 'accounting', 'update'),
  ('accountant', 'payouts', 'read'),
  ('accountant', 'payouts', 'create'),
  ('accountant', 'payouts', 'update'),
  ('accountant', 'payouts', 'delete')
) as v(role_name, module_key, action_name)
join public.roles r on r.name = v.role_name
join public.modules m on m.key = v.module_key
join public.actions a on a.name = v.action_name
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = r.id and rp.module_id = m.id and rp.action_id = a.id
);
