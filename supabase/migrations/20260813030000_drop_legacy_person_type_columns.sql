-- Contracción del cambio de tipos de persona e identificación.
--
-- NO APLICAR ANTES DE DESPLEGAR el código que usa `person_type_id` e
-- `identification_type_id`. Mientras la versión anterior siga en producción,
-- sigue escribiendo estas columnas y borrarlas tumbaría el registro de
-- compradores y la edición de perfil.
--
-- Los datos ya se pasaron a las columnas nuevas en 20260813020000.

alter table public.profiles drop column if exists person_type;
alter table public.profiles drop column if exists document_type;
