-- Regenerar el archivo de una liquidación aprobada.
--
-- Si el banco rechaza el archivo (o no se alcanzó a subir) porque un dato de la
-- cuenta de una tienda estaba mal —un tipo de documento, por ejemplo—, se corrige
-- la cuenta y se vuelve a armar el .txt con la cuenta verificada vigente de cada
-- tienda (`lib/payouts/regenerate-file.ts`). Queda quién lo regeneró y cuándo.

alter table public.payouts
  add column file_regenerated_at timestamptz,
  add column file_regenerated_by uuid references public.profiles (id) on delete set null;

comment on column public.payouts.file_regenerated_at is
  'Última vez que se volvió a generar el archivo de la liquidación aprobada (lib/payouts/regenerate-file.ts).';
comment on column public.payouts.file_regenerated_by is
  'Quién volvió a generar el archivo por última vez.';
