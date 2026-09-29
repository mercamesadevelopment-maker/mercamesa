-- La llave Bre-B tampoco se edita en sitio.
--
-- `guard_store_bank_account` impide que una tienda cambie los datos de una cuenta
-- ya registrada —banco, número, titular—: para cambiarlos hay que registrar una
-- cuenta nueva, que nace `pending` y vuelve a pasar por verificación. Con el pago
-- por llave Bre-B aparecieron dos campos que deciden a dónde va la plata y que el
-- disparador no conocía: `payment_method` y `breb_key`. Sin esto, una tienda con
-- la llave ya verificada podía cambiarla por otra y la siguiente dispersión
-- pagaría a la nueva sin que nadie la revisara.

create or replace function public.guard_store_bank_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  puede_verificar boolean;
begin
  puede_verificar := public.has_permission('payouts', 'update');

  if tg_op = 'INSERT' then
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
$function$;
