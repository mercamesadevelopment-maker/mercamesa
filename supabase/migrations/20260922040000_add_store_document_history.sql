-- Histórico de los documentos de una tienda.
--
-- Reemplazar un documento era un `upsert` sobre `store_documents`, que tiene una
-- fila por (tienda, tipo): el archivo nuevo pisaba al anterior. El viejo se
-- quedaba en Storage, pero ya nadie sabía que existía. Con 28 documentos y 24
-- aprobados, no había forma de responder qué se aprobó, cuándo ni sobre qué
-- archivo.
--
-- Lo escribe un TRIGGER y no la ruta: si lo hiciera la ruta, solo se registraría
-- lo que pase por la aplicación, y justamente lo que hay que auditar es lo que
-- entra por otro lado.

create table if not exists public.store_document_events (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  document_type_id uuid not null references public.document_types(id),
  -- 'upload' = se subió o reemplazó el archivo; 'status_change' = alguien decidió.
  event_type text not null check (event_type in ('upload', 'status_change')),
  -- El archivo al que se refiere el evento. En un cambio de estado es la versión
  -- que se estaba aprobando o rechazando, que es lo que hay que poder abrir.
  file_url text not null,
  status text not null,
  previous_status text,
  -- `set null` y no `cascade`: si la persona se va, el evento se queda. Un
  -- histórico que desaparece al borrar un usuario no sirve para auditar.
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists store_document_events_lookup
  on public.store_document_events (store_id, document_type_id, created_at desc);

alter table public.store_document_events enable row level security;

-- La tienda, el admin y el superadmin: misma forma que la política de
-- `store_documents`, que ya describe exactamente a esos tres.
drop policy if exists store_document_events_select on public.store_document_events;

create policy store_document_events_select on public.store_document_events
  for select to authenticated
  using (fn_is_store_member(store_id) or has_permission('stores', 'read'));

-- Sin políticas de insert/update/delete a propósito: nadie escribe el histórico
-- a mano, lo hace el trigger de abajo.


-- ---------------------------------------------------------------------------
-- Quién puede cambiar el estado
--
-- `store_documents_update` permite al miembro de la tienda actualizar su fila, y
-- RLS filtra FILAS, NO COLUMNAS: con una llamada directa a PostgREST, saltándose
-- la ruta, la tienda se ponía `approved` sola. No hay política por columna, así
-- que el guardia tiene que ser un trigger.
-- ---------------------------------------------------------------------------
create or replace function public.fn_guard_store_document_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    -- Un documento recién subido no lo ha revisado nadie.
    if not has_permission('stores', 'update') then
      new.status := 'pending';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if has_permission('stores', 'update') then
    return new;
  end if;

  raise exception 'Solo un administrador puede cambiar el estado de un documento'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists store_documents_guard_status on public.store_documents;

create trigger store_documents_guard_status
  before insert or update on public.store_documents
  for each row execute function public.fn_guard_store_document_status();


-- ---------------------------------------------------------------------------
-- El registro
-- ---------------------------------------------------------------------------
create or replace function public.fn_log_store_document_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'upload', new.file_url, new.status, null, auth.uid());

    return new;
  end if;

  -- Archivo nuevo: es un reemplazo. El estado vuelve a "pendiente" como parte
  -- de subirlo, así que NO se emite además un `status_change`: sería ruido, no
  -- la decisión de nadie.
  if new.file_url is distinct from old.file_url then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'upload', new.file_url, new.status, old.status, auth.uid());

  elsif new.status is distinct from old.status then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'status_change', new.file_url, new.status, old.status, auth.uid());
  end if;

  return new;
end;
$$;

drop trigger if exists store_documents_log_event on public.store_documents;

create trigger store_documents_log_event
  after insert or update on public.store_documents
  for each row execute function public.fn_log_store_document_event();


-- ---------------------------------------------------------------------------
-- Relleno: el estado actual como primer evento
--
-- Sin esto, el modal diría "sin historial" para todos los documentos que ya
-- existen, que es lo contrario de lo que se pide. `actor_id` queda nulo porque
-- no hay forma de saber quién los subió, e inventarlo sería peor.
-- ---------------------------------------------------------------------------
insert into public.store_document_events (
  store_id, document_type_id, event_type, file_url, status, previous_status, actor_id, created_at
)
select sd.store_id, sd.document_type_id, 'upload', sd.file_url, sd.status, null, null, sd.created_at
from public.store_documents sd
where not exists (
  select 1 from public.store_document_events e
  where e.store_id = sd.store_id
    and e.document_type_id = sd.document_type_id
);
