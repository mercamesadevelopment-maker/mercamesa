-- Términos y condiciones y política de tratamiento de datos, como documentos.
--
-- Hasta acá no existían en ninguna parte: la casilla del registro era texto
-- plano sin enlace, el pie de página apuntaba a `href="#"`, y la versión
-- aceptada era una constante escrita a mano en un componente de cliente
-- (`TERMS_VERSION = '2026-07-24'`).
--
-- El resultado es que hay 6 usuarios con `terms_version = '2026-07-24'`, una
-- versión de la que NO EXISTE ningún documento. Esa constancia no se puede
-- respaldar con lo que la persona aceptó, que es justamente para lo que sirve
-- guardarla.
--
-- Son dos tablas y no una columna de configuración porque hay que poder
-- responder dos preguntas distintas: qué dice el documento vigente (y qué decía
-- el de antes), y quién aceptó cuál y cuándo.

-- ---------------------------------------------------------------------------
-- El bucket
--
-- PÚBLICO a propósito: quien todavía no tiene cuenta tiene que poder leer los
-- términos ANTES de aceptarlos. Con URLs firmadas que vencen, el enlace del pie
-- de página se rompería solo al cabo de una hora.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('legal', 'legal', true)
on conflict (id) do nothing;

drop policy if exists "legal_read" on storage.objects;
create policy "legal_read" on storage.objects
  for select using (bucket_id = 'legal');

-- Escribir sí es cosa de quien administra la plataforma.
drop policy if exists "legal_upload" on storage.objects;
create policy "legal_upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'legal' and public.has_permission('system-settings', 'update'));

drop policy if exists "legal_update" on storage.objects;
create policy "legal_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'legal' and public.has_permission('system-settings', 'update'));

drop policy if exists "legal_delete" on storage.objects;
create policy "legal_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'legal' and public.has_permission('system-settings', 'delete'));


-- ---------------------------------------------------------------------------
-- Las versiones publicadas
--
-- Append-only, como `pricing_settings_history` y `order_min_price_history`: cada
-- publicación es una fila nueva y la de mayor `version` es la vigente. Guardar
-- solo "la ruta del PDF actual" en una columna resolvería mostrarlo hoy y
-- perdería el de ayer, que es el que importa cuando alguien reclama.
-- ---------------------------------------------------------------------------
create table if not exists public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('terms', 'privacy')),
  -- Entero y no texto libre: dos versiones no pueden colisionar y se ordenan
  -- solas. El texto libre invita a "v2 final REAL".
  version integer not null,
  file_path text not null,
  file_name text not null,
  notes text,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  -- Resultado del aviso, guardado acá y no en un log: si un envío falla hay que
  -- poder verlo después y reintentarlo.
  notified_at timestamptz,
  notified_count integer,
  notify_failed integer,
  unique (kind, version)
);

create index if not exists legal_documents_kind_version_idx
  on public.legal_documents (kind, version desc);

alter table public.legal_documents enable row level security;

-- Lectura para TODOS, incluido quien no ha iniciado sesión: el pie de página y
-- el formulario de registro la consultan sin sesión.
drop policy if exists legal_documents_select on public.legal_documents;
create policy legal_documents_select on public.legal_documents
  for select using (true);

drop policy if exists legal_documents_insert on public.legal_documents;
create policy legal_documents_insert on public.legal_documents
  for insert to authenticated
  with check (public.has_permission('system-settings', 'create'));

-- Update existe solo para la corrección menor (reemplazar el archivo de la
-- versión vigente) y para registrar el resultado del aviso.
drop policy if exists legal_documents_update on public.legal_documents;
create policy legal_documents_update on public.legal_documents
  for update to authenticated
  using (public.has_permission('system-settings', 'update'));


-- ---------------------------------------------------------------------------
-- Quién aceptó qué
--
-- Tabla aparte y no una columna en `profiles` porque son DOS documentos y
-- `profiles.terms_version` es una sola columna de texto: no puede decir "aceptó
-- términos v3 el día X y política v2 el día Y".
-- ---------------------------------------------------------------------------
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.legal_documents(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  -- Aceptar dos veces no debe duplicar la constancia.
  unique (user_id, document_id)
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id);

alter table public.legal_acceptances enable row level security;

-- Cada quien ve lo suyo; quien administra usuarios ve todo, que es lo que hace
-- falta para responder un reclamo.
drop policy if exists legal_acceptances_select on public.legal_acceptances;
create policy legal_acceptances_select on public.legal_acceptances
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users', 'read'));

drop policy if exists legal_acceptances_insert on public.legal_acceptances;
create policy legal_acceptances_insert on public.legal_acceptances
  for insert to authenticated
  with check (user_id = auth.uid());

-- Sin update ni delete: una aceptación no se edita ni se borra. Si se publica
-- una versión nueva, se acepta esa; la vieja queda como constancia de lo que
-- pasó.


-- ---------------------------------------------------------------------------
-- Las columnas viejas
--
-- No se rellenan las aceptaciones a partir de ellas: nadie aceptó un documento
-- que no existe, e inventar esa constancia sería peor que no tenerla.
-- ---------------------------------------------------------------------------
comment on column public.profiles.terms_version is
  'OBSOLETA desde 2026-09-23: usar legal_acceptances. Apuntaba a una versión sin documento.';
comment on column public.profiles.terms_accepted_at is
  'OBSOLETA desde 2026-09-23: usar legal_acceptances.accepted_at.';
