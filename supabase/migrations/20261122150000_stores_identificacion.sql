-- La identificación de la tienda: NIT, cédula u otro documento.
--
-- La pide el cliente para la ficha de cada tienda (la llenan el admin y el
-- tendero). Es opcional por ahora: las tiendas que ya existen no la tienen.
-- Usa los mismos tipos de `identification_types` que los perfiles, que traen su
-- equivalente de Siigo.
--
-- Las reglas del número y del dígito de verificación están en
-- `lib/stores/store-identification.ts`; acá solo lo que no puede faltar.

alter table public.stores
  add column identification_type_id uuid references public.identification_types (id) on delete restrict,
  add column document_number text
    constraint stores_document_number_largo check (char_length(document_number) between 5 and 30),
  add column document_dv text
    constraint stores_document_dv_digito check (document_dv ~ '^[0-9]$'),
  add constraint stores_documento_con_tipo check (document_number is null or identification_type_id is not null),
  add constraint stores_dv_con_documento check (document_dv is null or document_number is not null);

comment on column public.stores.identification_type_id is
  'Tipo de identificación de la tienda (NIT, cédula…). No se puede borrar un tipo que una tienda usa.';
comment on column public.stores.document_number is
  'Número de identificación de la tienda, sin puntos ni guiones. No es público: solo lo ven el admin y quien maneja la tienda.';
comment on column public.stores.document_dv is
  'Dígito de verificación, cuando el documento es un NIT o RUT.';
