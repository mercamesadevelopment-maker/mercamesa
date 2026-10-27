-- Balances de prueba de Siigo generados desde Contabilidad.
--
-- Siigo arma el reporte y devuelve un enlace al Excel; aquí queda el rastro de
-- quién lo pidió, con qué parámetros y el enlace, para volver a abrirlo. Si
-- Siigo deja de servir el enlace, el balance se genera de nuevo.
--
-- Solo la toca el servidor (cliente de servicio): RLS encendida y sin políticas.

create table public.siigo_balance_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('general', 'third_party')),
  year int not null,
  month_start int not null check (month_start between 1 and 13),
  month_end int not null check (month_end between 1 and 13 and month_end >= month_start),
  account_start text,
  account_end text,
  includes_tax_difference boolean not null,
  identification text,
  branch_office int check (branch_office between 0 and 999),
  third_party_name text,
  file_id text not null,
  file_url text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Por tercero lleva su identificación; el general no.
  constraint siigo_balance_reports_tercero check ((kind = 'third_party') = (identification is not null))
);

create index siigo_balance_reports_recientes on public.siigo_balance_reports (created_at desc);

alter table public.siigo_balance_reports enable row level security;

comment on table public.siigo_balance_reports is
  'Balances de prueba pedidos a Siigo desde Contabilidad: parámetros, quién y el enlace al Excel. Solo el servidor.';
comment on column public.siigo_balance_reports.month_end is 'De 1 a 13: el 13 es el periodo de cierre en Siigo.';
comment on column public.siigo_balance_reports.identification is 'Por tercero: la identificación sin dígito de verificación, como la pide Siigo.';
comment on column public.siigo_balance_reports.third_party_name is 'El nombre que se mostró al elegir el tercero en el buscador. Vacío si se escribió a mano.';
comment on column public.siigo_balance_reports.file_url is 'El Excel en el almacenamiento de Siigo. Puede dejar de servir con el tiempo.';
