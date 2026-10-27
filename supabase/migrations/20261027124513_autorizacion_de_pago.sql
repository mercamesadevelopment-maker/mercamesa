-- Autorización para la dispersión de fondos, aceptada al registrar la cuenta.
--
-- Quien registra a dónde se le paga a una tienda acepta un texto que autoriza a
-- MercaMesa a transferir a esa cuenta y lo hace responsable de los datos que
-- escribe. Cada cuenta guarda qué versión del texto se aceptó y cuándo: es la
-- constancia si después hay un reclamo por una transferencia a una cuenta
-- equivocada. El texto vive en `lib/payouts/authorization.ts`.
--
-- Las cuentas registradas antes de esto quedan sin autorización (null). No se
-- les inventa una: la bandeja de verificación lo muestra, y la próxima vez que
-- la tienda cambie su cuenta la acepta.

alter table public.store_bank_accounts
  add column authorization_version text,
  add column authorization_accepted_at timestamptz;

comment on column public.store_bank_accounts.authorization_version is
  'Versión del texto de autorización de pago que aceptó quien registró la cuenta (lib/payouts/authorization.ts). Null en las registradas antes de existir.';
comment on column public.store_bank_accounts.authorization_accepted_at is
  'Cuándo se aceptó la autorización. La fija el disparador con la hora del servidor.';

-- El disparador de siempre, con dos reglas más:
--   * una cuenta nueva no entra sin la versión aceptada, y la fecha la pone la
--     base, no quien escribe;
--   * la constancia no se cambia después, ni siquiera quien verifica.
create or replace function public.guard_store_bank_account() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
declare
  puede_verificar boolean;
begin
  puede_verificar := public.has_permission('payouts', 'update');

  if tg_op = 'INSERT' then
    if nullif(trim(new.authorization_version), '') is null then
      raise exception 'Hay que aceptar la autorización de pago para registrar la cuenta'
        using errcode = 'check_violation';
    end if;
    new.authorization_accepted_at := now();
    new.status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
    new.rejection_reason := null;
    new.created_by := auth.uid();
    return new;
  end if;

  if new.authorization_version is distinct from old.authorization_version
    or new.authorization_accepted_at is distinct from old.authorization_accepted_at then
    raise exception 'La autorización aceptada no se cambia: registra una cuenta nueva'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is distinct from old.status and not puede_verificar then
    raise exception 'Solo quien administra dispersiones puede verificar una cuenta bancaria'
      using errcode = 'insufficient_privilege';
  end if;

  if not puede_verificar and (
       new.payment_method is distinct from old.payment_method
    or new.breb_key is distinct from old.breb_key
    or new.bank_code is distinct from old.bank_code
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

comment on function public.guard_store_bank_account() is
  'Impide que quien propone una cuenta la verifique, que una cuenta se edite en sitio y que se registre sin aceptar la autorización de pago.';
