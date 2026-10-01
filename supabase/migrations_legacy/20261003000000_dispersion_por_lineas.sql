-- Dispersión por líneas (BBVA NetCash) y pago por llave Bre-B.
--
-- El formato que se había implementado era el de registros de Global C@sh
-- (encabezado 110/120/130 con el ordenante, cuatro registros por beneficiario y
-- un cierre 910). El banco aclaró que la dispersión es POR LÍNEAS: una línea por
-- pago, sin encabezado ni cierre, y sin ningún dato del ordenante. La estructura
-- está en `docs/dispersiones/pagosPorLineas.md`.
--
-- Al aplicar esta migración no había cuentas, parámetros ni dispersiones, así
-- que el esquema cambia sin mover datos.

-- ---------------------------------------------------------------------------
-- Cuentas de las tiendas: cuenta bancaria O llave Bre-B
--
-- Una llave Bre-B se paga en la misma línea que una cuenta de otro banco, con el
-- código de banco 9999 y la llave en el campo de cuenta (17 caracteres). Por eso
-- basta un método y la llave: el resto de la fila —titular, documento,
-- dirección— es igual para los dos.
-- ---------------------------------------------------------------------------

alter table public.store_bank_accounts
  add column if not exists payment_method text not null default 'account',
  add column if not exists breb_key text;

alter table public.store_bank_accounts
  alter column bank_code drop not null,
  alter column account_kind drop not null,
  alter column account_number drop not null;

alter table public.store_bank_accounts
  drop constraint if exists store_bank_accounts_payment_method_check,
  add constraint store_bank_accounts_payment_method_check
    check (payment_method in ('account', 'breb'));

-- Cada método exige lo suyo. La llave: ASCII imprimible sin espacios y hasta 17
-- caracteres, que es lo que cabe en el campo del archivo; una más larga
-- (un correo, por ejemplo) no tendría cómo pagarse.
--
-- El `is not null` de la llave no sobra: `null ~ patrón` da null, y un CHECK que
-- da null se da por cumplido. Sin él pasaba una llave vacía.
alter table public.store_bank_accounts
  drop constraint if exists store_bank_accounts_metodo_completo,
  add constraint store_bank_accounts_metodo_completo check (
    (payment_method = 'account'
      and bank_code is not null and account_kind is not null and account_number is not null)
    or
    (payment_method = 'breb'
      and breb_key is not null and breb_key ~ '^[!-~]{1,17}$')
  );

-- Los tipos de identificación que acepta el formato por líneas. El `09` (NIT
-- persona natural) del formato anterior no existe acá: un NIT es `03`.
alter table public.store_bank_accounts
  drop constraint if exists store_bank_accounts_tipo_documento,
  add constraint store_bank_accounts_tipo_documento
    check (holder_document_type in ('01', '02', '03', '04', '05'));

-- La dirección del beneficiario es obligatoria en cada línea del archivo.
alter table public.store_bank_accounts
  alter column holder_address set not null;

-- ---------------------------------------------------------------------------
-- Parámetros: solo lo que el archivo todavía usa
--
-- El ordenante (NIT, oficina, cuenta, clave del emisor) no va en el formato por
-- líneas, y el desfase del consecutivo era del nombre `COA#####.TRA` del formato
-- anterior. Queda el concepto de pago —el Concepto 1 de cada línea, 40
-- caracteres— y los días de espera, que son regla de la plataforma.
-- ---------------------------------------------------------------------------

alter table public.payout_settings_history
  drop column if exists orderer_document_type,
  drop column if exists orderer_document_number,
  drop column if exists orderer_dv,
  drop column if exists orderer_suffix,
  drop column if exists orderer_name,
  drop column if exists orderer_address,
  drop column if exists orderer_city,
  drop column if exists bbva_office_code,
  drop column if exists bbva_account_number,
  drop column if exists emitter_key,
  drop column if exists file_consecutive_offset;

alter table public.payout_settings_history
  drop constraint if exists payout_settings_history_concepto_largo,
  add constraint payout_settings_history_concepto_largo
    check (char_length(payment_concept) between 1 and 40);

-- Con el ordenante fuera ya no hay nada que dependa del banco, así que se siembra
-- una fila vigente: la dispersión funciona sin configurar nada primero.
insert into public.payout_settings_history (payment_concept, hold_days, notes)
select 'Pago de ventas MercaMesa', 3, 'Valores iniciales del formato por líneas.'
where not exists (select 1 from public.payout_settings_history);

-- ---------------------------------------------------------------------------
-- Bancos: los códigos del anexo de BBVA (`docs/dispersiones/pagosPorLineas.md`)
--
-- El 9999 de la llave Bre-B no se agrega: no es un banco que la tienda elija,
-- sino el código fijo de esa línea.
-- ---------------------------------------------------------------------------

insert into public.banks (code, name) values
  ('0001', 'Banco de Bogotá'),
  ('0002', 'Banco Popular'),
  ('0006', 'Corpbanca'),
  ('0007', 'Bancolombia'),
  ('0008', 'Scotiabank Colombia S.A.'),
  ('0009', 'Citibank'),
  ('0010', 'HSBC'),
  ('0012', 'GNB Sudameris'),
  ('0013', 'BBVA Colombia'),
  ('0014', 'Helm Bank'),
  ('0019', 'Red Multibanca Colpatria'),
  ('0023', 'Banco de Occidente'),
  ('0031', 'Bancoldex'),
  ('0032', 'Banco Caja Social'),
  ('0040', 'Banco Agrario'),
  ('0041', 'JPMorgan'),
  ('0042', 'BNP Paribas'),
  ('0051', 'Banco Davivienda'),
  ('0052', 'Banco AV Villas'),
  ('0058', 'Banco Procredit'),
  ('0060', 'Banco Pichincha'),
  ('0061', 'Banco Coomeva'),
  ('0076', 'Coopcentral'),
  ('0082', 'Coomeva'),
  ('0083', 'Compensar'),
  ('0084', 'Gestión y Contacto'),
  ('0086', 'Asopagos S.A.'),
  ('0087', 'Fedecajas'),
  ('0088', 'Simple S.A.'),
  ('0089', 'Enlace Operativo S.A.'),
  ('0090', 'Corficolombiana'),
  ('0283', 'Coofiantioquia'),
  ('0289', 'Cootrafa Coop. Financiera'),
  ('0292', 'Banco Confiar'),
  ('0296', 'Financiera Juriscoop'),
  ('0502', 'Fiduciaria Skandia'),
  ('0550', 'Deceval'),
  ('0683', 'Dirección del Tesoro Nacional')
on conflict (code) do nothing;
