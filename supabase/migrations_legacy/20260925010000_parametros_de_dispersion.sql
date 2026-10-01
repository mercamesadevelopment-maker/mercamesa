-- Los datos del ordenante: quién paga, desde qué cuenta, con qué clave.
--
-- La cabecera del archivo (registros 110, 120 y 130) va llena de valores que
-- asigna el banco y que hoy no están en ninguna parte del sistema: el NIT de
-- MercaMesa con su dígito de verificación, la oficina y la cuenta BBVA desde la
-- que sale el dinero, la clave del emisor, el nombre y la dirección registrados.
-- Sin ellos no hay archivo que generar.
--
-- Va como histórico append-only, igual que `pricing_settings_history`: la fila
-- más reciente es la vigente, y cada liquidación guarda contra qué fila se
-- generó. Si mañana cambia la cuenta de la que sale la plata, los archivos
-- viejos siguen explicando de dónde salió la de entonces.

create table if not exists public.payout_settings_history (
  id uuid primary key default uuid_generate_v4(),

  -- Ordenante: campos 3 a 6 de todos los registros del archivo.
  orderer_document_type char(2) not null default '03',
  orderer_document_number text not null,
  -- Dígito de verificación del NIT. Es un solo carácter y el banco lo compara.
  orderer_dv char(1) not null default '0',
  orderer_suffix char(2) not null default '01',

  -- Registros 120 y 130. Se guardan completos y se truncan a 36 al generar.
  orderer_name text not null,
  orderer_address text not null,
  orderer_city text not null,

  -- Cuenta de la que sale el dinero: campos 10 y 12 de la cabecera.
  bbva_office_code char(4) not null,
  bbva_account_number text not null,
  -- Campo 16 de la cabecera: el código que el banco le dio al usuario que
  -- genera el fichero. No es el NIT, aunque en el ejemplo se le parezca.
  emitter_key text not null,

  -- Concepto del registro 240, igual para todas las órdenes del archivo.
  payment_concept text not null default 'Pago de ventas MercaMesa',

  -- El nombre del archivo lleva un consecutivo de 5 dígitos (COA00022.TRA) que
  -- tiene que continuar la numeración que el banco ya lleve. El consecutivo
  -- interno arranca en 1, así que este desfase es lo que los empata.
  file_consecutive_offset integer not null default 0
    check (file_consecutive_offset >= 0),

  -- Días que un pedido entregado espera antes de poder dispersarse. Es el único
  -- colchón contra una devolución: hoy no hay flujo de devoluciones en el
  -- sistema, pero un pedido entregado sí puede pasarse a 'returned' a mano.
  hold_days integer not null default 3 check (hold_days >= 0),

  notes text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

comment on table public.payout_settings_history is
  'Datos del ordenante para el archivo de dispersión. La fila más reciente es la vigente.';

comment on column public.payout_settings_history.file_consecutive_offset is
  'Se suma al consecutivo interno para empatar con la numeración que el banco ya lleve.';

comment on column public.payout_settings_history.hold_days is
  'Días de espera tras la entrega antes de que un pedido sea dispersable.';

create index if not exists payout_settings_history_created_at_idx
  on public.payout_settings_history (created_at desc);

alter table public.payout_settings_history enable row level security;

-- Sin `update` ni `delete` a propósito: cada cambio es una fila nueva. Es lo que
-- hace que el histórico sea histórico.
drop policy if exists payout_settings_select on public.payout_settings_history;
create policy payout_settings_select on public.payout_settings_history
  for select to authenticated
  using (public.has_permission('payouts', 'read'));

drop policy if exists payout_settings_insert on public.payout_settings_history;
create policy payout_settings_insert on public.payout_settings_history
  for insert to authenticated
  with check (public.has_permission('payouts', 'create'));

-- No se siembra ninguna fila: estos valores los da el banco y nadie más los
-- sabe. Inventar un NIT o una cuenta acá produciría un archivo que el banco
-- acepta sintácticamente y rechaza al procesar, o peor. La pantalla dice qué
-- falta cuando la tabla está vacía.
