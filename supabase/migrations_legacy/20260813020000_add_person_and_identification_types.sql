-- Tipos de persona e identificación parametrizables.
--
-- Antes: dos listas fijas y duplicadas en el código (BuyerRegisterModal y
-- account-tab), independientes entre sí, así que nada impedía registrar una
-- persona Natural con NIT. Y el CHECK de profiles.person_type solo admitía
-- 'natural' y 'juridica', de modo que "Establecimiento de comercio" era
-- imposible sin desplegar.
--
-- Ahora el catálogo vive en la base y la tabla puente define qué identificación
-- vale para cada tipo de persona:
--   Natural        -> CC, CE, Pasaporte
--   Jurídica       -> NIT
--   Establecimiento -> NIT, RUT
--
-- Ojo: `document_types` es otra cosa (los documentos que se le exigen a las
-- tiendas, con FK desde store_documents). No se toca.

create table if not exists public.person_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- Natural pide nombre completo; Jurídica y Establecimiento piden razón social
  -- y contacto. Es una propiedad del tipo, no un `if` en el formulario.
  requires_business_name boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint person_types_name_length check (char_length(btrim(name)) between 1 and 120)
);

create table if not exists public.identification_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Lo corto: "CC", "NIT". Es lo que se muestra en tablas y recibos.
  code text not null,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identification_types_name_length check (char_length(btrim(name)) between 1 and 120),
  constraint identification_types_code_length check (char_length(btrim(code)) between 1 and 20)
);

-- NIT existe una sola vez y se asocia tanto a Jurídica como a Establecimiento.
create table if not exists public.person_type_identification_types (
  person_type_id uuid not null references public.person_types(id) on delete cascade,
  identification_type_id uuid not null references public.identification_types(id) on delete cascade,
  primary key (person_type_id, identification_type_id)
);

create index if not exists person_type_identification_types_identification_idx
  on public.person_type_identification_types (identification_type_id);

-- on delete restrict a propósito: borrar un tipo en uso debe fallar, no dejar
-- perfiles apuntando a la nada.
alter table public.profiles
  add column if not exists person_type_id uuid references public.person_types(id) on delete restrict,
  add column if not exists identification_type_id uuid references public.identification_types(id) on delete restrict;

alter table public.clients
  add column if not exists identification_type_id uuid references public.identification_types(id) on delete restrict;

create index if not exists profiles_person_type_id_idx on public.profiles (person_type_id);
create index if not exists profiles_identification_type_id_idx on public.profiles (identification_type_id);
create index if not exists clients_identification_type_id_idx on public.clients (identification_type_id);

-- ── Semilla ─────────────────────────────────────────────────────────────────

insert into public.person_types (name, slug, requires_business_name, sort_order)
values
  ('Natural', 'natural', false, 1),
  ('Jurídica', 'juridica', true, 2),
  ('Establecimiento de comercio', 'establecimiento-comercio', true, 3)
on conflict (slug) do nothing;

-- CC, NIT y RUT son los que pidió el cliente. CE y Pasaporte se siembran porque
-- ya estaban en la lista fija del formulario: quitarlos sería una regresión
-- silenciosa. El admin puede desactivarlos desde la pestaña de parametrización.
insert into public.identification_types (name, code, slug, sort_order)
values
  ('Cédula de ciudadanía', 'CC', 'cedula', 1),
  ('Cédula de extranjería', 'CE', 'cedula-extranjeria', 2),
  ('Pasaporte', 'PA', 'pasaporte', 3),
  ('NIT', 'NIT', 'nit', 4),
  ('RUT', 'RUT', 'rut', 5)
on conflict (slug) do nothing;

insert into public.person_type_identification_types (person_type_id, identification_type_id)
select p.id, i.id
from public.person_types p
join public.identification_types i on true
where (p.slug = 'natural' and i.slug in ('cedula', 'cedula-extranjeria', 'pasaporte'))
   or (p.slug = 'juridica' and i.slug = 'nit')
   or (p.slug = 'establecimiento-comercio' and i.slug in ('nit', 'rut'))
on conflict do nothing;

-- ── Backfill de los perfiles existentes ─────────────────────────────────────

update public.profiles pr
set person_type_id = p.id
from public.person_types p
where pr.person_type is not null
  and p.slug = pr.person_type;

-- Los valores estaban sucios: convivían 'cedula' y 'CC' para lo mismo.
update public.profiles pr
set identification_type_id = i.id
from public.identification_types i
where pr.document_type is not null
  and i.slug = case lower(btrim(pr.document_type))
    when 'cedula' then 'cedula'
    when 'cc' then 'cedula'
    when 'cedula_extranjeria' then 'cedula-extranjeria'
    when 'ce' then 'cedula-extranjeria'
    when 'pasaporte' then 'pasaporte'
    when 'pa' then 'pasaporte'
    when 'nit' then 'nit'
    when 'rut' then 'rut'
    else null
  end;

-- ── Las columnas viejas ─────────────────────────────────────────────────────
--
-- Se quita el CHECK, que es justamente lo que bloqueaba el tercer tipo de
-- persona, pero las columnas se dejan en pie a propósito.
--
-- Producción está viva: entre aplicar esta migración y desplegar el código
-- nuevo hay una ventana en la que el código viejo sigue escribiendo
-- `person_type` y `document_type`. Dropearlas acá dejaría el registro de
-- compradores caído durante esa ventana. Se borran en la migración de contracción
-- (20260813030000), que se aplica DESPUÉS del despliegue.

alter table public.profiles drop constraint if exists profiles_person_type_check;

comment on column public.profiles.person_type is
  'OBSOLETA: reemplazada por person_type_id. Se borra en 20260813030000, tras el despliegue.';
comment on column public.profiles.document_type is
  'OBSOLETA: reemplazada por identification_type_id. Se borra en 20260813030000, tras el despliegue.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- SELECT para `anon` además de `authenticated`, a diferencia del resto de
-- catálogos: el modal de registro lo usa gente SIN sesión, y con `TO
-- authenticated` los desplegables saldrían vacíos con status 200, sin error
-- visible. No hay nada sensible acá: son etiquetas como "Cédula de ciudadanía".

alter table public.person_types enable row level security;
alter table public.identification_types enable row level security;
alter table public.person_type_identification_types enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['person_types', 'identification_types', 'person_type_identification_types']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_policy', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_policy', t);

    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_select_policy', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.has_permission(''system-settings'', ''create''))',
      t || '_insert_policy', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.has_permission(''system-settings'', ''update''))',
      t || '_update_policy', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.has_permission(''system-settings'', ''delete''))',
      t || '_delete_policy', t
    );
  end loop;
end $$;
