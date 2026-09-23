-- Dónde consignarle a cada tienda.
--
-- Hoy `stores` no guarda un solo dato bancario: la plataforma le cobra al
-- comprador, le factura, y no tiene cómo pagarle al tendero. Esto es la primera
-- de tres migraciones del módulo de dispersiones.
--
-- El archivo plano del banco escribe la cuenta de DOS formas distintas según el
-- banco, y eso manda sobre el diseño de la tabla:
--
--   * Si es BBVA ('0013'), va en los campos 12 a 14 del registro 210 como un
--     bloque de 16: oficina(4) + '00' + cuenta(10), donde los dos primeros
--     dígitos de la cuenta son el tipo (01 corriente / 02 ahorros).
--   * Si es otro banco, esos tres campos van en ceros y la cuenta va en los
--     campos 15 y 16: tipo de cuenta NACHAM(2) + número(17, alfanumérico).
--
-- Por eso hace falta `bbva_office_code`, que solo aplica al primer caso.


-- ---------------------------------------------------------------------------
-- 1. El catálogo de bancos
--
-- Se siembra ÚNICAMENTE BBVA, que es el código que la norma confirma
-- (`docs/dispersiones.md`, campo 9 de la cabecera). Los demás salen del "anexo
-- 1" del banco, que no está entre los documentos que tenemos, y los carga el
-- superadmin desde la pantalla.
--
-- Inventarlos acá sería mandarle la plata de un tendero al banco equivocado.
-- ---------------------------------------------------------------------------
create table if not exists public.banks (
  code char(4) primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.banks is
  'Códigos de banco del archivo de dispersión (anexo 1 de BBVA Global C@sh).';

insert into public.banks (code, name)
values ('0013', 'BBVA Colombia')
on conflict (code) do nothing;

alter table public.banks enable row level security;

drop policy if exists banks_select on public.banks;
create policy banks_select on public.banks
  for select to authenticated using (true);

drop policy if exists banks_insert on public.banks;
create policy banks_insert on public.banks
  for insert to authenticated
  with check (public.has_permission('payouts', 'create'));

drop policy if exists banks_update on public.banks;
create policy banks_update on public.banks
  for update to authenticated
  using (public.has_permission('payouts', 'update'));


-- ---------------------------------------------------------------------------
-- 2. La cuenta de cada tienda
--
-- Una fila por cuenta, y nunca se edita en sitio: cambiar de cuenta es insertar
-- una nueva y bajar la anterior. Así "¿a qué cuenta le pagamos en marzo?" sigue
-- teniendo respuesta después de que el tendero la cambie.
--
-- El tendero la PROPONE; queda en 'pending' hasta que el superadmin la coteje
-- contra el certificado bancario que ya se sube en `store_documents`. Sin
-- verificar no se dispersa, que es lo que impide que alguien entre a la cuenta
-- de un tendero, cambie el número y desvíe el siguiente pago.
-- ---------------------------------------------------------------------------
create table if not exists public.store_bank_accounts (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,

  bank_code char(4) not null references public.banks(code),
  -- 'checking' → '01', 'savings' → '02' en el archivo.
  account_kind text not null check (account_kind in ('checking', 'savings')),
  account_number text not null,
  -- Solo para cuentas BBVA: es su campo 12 y no se puede deducir del número.
  bbva_office_code char(4),

  -- Códigos de identificación del ARCHIVO, no los de `identification_types`:
  -- '01' cédula, '03' NIT, etc. Se guardan tal cual para no tener que traducir
  -- al generar, que es donde un error no se ve hasta que el banco rechaza.
  holder_document_type char(2) not null,
  holder_document_number text not null,
  -- Dígito de verificación. Solo lo tiene el NIT; en los demás casos es '0'.
  holder_document_dv char(1) not null default '0',
  -- 36 posiciones en el registro 220. Se guarda completo y se trunca al generar.
  holder_name text not null,
  holder_address text,
  holder_email text,

  status text not null default 'pending'
    check (status in ('pending', 'verified', 'rejected')),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,

  -- La vigente. Las anteriores quedan en falso, no se borran.
  is_current boolean not null default true,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),

  constraint store_bank_accounts_bbva_office
    check (bank_code <> '0013' or bbva_office_code is not null)
);

comment on table public.store_bank_accounts is
  'Cuenta bancaria a la que se le dispersa a cada tienda. Append-only: cambiarla es insertar otra y bajar la anterior.';

comment on column public.store_bank_accounts.bbva_office_code is
  'Campo 12 del registro 210. Obligatorio si el banco es BBVA; nulo en los demás.';

comment on column public.store_bank_accounts.holder_document_type is
  'Código del ARCHIVO del banco (01 cédula, 03 NIT), no el de identification_types.';

-- Una sola cuenta vigente por tienda. Es lo que deja al generador elegir sin
-- desempatar.
create unique index if not exists store_bank_accounts_vigente_idx
  on public.store_bank_accounts (store_id)
  where is_current;

create index if not exists store_bank_accounts_store_idx
  on public.store_bank_accounts (store_id, created_at desc);

-- Para la bandeja de "pendientes por verificar".
create index if not exists store_bank_accounts_pendientes_idx
  on public.store_bank_accounts (status)
  where status = 'pending' and is_current;

alter table public.store_bank_accounts enable row level security;

-- El tendero ve las de su tienda; quien administra dispersiones, todas.
drop policy if exists store_bank_accounts_select on public.store_bank_accounts;
create policy store_bank_accounts_select on public.store_bank_accounts
  for select to authenticated
  using (public.is_store_member(store_id) or public.has_permission('payouts', 'read'));

-- El tendero propone. El `status` y `verified_*` no se pueden sembrar desde acá:
-- lo impide el disparador de más abajo, porque RLS filtra filas, no columnas.
drop policy if exists store_bank_accounts_insert on public.store_bank_accounts;
create policy store_bank_accounts_insert on public.store_bank_accounts
  for insert to authenticated
  with check (public.is_store_member(store_id) or public.has_permission('payouts', 'create'));

-- Actualizar es solo bajar la vigente o verificarla.
drop policy if exists store_bank_accounts_update on public.store_bank_accounts;
create policy store_bank_accounts_update on public.store_bank_accounts
  for update to authenticated
  using (public.is_store_member(store_id) or public.has_permission('payouts', 'update'));


-- ---------------------------------------------------------------------------
-- 3. Que el tendero no se autoverifique
--
-- RLS filtra filas, no columnas: con la política de arriba, un tendero podría
-- insertar su cuenta ya en 'verified', o actualizarla a 'verified' después. El
-- guardián tiene que ser un disparador.
-- ---------------------------------------------------------------------------
create or replace function public.guard_store_bank_account()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  puede_verificar boolean;
begin
  puede_verificar := public.has_permission('payouts', 'update');

  if tg_op = 'INSERT' then
    -- Una cuenta nace pendiente, la proponga quien la proponga. Verificarla es
    -- un acto aparte y deliberado, con su propio registro de quién y cuándo.
    new.status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
    new.rejection_reason := null;
    new.created_by := auth.uid();
    return new;
  end if;

  if new.status is distinct from old.status and not puede_verificar then
    raise exception 'Solo quien administra dispersiones puede verificar una cuenta bancaria'
      using errcode = 'insufficient_privilege';
  end if;

  -- Los datos de la cuenta no se editan: se propone una nueva. Editar en sitio
  -- una cuenta ya verificada sería cambiar el destino del dinero sin que nadie
  -- lo vuelva a mirar.
  if not puede_verificar and (
       new.bank_code is distinct from old.bank_code
    or new.account_number is distinct from old.account_number
    or new.account_kind is distinct from old.account_kind
    or new.bbva_office_code is distinct from old.bbva_office_code
    or new.holder_document_number is distinct from old.holder_document_number
    or new.holder_document_type is distinct from old.holder_document_type
    or new.holder_name is distinct from old.holder_name
  ) then
    raise exception 'Los datos de una cuenta no se editan: registra una cuenta nueva'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status = 'verified' and old.status is distinct from 'verified' then
    new.verified_by := auth.uid();
    new.verified_at := now();
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

drop trigger if exists store_bank_accounts_guard on public.store_bank_accounts;
create trigger store_bank_accounts_guard
  before insert or update on public.store_bank_accounts
  for each row execute function public.guard_store_bank_account();

comment on function public.guard_store_bank_account() is
  'Impide que quien propone una cuenta la verifique, y que una cuenta se edite en sitio.';
