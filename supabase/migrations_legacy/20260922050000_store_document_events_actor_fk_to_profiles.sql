-- `actor_id` pasa a apuntar a `profiles` en vez de a `auth.users`.
--
-- El histórico tiene que mostrar QUIÉN hizo cada cosa, y el nombre está en
-- `profiles`. Con la clave foránea apuntando a `auth.users`, PostgREST no podía
-- resolver el join en la misma consulta —solo enlaza tablas del esquema que
-- expone, y `auth` no lo está— y la ruta del histórico respondía 400.
--
-- El dato es exactamente el mismo: `profiles.id` ES el id del usuario. Cambia a
-- dónde apunta la referencia, no lo que guarda.

alter table public.store_document_events
  drop constraint if exists store_document_events_actor_id_fkey;

alter table public.store_document_events
  add constraint store_document_events_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;
