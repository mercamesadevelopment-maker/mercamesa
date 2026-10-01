-- 1. Insertar módulo 'system-settings' en la tabla modules
INSERT INTO public.modules (id, parent_id, key, label, description, icon, path, sort_order, is_active)
SELECT 
  '9f81a8b4-0c2d-4e9a-8b1c-7f3e5d1a9b2c',
  NULL,
  'system-settings',
  'Parametrización',
  'Gestión de catálogos del sistema (Categorías, Unidades, Módulos, Documentos)',
  'Settings2',
  '/admin/settings',
  10,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.modules WHERE key = 'system-settings'
);

-- 2. Otorgar permisos al rol Admin ('4c68886c-5db2-4da5-8b9e-c5d5bb7fd906') para system-settings
INSERT INTO public.role_permissions (role_id, module_id, action_id)
SELECT '4c68886c-5db2-4da5-8b9e-c5d5bb7fd906', m.id, a.id
FROM public.modules m
CROSS JOIN public.actions a
WHERE m.key = 'system-settings'
  AND a.name IN ('read', 'create', 'update', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = '4c68886c-5db2-4da5-8b9e-c5d5bb7fd906'
      AND rp.module_id = m.id
      AND rp.action_id = a.id
  );

-- 3. Habilitar RLS en las 4 tablas de catálogo
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.measurement_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

-- 4. Definir Políticas RLS dinámicas usando public.has_permission()

-- ── public.categories ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories_select_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_insert_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_update_policy" ON public.categories;
DROP POLICY IF EXISTS "categories_delete_policy" ON public.categories;

CREATE POLICY "categories_select_policy" ON public.categories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "categories_insert_policy" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('system-settings', 'create'));

CREATE POLICY "categories_update_policy" ON public.categories
  FOR UPDATE TO authenticated USING (public.has_permission('system-settings', 'update'));

CREATE POLICY "categories_delete_policy" ON public.categories
  FOR DELETE TO authenticated USING (public.has_permission('system-settings', 'delete'));

-- ── public.measurement_units ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "measurement_units_select_policy" ON public.measurement_units;
DROP POLICY IF EXISTS "measurement_units_insert_policy" ON public.measurement_units;
DROP POLICY IF EXISTS "measurement_units_update_policy" ON public.measurement_units;
DROP POLICY IF EXISTS "measurement_units_delete_policy" ON public.measurement_units;

CREATE POLICY "measurement_units_select_policy" ON public.measurement_units
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "measurement_units_insert_policy" ON public.measurement_units
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('system-settings', 'create'));

CREATE POLICY "measurement_units_update_policy" ON public.measurement_units
  FOR UPDATE TO authenticated USING (public.has_permission('system-settings', 'update'));

CREATE POLICY "measurement_units_delete_policy" ON public.measurement_units
  FOR DELETE TO authenticated USING (public.has_permission('system-settings', 'delete'));

-- ── public.modules ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "modules_select_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_insert_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_update_policy" ON public.modules;
DROP POLICY IF EXISTS "modules_delete_policy" ON public.modules;

CREATE POLICY "modules_select_policy" ON public.modules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "modules_insert_policy" ON public.modules
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('system-settings', 'create'));

CREATE POLICY "modules_update_policy" ON public.modules
  FOR UPDATE TO authenticated USING (public.has_permission('system-settings', 'update'));

CREATE POLICY "modules_delete_policy" ON public.modules
  FOR DELETE TO authenticated USING (public.has_permission('system-settings', 'delete'));

-- ── public.document_types ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow read to authenticated" ON public.document_types;
DROP POLICY IF EXISTS "document_types_select_policy" ON public.document_types;
DROP POLICY IF EXISTS "document_types_insert_policy" ON public.document_types;
DROP POLICY IF EXISTS "document_types_update_policy" ON public.document_types;
DROP POLICY IF EXISTS "document_types_delete_policy" ON public.document_types;

CREATE POLICY "document_types_select_policy" ON public.document_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "document_types_insert_policy" ON public.document_types
  FOR INSERT TO authenticated WITH CHECK (public.has_permission('system-settings', 'create'));

CREATE POLICY "document_types_update_policy" ON public.document_types
  FOR UPDATE TO authenticated USING (public.has_permission('system-settings', 'update'));

CREATE POLICY "document_types_delete_policy" ON public.document_types
  FOR DELETE TO authenticated USING (public.has_permission('system-settings', 'delete'));
