-- Base consolidada del esquema de MercaMesa.
--
-- Es el esquema de producción tal como estaba el 1 de octubre de 2026. El
-- esquema original se creó desde el panel de Supabase y nunca estuvo en un
-- archivo; las 71 migraciones que vinieron después (ahora en
-- `supabase/migrations_legacy`, solo como historia) eran cambios sobre algo que
-- no se podía reconstruir. Esta base las reemplaza a todas.
--
-- La primera parte es el volcado de `supabase db dump`. La segunda, al final,
-- es lo que el volcado no incluye: Storage y tareas programadas.
--
-- En producción NO se ejecuta: está registrada como aplicada.




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_language" AS ENUM (
    'es',
    'en'
);


ALTER TYPE "public"."app_language" OWNER TO "postgres";


CREATE TYPE "public"."buyer_type" AS ENUM (
    'retail',
    'wholesale'
);


ALTER TYPE "public"."buyer_type" OWNER TO "postgres";


CREATE TYPE "public"."cart_item_status" AS ENUM (
    'active',
    'pending'
);


ALTER TYPE "public"."cart_item_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_status" AS ENUM (
    'available',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'failed'
);


ALTER TYPE "public"."delivery_status" OWNER TO "postgres";


CREATE TYPE "public"."invitation_type_enum" AS ENUM (
    'marketplace_member',
    'store_member',
    'delivery_user',
    'admin'
);


ALTER TYPE "public"."invitation_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'confirmed',
    'paid',
    'packing',
    'at_collection',
    'dispatched',
    'delivered',
    'cancelled',
    'returned'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'processing',
    'approved',
    'rejected',
    'refunded',
    'disputed'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."stock_movement_type" AS ENUM (
    'entry',
    'exit',
    'adjustment'
);


ALTER TYPE "public"."stock_movement_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  v_count integer;
begin
  if not public.has_permission('users', 'update') then
    raise exception 'No autorizado para revocar sesiones';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;


ALTER FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") IS 'Cierra todas las sesiones de un usuario. Exige permiso users:update. El access token vigente sobrevive hasta expirar.';



CREATE OR REPLACE FUNCTION "public"."anonymize_buyer"("target" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  correo_original text;
  documento_original text;
begin
  select email, document_number into correo_original, documento_original
  from profiles where id = target;

  if correo_original is null then
    raise exception 'No existe el perfil %', target using errcode = 'no_data_found';
  end if;

  delete from clients
  where profile_id = target
     or (documento_original is not null and document_number = documento_original);

  delete from delivery_addresses where buyer_id = target;

  update orders
  set delivery_address_snapshot = jsonb_build_object(
        'municipality', delivery_address_snapshot -> 'municipality',
        'department', delivery_address_snapshot -> 'department',
        'anonymized', true
      )
  where buyer_id = target
    and delivery_address_snapshot is not null;

  update orders set notes = null where buyer_id = target and notes is not null;

  update store_orders so set notes = null
  from orders o
  where so.order_id = o.id and o.buyer_id = target and so.notes is not null;

  update store_reviews set comment = null
  where buyer_id = target and comment is not null;

  update payments p
  set callback_response = jsonb_build_object(
        'anonymized', true,
        'status', p.status,
        'provider_payment_id', p.provider_payment_id,
        'amount', p.amount
      )
  from orders o
  where p.order_id = o.id and o.buyer_id = target and p.callback_response is not null;

  update pibox_bookings pb
  set raw = jsonb_build_object('anonymized', true)
  from store_orders so
  join orders o on o.id = so.order_id
  where pb.store_order_id = so.id and o.buyer_id = target and pb.raw is not null;

  delete from password_change_codes where user_id = target or email = correo_original;
  delete from admin_login_codes where user_id = target or email = correo_original;
  delete from password_reset_codes where email = correo_original;
  delete from email_change_codes
    where user_id = target or current_email = correo_original or new_email = correo_original;
  delete from signup_email_codes where email = correo_original;

  update legal_acceptances set accepted_ip = null
  where user_id = target and accepted_ip is not null;

  update profiles
  set full_name = 'Usuario eliminado',
      email = 'eliminado+' || target::text || '@mercamesa.invalid',
      phone = null,
      document_number = null,
      document_type = null,
      avatar_url = null,
      business_name = null,
      contact_name = null,
      identification_type_id = null,
      person_type = null,
      person_type_id = null,
      siigo_customer_id = null,
      is_active = false,
      anonymized_at = now()
  where id = target;
end;
$$;


ALTER FUNCTION "public"."anonymize_buyer"("target" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."anonymize_buyer"("target" "uuid") IS 'Suprime los datos personales de un comprador conservando sus pedidos y la constancia de aceptacion de terminos. Todo o nada.';



CREATE OR REPLACE FUNCTION "public"."apply_buyer_credit"("p_buyer" "uuid", "p_amount" numeric, "p_kind" "text", "p_refund" "uuid" DEFAULT NULL::"uuid", "p_order" "uuid" DEFAULT NULL::"uuid", "p_notes" "text" DEFAULT NULL::"text", "p_by" "uuid" DEFAULT NULL::"uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  saldo numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('buyer_credit:' || p_buyer::text, 0));

  saldo := public.buyer_credit_balance(p_buyer);

  if saldo + p_amount < 0 then
    raise exception 'SALDO_INSUFICIENTE' using errcode = 'P0001';
  end if;

  insert into public.buyer_credit_movements (buyer_id, amount, kind, refund_id, order_id, notes, created_by)
  values (p_buyer, p_amount, p_kind, p_refund, p_order, p_notes, p_by);

  return saldo + p_amount;
end;
$$;


ALTER FUNCTION "public"."apply_buyer_credit"("p_buyer" "uuid", "p_amount" numeric, "p_kind" "text", "p_refund" "uuid", "p_order" "uuid", "p_notes" "text", "p_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."buyer_credit_balance"("p_buyer" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(sum(amount), 0) from public.buyer_credit_movements where buyer_id = p_buyer;
$$;


ALTER FUNCTION "public"."buyer_credit_balance"("p_buyer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_app_cron"("path" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'app_cron_secret';

  if base_url is null or secret is null then
    raise exception 'Faltan los secretos app_base_url o app_cron_secret en Vault';
  end if;

  return net.http_post(
    url := rtrim(base_url, '/') || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;


ALTER FUNCTION "public"."call_app_cron"("path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."call_edge_cron"("fn" "text") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'net', 'vault'
    AS $$
declare
  project_url text := 'https://zaqvcpehhmkiyjdbcufj.supabase.co';
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'app_cron_secret';

  if secret is null then
    raise exception 'Falta el secreto app_cron_secret en Vault';
  end if;

  return net.http_post(
    url := project_url || '/functions/v1/' || fn,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;


ALTER FUNCTION "public"."call_edge_cron"("fn" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_refund"("p" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_id uuid;
  v_pqrs uuid := (p->>'pqrs_id')::uuid;
  v_order uuid := (p->>'order_id')::uuid;
  v_buyer uuid := (p->>'buyer_id')::uuid;
  v_total numeric := (p->>'total_amount')::numeric;
  v_products numeric := (p->>'products_amount')::numeric;
  v_by uuid := nullif(p->>'created_by', '')::uuid;
  v_order_total numeric;
  v_payment text;
  v_previo numeric;
  item jsonb;
  v_pedida numeric;
  v_devuelta numeric;
begin
  -- Reintento de la misma aprobación: se devuelve la que ya existe.
  select id into v_id from public.order_refunds where pqrs_id = v_pqrs;
  if found then
    return v_id;
  end if;

  select total, payment_status::text into v_order_total, v_payment
    from public.orders where id = v_order for update;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE' using errcode = 'P0001';
  end if;
  if v_payment is distinct from 'approved' then
    raise exception 'PEDIDO_SIN_PAGO' using errcode = 'P0001';
  end if;

  -- Otra aprobación pudo entrar mientras se esperaba el candado.
  select id into v_id from public.order_refunds where pqrs_id = v_pqrs;
  if found then
    return v_id;
  end if;

  select coalesce(sum(total_amount), 0) into v_previo from public.order_refunds where order_id = v_order;
  if v_previo + v_total > v_order_total then
    raise exception 'DEVOLUCION_EXCEDE_PEDIDO' using errcode = 'P0001';
  end if;

  for item in select * from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) loop
    select quantity into v_pedida from public.order_items
     where id = (item->>'order_item_id')::uuid and order_id = v_order;
    if not found then
      raise exception 'PRODUCTO_NO_ES_DEL_PEDIDO' using errcode = 'P0001';
    end if;

    select coalesce(sum(ri.quantity), 0) into v_devuelta
      from public.order_refund_items ri
     where ri.order_item_id = (item->>'order_item_id')::uuid;

    if v_devuelta + (item->>'quantity')::numeric > v_pedida then
      raise exception 'CANTIDAD_EXCEDE_PEDIDO' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.order_refunds (
    pqrs_id, order_id, store_order_id, store_id, buyer_id, scope,
    products_amount, service_commission_amount, platform_commission_amount,
    messages_amount, delivery_amount, total_amount, liable, created_by
  ) values (
    v_pqrs, v_order, nullif(p->>'store_order_id', '')::uuid, (p->>'store_id')::uuid, v_buyer, p->>'scope',
    v_products,
    coalesce((p->>'service_commission_amount')::numeric, 0),
    coalesce((p->>'platform_commission_amount')::numeric, 0),
    coalesce((p->>'messages_amount')::numeric, 0),
    coalesce((p->>'delivery_amount')::numeric, 0),
    v_total, p->>'liable', v_by
  )
  returning id into v_id;

  insert into public.order_refund_items (refund_id, order_item_id, quantity, amount)
  select v_id, (i->>'order_item_id')::uuid, (i->>'quantity')::numeric, (i->>'amount')::numeric
    from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) i;

  perform public.apply_buyer_credit(v_buyer, v_total, 'refund', v_id, v_order, null, v_by);

  -- La tienda solo asume el valor de sus productos, nunca las comisiones.
  if p->>'liable' = 'store' and v_products > 0 then
    insert into public.store_charges (store_id, store_order_id, refund_id, amount)
    values ((p->>'store_id')::uuid, nullif(p->>'store_order_id', '')::uuid, v_id, v_products);
  end if;

  return v_id;
end;
$$;


ALTER FUNCTION "public"."create_order_refund"("p" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."email_registrado_en_auth"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;


ALTER FUNCTION "public"."email_registrado_en_auth"("p_email" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."email_registrado_en_auth"("p_email" "text") IS 'Si existe un usuario de Auth con ese correo. La usa el registro para no dejar avanzar a alguien que después chocaría contra auth.signUp.';



CREATE OR REPLACE FUNCTION "public"."enqueue_siigo_credit_note"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.siigo_credit_notes (refund_id)
  values (new.id)
  on conflict (refund_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_siigo_credit_note"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_siigo_invoice"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.siigo_invoices (order_id)
  values (new.order_id)
  on conflict (order_id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."enqueue_siigo_invoice"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."escalate_overdue_pqrs"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  vencidas integer;
begin
  with vencidos as (
    update public.pqrs
       set status = 'in_review',
           store_response = 'expired'
     where status = 'awaiting_store'
       and store_response_due_at is not null
       and store_response_due_at <= now()
    returning id
  ),
  aviso as (
    insert into public.pqrs_messages (pqrs_id, author_as, body)
    select id, 'system',
           'La tienda no respondió dentro del plazo. El caso pasa a revisión de MercaMesa.'
      from vencidos
    returning 1
  )
  select count(*) into vencidas from aviso;

  return vencidas;
end;
$$;


ALTER FUNCTION "public"."escalate_overdue_pqrs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_unpaid_orders"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  vencidos uuid[];
begin
  select coalesce(array_agg(id), '{}') into vencidos
  from (
    select o.id
    from public.orders o
    where o.client_id is null
      and o.status = 'pending'
      and o.expired_at is null
      and public.payable_until(o) < now()
      and not exists (
        select 1 from public.store_orders so
        where so.order_id = o.id
          and so.status not in ('pending', 'cancelled')
      )
    for update skip locked
  ) candidatos;

  if cardinality(vencidos) = 0 then
    return 0;
  end if;

  update public.orders
  set status = 'cancelled', expired_at = now(), updated_at = now()
  where id = any(vencidos);

  update public.store_orders
  set status = 'cancelled', updated_at = now()
  where order_id = any(vencidos)
    and status = 'pending';

  return cardinality(vencidos);
end;
$$;


ALTER FUNCTION "public"."expire_unpaid_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_confirm_store_orders_on_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if NEW.payment_status = 'approved'
     and OLD.payment_status is distinct from 'approved' then

    update public.store_orders
    set status = 'confirmed'
    where order_id = NEW.id
      and (status = 'pending'
           or (status = 'cancelled' and NEW.expired_at is not null));
  end if;

  return NEW;
end;
$$;


ALTER FUNCTION "public"."fn_confirm_store_orders_on_payment"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_confirm_store_orders_on_payment"() IS 'Al aprobarse el pago, pasa los store_orders pendientes a confirmed. Es lo que dispara fn_process_store_order_status_change y con ello el descuento de stock.';



CREATE OR REPLACE FUNCTION "public"."fn_guard_store_document_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if not has_permission('stores', 'update') then
      new.status := 'pending';
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if has_permission('stores', 'update') then
    return new;
  end if;

  if new.file_url is distinct from old.file_url and new.status = 'pending' then
    return new;
  end if;

  raise exception 'Solo un administrador puede cambiar el estado de un documento'
    using errcode = 'check_violation';
end;
$$;


ALTER FUNCTION "public"."fn_guard_store_document_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from store_members sm
    where sm.store_id = p_store_id
      and sm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") IS 'True si el usuario autenticado pertenece a la tienda. Para políticas RLS.';



CREATE OR REPLACE FUNCTION "public"."fn_log_store_document_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'upload', new.file_url, new.status, null, auth.uid());

    return new;
  end if;

  if new.file_url is distinct from old.file_url then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'upload', new.file_url, new.status, old.status, auth.uid());

  elsif new.status is distinct from old.status then
    insert into store_document_events (
      store_id, document_type_id, event_type, file_url, status, previous_status, actor_id
    )
    values (new.store_id, new.document_type_id, 'status_change', new.file_url, new.status, old.status, auth.uid());
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_log_store_document_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_order_credit_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.credit_applied <= 0 or new.buyer_id is null then
    return new;
  end if;

  if new.payment_status = 'approved'
     and old.payment_status is distinct from 'approved'
     and new.credit_released_at is not null then
    insert into public.buyer_credit_movements (buyer_id, amount, kind, order_id, notes)
    values (new.buyer_id, -new.credit_applied, 'redemption', new.id,
            'El pago se aprobó después de vencer el pedido: el saldo se vuelve a usar.');
    new.credit_released_at := null;

  elsif new.credit_released_at is null
        and new.payment_status is distinct from 'approved'
        and (new.status = 'cancelled' or new.expired_at is not null) then
    insert into public.buyer_credit_movements (buyer_id, amount, kind, order_id, notes)
    values (new.buyer_id, new.credit_applied, 'release', new.id, null);
    new.credit_released_at := now();
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_order_credit_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_process_store_order_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    item_record RECORD;
    is_new_confirmed BOOLEAN;
    is_new_cancelled BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        is_new_confirmed := (NEW.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
        is_new_cancelled := false;
    ELSE
        is_new_confirmed := (NEW.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'))
                            AND (OLD.status NOT IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
        is_new_cancelled := (NEW.status IN ('cancelled', 'returned', 'pending'))
                            AND (OLD.status IN ('confirmed', 'paid', 'packing', 'at_collection', 'dispatched', 'delivered'));
    END IF;

    IF is_new_confirmed THEN
        FOR item_record IN
            SELECT oi.store_product_id, oi.quantity, sp.store_id
            FROM public.order_items oi
            JOIN public.store_products sp ON sp.id = oi.store_product_id
            WHERE oi.order_id = NEW.order_id AND sp.store_id = NEW.store_id
        LOOP
            INSERT INTO public.product_stock_movements (
                store_product_id, store_id, type, quantity,
                reference_id, reference_type, notes
            ) VALUES (
                item_record.store_product_id,
                item_record.store_id,
                'exit',
                item_record.quantity,
                NEW.id,
                'order',
                'Salida automática por confirmación de pedido #' || NEW.order_id
            );

            UPDATE public.store_products
            SET stock = stock - item_record.quantity
            WHERE id = item_record.store_product_id;
        END LOOP;

    ELSIF is_new_cancelled THEN
        FOR item_record IN
            SELECT oi.store_product_id, oi.quantity, sp.store_id
            FROM public.order_items oi
            JOIN public.store_products sp ON sp.id = oi.store_product_id
            WHERE oi.order_id = NEW.order_id AND sp.store_id = NEW.store_id
        LOOP
            INSERT INTO public.product_stock_movements (
                store_product_id, store_id, type, quantity,
                reference_id, reference_type, notes
            ) VALUES (
                item_record.store_product_id,
                item_record.store_id,
                'entry',
                item_record.quantity,
                NEW.id,
                'order',
                CASE
                    WHEN NEW.status = 'pending'
                        THEN 'Reingreso automático por reversión a Nuevo del pedido #' || NEW.order_id
                    ELSE 'Reingreso automático por cancelación de pedido #' || NEW.order_id
                END
            );

            UPDATE public.store_products
            SET stock = stock + item_record.quantity
            WHERE id = item_record.store_product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fn_process_store_order_status_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_store_documents_guard_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if public.has_permission('stores', 'update') then
    return new;
  end if;

  if new.status is distinct from 'pending' then
    raise exception 'Solo un administrador puede decidir el estado de un documento.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."fn_store_documents_guard_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_profile_authority"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  rol_peticion text := coalesce(auth.jwt() ->> 'role', '');
  rol_comprador uuid;
begin
  if rol_peticion not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.role_id is distinct from old.role_id then
      raise exception 'El rol de un perfil no se puede cambiar desde la cuenta del propio usuario.'
        using errcode = '42501';
    end if;

    if new.is_active is distinct from old.is_active then
      raise exception 'La activación de un perfil no se puede cambiar desde la cuenta del propio usuario.'
        using errcode = '42501';
    end if;

    return new;
  end if;

  select id into rol_comprador from public.roles where name = 'buyer';

  if new.role_id is distinct from rol_comprador then
    raise exception 'Una cuenta nueva solo puede registrarse como comprador.'
      using errcode = '42501';
  end if;

  if new.is_active is false then
    raise exception 'Una cuenta nueva no puede crearse inactiva.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_profile_authority"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_store_bank_account"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."guard_store_bank_account"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_store_bank_account"() IS 'Impide que quien propone una cuenta la verifique, y que una cuenta se edite en sitio.';



CREATE OR REPLACE FUNCTION "public"."has_permission"("module_key" "text", "action_name" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp
      on rp.role_id = p.role_id
    join modules m
      on m.id = rp.module_id
    join actions a
      on a.id = rp.action_id
    where p.id = auth.uid()
      and p.is_active = true
      and m.key = module_key
      and a.name = action_name
  );
$$;


ALTER FUNCTION "public"."has_permission"("module_key" "text", "action_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."immutable_unaccent"("texto" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT PARALLEL SAFE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select unaccent('unaccent', texto)
$$;


ALTER FUNCTION "public"."immutable_unaccent"("texto" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."immutable_unaccent"("texto" "text") IS 'unaccent() con el diccionario fijo, para poder usarlo en columnas generadas e índices. No usar para otra cosa: unaccent() a secas es suficiente en consultas normales.';



CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid() and r.name in ('admin', 'superadmin')
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_platform_admin"() IS 'El usuario actual es administrador de la plataforma. Para politicas RLS.';



CREATE OR REPLACE FUNCTION "public"."is_store_member"("p_store_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.store_members sm
    where sm.store_id = p_store_id and sm.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_store_member"("p_store_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_store_member"("p_store_id" "uuid") IS 'El usuario actual pertenece a la tienda. Se usa dentro de politicas RLS.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "buyer_id" "uuid",
    "delivery_address_id" "uuid",
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "buyer_type" "public"."buyer_type" DEFAULT 'retail'::"public"."buyer_type" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "address_change_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "discount" numeric(10,2) DEFAULT 0 NOT NULL,
    "total" numeric(14,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_idempotency_key" character varying(255),
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "client_id" "uuid",
    "consecutive" integer NOT NULL,
    "delivery_address_snapshot" "jsonb",
    "code" "text" DEFAULT ''::"text" NOT NULL,
    "service_commission_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "messages_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "platform_commission_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "pricing_settings_id" "uuid",
    "expired_at" timestamp with time zone,
    "credit_applied" numeric DEFAULT 0 NOT NULL,
    "credit_released_at" timestamp with time zone,
    CONSTRAINT "orders_code_format" CHECK (("code" ~ '^MM-[0-9]{4}-[0-9]{6}$'::"text")),
    CONSTRAINT "orders_credit_applied_check" CHECK ((("credit_applied" >= (0)::numeric) AND ("credit_applied" <= "total")))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."delivery_address_snapshot" IS 'Copia congelada de la dirección al momento de comprar. delivery_address_id dice cuál eligió el comprador; esta columna dice a dónde se envió realmente.';



COMMENT ON COLUMN "public"."orders"."code" IS 'Codigo legible de la compra completa, formato MM-AAAA-NNNNNN (ej. MM-2026-001017). Derivado de consecutive. Lo asigna el trigger set_order_code; no se escribe desde la aplicacion.';



COMMENT ON COLUMN "public"."orders"."service_commission_amount" IS 'Comision de servicio (2,99%) cobrada al comprador. Incluida en total.';



COMMENT ON COLUMN "public"."orders"."messages_amount" IS 'Mensajes de seguimiento cobrados al comprador. Incluidos en total.';



COMMENT ON COLUMN "public"."orders"."platform_commission_amount" IS 'Comision de plataforma (15% del neto). Incluida en total.';



COMMENT ON COLUMN "public"."orders"."pricing_settings_id" IS 'Tarifas que se le aplicaron a este pedido. Null en pedidos anteriores al modelo.';



COMMENT ON COLUMN "public"."orders"."expired_at" IS 'Cuándo venció sin pagarse. Distingue el vencimiento de una cancelación manual: solo un pedido vencido revive si el pago llega tarde.';



COMMENT ON COLUMN "public"."orders"."credit_applied" IS 'Saldo a favor apartado para este pedido. La pasarela cobra total - credit_applied.';



COMMENT ON COLUMN "public"."orders"."credit_released_at" IS 'El pedido no se pagó y el saldo apartado volvió al comprador.';



CREATE OR REPLACE FUNCTION "public"."payable_until"("o" "public"."orders") RETURNS timestamp with time zone
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select case
    when o.client_id is null
     and o.status = 'pending'
     and o.payment_status is distinct from 'approved'
     and o.expired_at is null
    then greatest(
      o.created_at,
      -- `payments.created_at` es `timestamp` sin zona, guardado en UTC.
      coalesce((select max(p.created_at) at time zone 'UTC' from public.payments p where p.order_id = o.id), o.created_at)
    ) + interval '2 hours'
  end;
$$;


ALTER FUNCTION "public"."payable_until"("o" "public"."orders") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_to_money"("p_refund" "uuid", "p_by" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  r public.order_refunds%rowtype;
begin
  select * into r from public.order_refunds where id = p_refund for update;

  if not found then
    raise exception 'DEVOLUCION_NO_EXISTE' using errcode = 'P0001';
  end if;
  if r.method <> 'credit' or r.status <> 'credited' then
    raise exception 'DEVOLUCION_YA_EN_DINERO' using errcode = 'P0001';
  end if;

  perform public.apply_buyer_credit(
    r.buyer_id, -r.total_amount, 'reversal', r.id, r.order_id,
    'El saldo se cambia por un reembolso en dinero.', p_by
  );

  update public.order_refunds set method = 'money', status = 'money_pending' where id = p_refund;
end;
$$;


ALTER FUNCTION "public"."refund_to_money"("p_refund" "uuid", "p_by" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_order_credit"("p_order" "uuid", "p_buyer" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  o public.orders%rowtype;
  saldo numeric;
  aparta numeric;
begin
  -- Mismo candado que `apply_buyer_credit`: dos pedidos a la vez no apartan el
  -- mismo saldo.
  perform pg_advisory_xact_lock(hashtextextended('buyer_credit:' || p_buyer::text, 0));

  select * into o from public.orders where id = p_order and buyer_id = p_buyer for update;

  if not found then
    raise exception 'PEDIDO_NO_EXISTE' using errcode = 'P0001';
  end if;

  -- Ya tiene saldo apartado, o ya no es un pedido por pagar: no se toca.
  if o.credit_applied > 0 then
    return o.credit_applied;
  end if;
  if o.client_id is not null
     or o.status <> 'pending'
     or o.payment_status = 'approved'
     or o.expired_at is not null then
    return 0;
  end if;

  saldo := public.buyer_credit_balance(p_buyer);
  aparta := least(saldo, o.total);

  if aparta <= 0 then
    return 0;
  end if;

  perform public.apply_buyer_credit(p_buyer, -aparta, 'redemption', null, p_order, null, p_buyer);

  update public.orders set credit_applied = aparta, updated_at = now() where id = p_order;

  if aparta = o.total then
    insert into public.payments (order_id, provider, str_id_pago, status, amount, payment_method, payment_method_label)
    values (p_order, 'saldo', 'saldo-' || p_order::text, 'approved', aparta, 'credit', 'Saldo a favor');

    update public.orders
       set payment_status = 'approved', status = 'confirmed', updated_at = now()
     where id = p_order;

    -- Como al aprobarse un pago: lo comprado sale del carrito.
    delete from public.cart_items where order_id = p_order;
  end if;

  return aparta;
end;
$$;


ALTER FUNCTION "public"."reserve_order_credit"("p_order" "uuid", "p_buyer" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_store_id uuid;
  v_current public.order_status;
  v_liquidado boolean := false;
begin
  if auth.uid() is null then
    raise exception 'No autorizado.' using errcode = '42501';
  end if;

  if coalesce(trim(p_notes), '') = '' then
    raise exception 'La observación es obligatoria para regresar un pedido de estado.'
      using errcode = '22023';
  end if;

  select store_id, status
    into v_store_id, v_current
    from store_orders
   where id = p_store_order_id
     for update;

  if not found then
    raise exception 'El pedido no existe.' using errcode = 'P0002';
  end if;

  if not (
    is_store_member(v_store_id)
    or exists (
      select 1
        from profiles p
        join roles r on r.id = p.role_id
       where p.id = auth.uid()
         and p.is_active
         and r.name in ('admin', 'superadmin')
    )
  ) then
    raise exception 'No tienes permiso para modificar este pedido.' using errcode = '42501';
  end if;

  if p_target_status = v_current then
    raise exception 'El pedido ya está en ese estado.' using errcode = '22023';
  end if;

  if p_target_status <> 'pending' and not exists (
    select 1
      from store_order_status_history
     where store_order_id = p_store_order_id
       and status = p_target_status
  ) then
    raise exception 'Solo puedes regresar a un estado por el que el pedido ya pasó.'
      using errcode = '22023';
  end if;

  if to_regclass('public.payout_items') is not null then
    execute
      'select exists (
         select 1
           from public.payout_items pi
           join public.payouts po on po.id = pi.payout_id
          where pi.store_order_id = $1
            and po.status <> ''cancelled''
       )'
      into v_liquidado
      using p_store_order_id;

    if v_liquidado then
      raise exception 'El pedido ya está incluido en una dispersión; anula la dispersión antes de regresarlo.'
        using errcode = '22023';
    end if;
  end if;

  update store_orders
     set status = p_target_status
   where id = p_store_order_id;

  insert into store_order_status_history (store_order_id, status, notes, changed_by, is_reversal)
  values (p_store_order_id, p_target_status, trim(p_notes), auth.uid(), true);
end;
$_$;


ALTER FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") IS 'Regresa un store_order a un estado por el que ya pasó, con observación obligatoria. Solo miembros de la tienda o admin.';



CREATE OR REPLACE FUNCTION "public"."set_order_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.code := 'MM-'
    || to_char(new.created_at at time zone 'America/Bogota', 'YYYY')
    || '-' || lpad(new.consecutive::text, 6, '0');
  return new;
end;
$$;


ALTER FUNCTION "public"."set_order_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pibox_bookings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_pibox_bookings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pqrs_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.code := 'PQR-'
    || to_char(new.created_at at time zone 'America/Bogota', 'YYYY')
    || '-' || lpad(new.consecutive::text, 6, '0');
  return new;
end;
$$;


ALTER FUNCTION "public"."set_pqrs_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_pqrs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_pqrs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_profiles_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_siigo_credit_notes_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_siigo_credit_notes_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_siigo_invoices_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_siigo_invoices_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_store_groups_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_store_groups_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_store_order_code"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  parent_code text;
begin
  select o.code into parent_code
  from public.orders o
  where o.id = new.order_id
  for update;

  if parent_code is null then
    raise exception 'La orden % no tiene codigo asignado', new.order_id;
  end if;

  new.split_index := coalesce(
    (select max(so.split_index)
       from public.store_orders so
      where so.order_id = new.order_id),
    0
  ) + 1;

  new.code := parent_code || '-' || new.split_index;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_store_order_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_store_reputation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  update public.stores
  set reputation_score = coalesce(
    (select round(avg(stars)::numeric, 2) from public.store_reviews where store_id = coalesce(new.store_id, old.store_id)),
    5.0
  )
  where id = coalesce(new.store_id, old.store_id);
  return null;
end;
$$;


ALTER FUNCTION "public"."update_store_reputation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("name" "text", "total" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select v.category_name, count(*)
  from public.vitrina_productos v
  where v.category_name is not null
    and (p_store_id is null or v.store_id = p_store_id)
  group by v.category_name
  order by v.category_name;
$$;


ALTER FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid") IS 'Categorias con productos publicados, para el carrusel de la vitrina. Con p_store_id, las de esa tienda.';



CREATE OR REPLACE FUNCTION "public"."void_store_charge"("p_refund" "uuid", "p_by" "uuid", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  c public.store_charges%rowtype;
begin
  select * into c from public.store_charges where refund_id = p_refund for update;

  if not found or c.voided_at is not null then
    raise exception 'SIN_DESCUENTO_VIGENTE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.payout_items where store_charge_id = c.id) then
    raise exception 'DESCUENTO_YA_LIQUIDADO' using errcode = 'P0001';
  end if;

  update public.store_charges
     set voided_at = now(), voided_by = p_by, void_notes = p_notes
   where id = c.id;

  update public.order_refunds set liable = 'platform' where id = p_refund;
end;
$$;


ALTER FUNCTION "public"."void_store_charge"("p_refund" "uuid", "p_by" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."actions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    CONSTRAINT "actions_name_check" CHECK (("name" = "lower"("name")))
);


ALTER TABLE "public"."actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_login_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "consumed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_login_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_user_actions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "target_user_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_user_actions_action_check" CHECK (("action" = ANY (ARRAY['password_reset_sent'::"text", 'sessions_revoked'::"text", 'data_anonymized'::"text", 'user_deactivated'::"text", 'user_reactivated'::"text"])))
);


ALTER TABLE "public"."admin_user_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."banks" (
    "code" character(4) NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."banks" OWNER TO "postgres";


COMMENT ON TABLE "public"."banks" IS 'Códigos de banco del archivo de dispersión (anexo 1 de BBVA Global C@sh).';



CREATE TABLE IF NOT EXISTS "public"."buyer_credit_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "kind" "text" NOT NULL,
    "refund_id" "uuid",
    "order_id" "uuid",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "buyer_credit_movements_amount_check" CHECK (("amount" <> (0)::numeric)),
    CONSTRAINT "buyer_credit_movements_kind_check" CHECK (("kind" = ANY (ARRAY['refund'::"text", 'redemption'::"text", 'release'::"text", 'reversal'::"text", 'adjustment'::"text"])))
);


ALTER TABLE "public"."buyer_credit_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."buyer_credit_movements" IS 'Movimientos del saldo a favor. Solo se escribe con apply_buyer_credit().';



CREATE TABLE IF NOT EXISTS "public"."buyer_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'card'::"text" NOT NULL,
    "label" "text" NOT NULL,
    "brand" "text",
    "last4" "text",
    "exp" "text",
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "zonapagos_token" character varying(50),
    "zonapagos_cliente_id" "text"
);


ALTER TABLE "public"."buyer_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "store_product_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "status" "public"."cart_item_status" DEFAULT 'active'::"public"."cart_item_status" NOT NULL,
    "order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "offer_id" "uuid",
    "notes" "text",
    CONSTRAINT "cart_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."catalog_products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "category_id" "uuid",
    "default_unit_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "is_ancestral_food" boolean DEFAULT false NOT NULL,
    "is_medicinal_plant" boolean DEFAULT false NOT NULL,
    "is_non_food" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dane_unit_code" "text",
    "dane_unit_name" "text",
    "siigo_id" "text" NOT NULL,
    "owner_group_id" "uuid",
    "siigo_synced_at" timestamp with time zone,
    "search_text" "text" GENERATED ALWAYS AS ("lower"("public"."immutable_unaccent"(((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("description", ''::"text"))))) STORED,
    CONSTRAINT "catalog_products_siigo_id_format" CHECK (("siigo_id" ~ '^[A-Za-z0-9]{1,30}$'::"text"))
);


ALTER TABLE "public"."catalog_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."catalog_products"."search_text" IS 'Nombre y descripción en minúscula y sin tildes. La calcula la base; no se escribe desde la aplicación. El cliente normaliza el término de búsqueda con `normalizeText`, que hace lo mismo.';



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "parent_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "image_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid",
    "document_number" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "identification_type_id" "uuid"
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_addresses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "label" "text",
    "address_line" "text" NOT NULL,
    "neighborhood" "text",
    "municipality" "text" DEFAULT 'Medellín'::"text" NOT NULL,
    "department" "text" DEFAULT 'Antioquia'::"text" NOT NULL,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_instructions" "text"
);


ALTER TABLE "public"."delivery_addresses" OWNER TO "postgres";


COMMENT ON COLUMN "public"."delivery_addresses"."delivery_instructions" IS 'Indicaciones del comprador para llegar a la puerta (piso, apartamento, punto de referencia). Viaja a Pibox como secondary_address del destino.';



CREATE TABLE IF NOT EXISTS "public"."document_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."document_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_change_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "current_email" "text" NOT NULL,
    "new_email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "consumed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."email_change_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."identification_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "siigo_id_type" "text",
    CONSTRAINT "identification_types_code_length" CHECK ((("char_length"("btrim"("code")) >= 1) AND ("char_length"("btrim"("code")) <= 20))),
    CONSTRAINT "identification_types_name_length" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 120)))
);


ALTER TABLE "public"."identification_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid",
    "invitation_type" "public"."invitation_type_enum" NOT NULL,
    "marketplace_id" "uuid",
    "store_id" "uuid",
    "role" "text" NOT NULL,
    "token" "text" NOT NULL,
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_acceptances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_ip" "text"
);


ALTER TABLE "public"."legal_acceptances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kind" "text" NOT NULL,
    "version" integer NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "notes" "text",
    "published_by" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notified_at" timestamp with time zone,
    "notified_count" integer,
    "notify_failed" integer,
    CONSTRAINT "legal_documents_kind_check" CHECK (("kind" = ANY (ARRAY['terms'::"text", 'privacy'::"text"])))
);


ALTER TABLE "public"."legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_delivery_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "marketplace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."marketplace_delivery_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "marketplace_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."marketplace_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplaces" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "address" "text",
    "city" "text" DEFAULT 'Medellín'::"text" NOT NULL,
    "department" "text" DEFAULT 'Antioquia'::"text" NOT NULL,
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "cover_image_url" "text",
    "logo_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_hours" "jsonb",
    "siigo_cost_center_id" integer
);


ALTER TABLE "public"."marketplaces" OWNER TO "postgres";


COMMENT ON COLUMN "public"."marketplaces"."siigo_cost_center_id" IS 'Centro de costo en Siigo. GET /v1/cost-centers';



CREATE OR REPLACE VIEW "public"."marketplaces_detail" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "name",
    NULL::"text" AS "slug",
    NULL::"text" AS "description",
    NULL::"text" AS "address",
    NULL::"text" AS "city",
    NULL::"text" AS "department",
    NULL::numeric(10,7) AS "latitude",
    NULL::numeric(10,7) AS "longitude",
    NULL::"text" AS "cover_image_url",
    NULL::"text" AS "logo_url",
    NULL::boolean AS "is_active",
    NULL::"uuid" AS "created_by",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::integer AS "stores_count",
    NULL::json AS "stores";


ALTER VIEW "public"."marketplaces_detail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_units" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "abbreviation" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."measurement_units" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "parent_id" "uuid",
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "path" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."modules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "notification_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notification_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "store_product_id" "uuid" NOT NULL,
    "catalog_name" "text" NOT NULL,
    "unit_name" "text" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "total_price" numeric(14,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_min_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "min_price" numeric(12,2) NOT NULL,
    "notes" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_min_price_history_min_price_check" CHECK (("min_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_min_price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_refund_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "amount" numeric NOT NULL,
    CONSTRAINT "order_refund_items_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "order_refund_items_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."order_refund_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pqrs_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "store_order_id" "uuid",
    "store_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "products_amount" numeric NOT NULL,
    "service_commission_amount" numeric DEFAULT 0 NOT NULL,
    "platform_commission_amount" numeric DEFAULT 0 NOT NULL,
    "messages_amount" numeric DEFAULT 0 NOT NULL,
    "delivery_amount" numeric DEFAULT 0 NOT NULL,
    "total_amount" numeric NOT NULL,
    "liable" "text" NOT NULL,
    "method" "text" DEFAULT 'credit'::"text" NOT NULL,
    "status" "text" DEFAULT 'credited'::"text" NOT NULL,
    "money_reference" "text",
    "money_paid_at" timestamp with time zone,
    "money_paid_by" "uuid",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_refunds_delivery_amount_check" CHECK (("delivery_amount" >= (0)::numeric)),
    CONSTRAINT "order_refunds_liable_check" CHECK (("liable" = ANY (ARRAY['store'::"text", 'logistics'::"text", 'platform'::"text"]))),
    CONSTRAINT "order_refunds_messages_amount_check" CHECK (("messages_amount" >= (0)::numeric)),
    CONSTRAINT "order_refunds_method_check" CHECK (("method" = ANY (ARRAY['credit'::"text", 'money'::"text"]))),
    CONSTRAINT "order_refunds_platform_commission_amount_check" CHECK (("platform_commission_amount" >= (0)::numeric)),
    CONSTRAINT "order_refunds_products_amount_check" CHECK (("products_amount" >= (0)::numeric)),
    CONSTRAINT "order_refunds_scope_check" CHECK (("scope" = ANY (ARRAY['items'::"text", 'order'::"text"]))),
    CONSTRAINT "order_refunds_service_commission_amount_check" CHECK (("service_commission_amount" >= (0)::numeric)),
    CONSTRAINT "order_refunds_status_check" CHECK (("status" = ANY (ARRAY['credited'::"text", 'money_pending'::"text", 'money_paid'::"text"]))),
    CONSTRAINT "order_refunds_total_amount_check" CHECK (("total_amount" > (0)::numeric))
);


ALTER TABLE "public"."order_refunds" OWNER TO "postgres";


COMMENT ON TABLE "public"."order_refunds" IS 'Devoluciones aprobadas por PQRS. El total es lo que se le acreditó al comprador.';



ALTER TABLE "public"."orders" ALTER COLUMN "consecutive" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."orders_consecutive_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" character varying(50) DEFAULT 'zonapagos'::character varying NOT NULL,
    "provider_payment_id" character varying(255),
    "str_id_pago" character varying(255) NOT NULL,
    "status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payment_url" "text",
    "callback_response" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "payment_method" "text",
    "payment_method_label" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "has_refrigerated" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "split_index" integer DEFAULT 0 NOT NULL,
    "code" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "store_orders_code_format" CHECK (("code" ~ '^MM-[0-9]{4}-[0-9]{6}-[0-9]+$'::"text")),
    CONSTRAINT "store_orders_split_index_positive" CHECK (("split_index" > 0))
);


ALTER TABLE "public"."store_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."store_orders"."split_index" IS 'Posicion de esta tienda dentro de la compra (1, 2, 3...). Solo sirve para construir el sufijo del codigo.';



COMMENT ON COLUMN "public"."store_orders"."code" IS 'Codigo legible del pedido tal como lo ven comprador, vendedor y admin: el codigo de la compra mas el sufijo de la tienda (ej. MM-2026-001017-1). Lo asigna el trigger set_store_order_code.';



CREATE TABLE IF NOT EXISTS "public"."store_products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "catalog_product_id" "uuid" NOT NULL,
    "unit_id" "uuid" NOT NULL,
    "price_per_unit" numeric(12,2) NOT NULL,
    "stock" numeric(12,3) DEFAULT 0 NOT NULL,
    "min_order_qty" numeric(12,3) DEFAULT 1 NOT NULL,
    "wholesale_min_qty" numeric(12,3),
    "wholesale_price" numeric(12,2),
    "is_active" boolean DEFAULT true NOT NULL,
    "last_price_update" timestamp with time zone DEFAULT "now"(),
    "updated_by_bot" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "featured_at" timestamp with time zone,
    "code" "text",
    CONSTRAINT "store_products_code_length" CHECK ((("code" IS NULL) OR (("char_length"("btrim"("code")) >= 1) AND ("char_length"("btrim"("code")) <= 50))))
);


ALTER TABLE "public"."store_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."store_products"."code" IS 'Codigo propio de la tienda para este producto (tipo codigo de barras). Unico dentro de la tienda. Nullable solo por los productos creados antes de existir la columna: la aplicacion lo exige.';



CREATE TABLE IF NOT EXISTS "public"."stores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "marketplace_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "phone" "text",
    "whatsapp" "text",
    "contact_name" "text",
    "contact_email" "text",
    "reputation_score" numeric(3,2) DEFAULT 5.00,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_hours" "jsonb",
    "category_id" "uuid",
    "store_group_id" "uuid",
    "local_address" "text",
    "is_wholesale" boolean DEFAULT false NOT NULL,
    "is_retail" boolean DEFAULT true NOT NULL,
    "address" "text",
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "city" "text",
    "department" "text",
    CONSTRAINT "stores_direccion_completa" CHECK (((("address" IS NULL) AND ("latitude" IS NULL) AND ("longitude" IS NULL)) OR (("address" IS NOT NULL) AND ("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL))))
);


ALTER TABLE "public"."stores" OWNER TO "postgres";


COMMENT ON COLUMN "public"."stores"."category_id" IS 'OBSOLETA desde 2026-09-23: usar store_category_links. Se conserva solo por si algun consumidor externo la lee; no la escribas.';



COMMENT ON COLUMN "public"."stores"."local_address" IS 'Ubicación del local DENTRO de la plaza ("Local 234, pasillo 3"). No es una dirección postal ni define el punto de recogida: eso lo deciden stores.address o, si está vacía, marketplaces.address. Se le manda al mensajero como referencia para encontrar el local.';



COMMENT ON COLUMN "public"."stores"."is_wholesale" IS 'La tienda vende al por mayor. Independiente de is_retail: puede ser ambas.';



COMMENT ON COLUMN "public"."stores"."is_retail" IS 'La tienda vende al detal. Independiente de is_wholesale: puede ser ambas.';



COMMENT ON COLUMN "public"."stores"."address" IS 'Dirección de recogida propia de la tienda. Si está vacía, el despacho usa la dirección de su plaza (marketplaces.address).';



COMMENT ON COLUMN "public"."stores"."latitude" IS 'Latitud del punto de recogida de la tienda. Va siempre junto a `address`: una dirección sin coordenadas obliga a Pibox a geocodificar el texto contra el city_code del DESTINO, y el paquete termina recogiéndose donde no es.';



COMMENT ON COLUMN "public"."stores"."longitude" IS 'Longitud del punto de recogida de la tienda. Ver el comentario de `latitude`.';



COMMENT ON COLUMN "public"."stores"."city" IS 'Ciudad del punto de recogida de la tienda. Alimenta el city_code de Pibox cuando faltan coordenadas.';



COMMENT ON COLUMN "public"."stores"."department" IS 'Departamento del punto de recogida de la tienda.';



CREATE OR REPLACE VIEW "public"."orders_detail_view" AS
 SELECT "o"."id" AS "order_id",
    "o"."buyer_id",
    "so"."store_id",
    "s"."name" AS "store_name",
    "o"."created_at",
    "so"."status",
    "p"."status" AS "payment_status",
    "p"."payment_method",
    "p"."payment_method_label",
    "da"."id" AS "delivery_address_id",
    "da"."address_line",
    "da"."neighborhood",
    "da"."municipality",
    "da"."department",
    "so"."subtotal" AS "total",
    COALESCE("jsonb_agg"("jsonb_build_object"('store_product_id', "oi"."store_product_id", 'catalog_name', "oi"."catalog_name", 'unit_name', "oi"."unit_name", 'quantity', "oi"."quantity", 'unit_price', "oi"."unit_price", 'total_price', "oi"."total_price")) FILTER (WHERE ("oi"."id" IS NOT NULL)), '[]'::"jsonb") AS "products",
    "so"."code" AS "order_code",
    "o"."code" AS "parent_code",
    "da"."delivery_instructions",
    "pu"."payable_until"
   FROM ((((((("public"."orders" "o"
     JOIN "public"."store_orders" "so" ON (("so"."order_id" = "o"."id")))
     JOIN "public"."stores" "s" ON (("s"."id" = "so"."store_id")))
     LEFT JOIN LATERAL ( SELECT "p_1"."status",
            "p_1"."payment_method",
            "p_1"."payment_method_label"
           FROM "public"."payments" "p_1"
          WHERE ("p_1"."order_id" = "o"."id")
          ORDER BY "p_1"."created_at" DESC
         LIMIT 1) "p" ON (true))
     LEFT JOIN LATERAL ( SELECT "public"."payable_until"("o".*) AS "payable_until") "pu" ON (true))
     LEFT JOIN "public"."delivery_addresses" "da" ON (("da"."id" = "o"."delivery_address_id")))
     LEFT JOIN "public"."order_items" "oi" ON (("oi"."order_id" = "o"."id")))
     LEFT JOIN "public"."store_products" "sp" ON ((("sp"."id" = "oi"."store_product_id") AND ("sp"."store_id" = "so"."store_id"))))
  GROUP BY "o"."id", "o"."buyer_id", "so"."store_id", "s"."name", "o"."created_at", "so"."status", "p"."status", "p"."payment_method", "p"."payment_method_label", "da"."id", "da"."address_line", "da"."neighborhood", "da"."municipality", "da"."department", "da"."delivery_instructions", "so"."subtotal", "so"."code", "o"."code", "pu"."payable_until";


ALTER VIEW "public"."orders_detail_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_change_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "consumed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_change_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."password_reset_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "consumed_at" timestamp with time zone,
    "reset_token" "text",
    "reset_token_expires_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."password_reset_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payout_id" "uuid" NOT NULL,
    "store_order_id" "uuid",
    "store_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "store_charge_id" "uuid",
    CONSTRAINT "payout_items_amount_check" CHECK (((("store_charge_id" IS NULL) AND ("store_order_id" IS NOT NULL) AND ("amount" > (0)::numeric)) OR (("store_charge_id" IS NOT NULL) AND ("store_order_id" IS NULL) AND ("amount" < (0)::numeric))))
);


ALTER TABLE "public"."payout_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."payout_items" IS 'Pedidos incluidos en una liquidación. El único sobre store_order_id es lo que impide pagar dos veces.';



CREATE TABLE IF NOT EXISTS "public"."payout_settings_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_concept" "text" DEFAULT 'Pago de ventas MercaMesa'::"text" NOT NULL,
    "hold_days" integer DEFAULT 3 NOT NULL,
    "notes" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payout_settings_history_concepto_largo" CHECK ((("char_length"("payment_concept") >= 1) AND ("char_length"("payment_concept") <= 40))),
    CONSTRAINT "payout_settings_history_hold_days_check" CHECK (("hold_days" >= 0))
);


ALTER TABLE "public"."payout_settings_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."payout_settings_history" IS 'Datos del ordenante para el archivo de dispersión. La fila más reciente es la vigente.';



COMMENT ON COLUMN "public"."payout_settings_history"."hold_days" IS 'Días de espera tras la entrega antes de que un pedido sea dispersable.';



CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consecutive" integer NOT NULL,
    "file_name" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "scheduled_for" "date" NOT NULL,
    "settings_id" "uuid",
    "total_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "items_count" integer DEFAULT 0 NOT NULL,
    "file_path" "text",
    "generated_by" "uuid",
    "generated_at" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "cancelled_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payouts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."payouts" IS 'Liquidación de pagos a tiendas. Un borrador se revisa antes de convertirse en archivo para el banco.';



ALTER TABLE "public"."payouts" ALTER COLUMN "consecutive" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payouts_consecutive_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."person_type_identification_types" (
    "person_type_id" "uuid" NOT NULL,
    "identification_type_id" "uuid" NOT NULL
);


ALTER TABLE "public"."person_type_identification_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."person_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "requires_business_name" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "person_types_name_length" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 120)))
);


ALTER TABLE "public"."person_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pibox_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_order_id" "uuid" NOT NULL,
    "booking_id" "text" NOT NULL,
    "package_id" "text",
    "status_cd" smallint,
    "package_status_cd" smallint,
    "tracking_link" "text",
    "pickup_validation_code" "text",
    "validation_code" "text",
    "estimated_cost" numeric(12,2),
    "final_cost" numeric(12,2),
    "currency" "text" DEFAULT 'COP'::"text" NOT NULL,
    "driver_name" "text",
    "driver_phone" "text",
    "vehicle_plates" "text",
    "canceled_pickup_reason_cd" smallint,
    "not_received_reason_cd" smallint,
    "relaunched_to_booking_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pibox_bookings" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."pqrs_consecutive_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."pqrs_consecutive_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pqrs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consecutive" integer DEFAULT "nextval"('"public"."pqrs_consecutive_seq"'::"regclass") NOT NULL,
    "code" "text",
    "kind" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "opened_by" "uuid" NOT NULL,
    "opened_as" "text" NOT NULL,
    "store_id" "uuid",
    "order_id" "uuid",
    "store_order_id" "uuid",
    "buyer_id" "uuid",
    "subject" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" NOT NULL,
    "outcome" "text",
    "liable" "text",
    "store_response_due_at" timestamp with time zone,
    "store_response" "text",
    "store_responded_at" timestamp with time zone,
    "store_responded_by" "uuid",
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "settings_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqrs_kind_check" CHECK (("kind" = ANY (ARRAY['peticion'::"text", 'queja'::"text", 'reclamo'::"text", 'sugerencia'::"text"]))),
    CONSTRAINT "pqrs_liable_check" CHECK (("liable" = ANY (ARRAY['store'::"text", 'logistics'::"text", 'platform'::"text", 'buyer'::"text"]))),
    CONSTRAINT "pqrs_opened_as_check" CHECK (("opened_as" = ANY (ARRAY['buyer'::"text", 'seller'::"text"]))),
    CONSTRAINT "pqrs_outcome_check" CHECK (("outcome" = ANY (ARRAY['approved'::"text", 'rejected'::"text", 'answered'::"text"]))),
    CONSTRAINT "pqrs_resuelta_con_resultado" CHECK ((("status" = 'resolved'::"text") = ("outcome" IS NOT NULL))),
    CONSTRAINT "pqrs_status_check" CHECK (("status" = ANY (ARRAY['awaiting_store'::"text", 'in_review'::"text", 'resolved'::"text"]))),
    CONSTRAINT "pqrs_store_response_check" CHECK (("store_response" = ANY (ARRAY['accepted'::"text", 'rejected'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."pqrs" OWNER TO "postgres";


COMMENT ON TABLE "public"."pqrs" IS 'Peticiones, quejas, reclamos y sugerencias de compradores y tenderos.';



CREATE TABLE IF NOT EXISTS "public"."pqrs_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pqrs_id" "uuid" NOT NULL,
    "message_id" "uuid",
    "path" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pqrs_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pqrs_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pqrs_id" "uuid" NOT NULL,
    "order_item_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "catalog_name" "text" NOT NULL,
    "unit_name" "text",
    "unit_price" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqrs_items_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."pqrs_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pqrs_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pqrs_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "author_as" "text" NOT NULL,
    "body" "text" NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqrs_messages_author_as_check" CHECK (("author_as" = ANY (ARRAY['buyer'::"text", 'seller'::"text", 'admin'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."pqrs_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pqrs_settings_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "claim_window_hours" integer DEFAULT 24 NOT NULL,
    "store_response_hours" integer DEFAULT 24 NOT NULL,
    "notes" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pqrs_settings_history_claim_window_hours_check" CHECK (("claim_window_hours" > 0)),
    CONSTRAINT "pqrs_settings_history_store_response_hours_check" CHECK (("store_response_hours" > 0))
);


ALTER TABLE "public"."pqrs_settings_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."pqrs_settings_history" IS 'Plazos de las PQRS. La fila más reciente es la vigente.';



CREATE TABLE IF NOT EXISTS "public"."pricing_settings_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "service_commission_rate" numeric(6,4) NOT NULL,
    "message_unit_price" numeric(10,2) NOT NULL,
    "messages_per_order" integer NOT NULL,
    "platform_commission_rate" numeric(6,4) NOT NULL,
    "siigo_delivery_product_code" "text" NOT NULL,
    "siigo_platform_product_code" "text" NOT NULL,
    "notes" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pricing_rates_sane" CHECK (((("service_commission_rate" >= (0)::numeric) AND ("service_commission_rate" <= (1)::numeric)) AND (("platform_commission_rate" >= (0)::numeric) AND ("platform_commission_rate" <= (1)::numeric)) AND ("message_unit_price" >= (0)::numeric) AND ("messages_per_order" >= 0)))
);


ALTER TABLE "public"."pricing_settings_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."pricing_settings_history" IS 'Tarifas y comisiones vigentes. La fila mas reciente es la que aplica.';



CREATE TABLE IF NOT EXISTS "public"."product_stock_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_product_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "type" "public"."stock_movement_type" NOT NULL,
    "quantity" numeric(12,3) NOT NULL,
    "reference_id" "uuid",
    "reference_type" "text",
    "registered_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."product_stock_movements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "buyer_type" "text",
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text" NOT NULL,
    "avatar_url" "text",
    "language" "public"."app_language" DEFAULT 'es'::"public"."app_language" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "reputation_score" numeric(3,2) DEFAULT 5.00,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_type" "text",
    "document_number" "text",
    "person_type" "text",
    "business_name" "text",
    "contact_name" "text",
    "terms_accepted_at" timestamp with time zone,
    "terms_version" "text",
    "person_type_id" "uuid",
    "identification_type_id" "uuid",
    "siigo_customer_id" "text",
    "anonymized_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."document_type" IS 'OBSOLETA: reemplazada por identification_type_id. Se borra en 20260813030000, tras el despliegue.';



COMMENT ON COLUMN "public"."profiles"."person_type" IS 'OBSOLETA: reemplazada por person_type_id. Se borra en 20260813030000, tras el despliegue.';



COMMENT ON COLUMN "public"."profiles"."terms_accepted_at" IS 'OBSOLETA desde 2026-09-23: usar legal_acceptances.accepted_at.';



COMMENT ON COLUMN "public"."profiles"."terms_version" IS 'OBSOLETA desde 2026-09-23: usar legal_acceptances. Apuntaba a una version sin documento.';



COMMENT ON COLUMN "public"."profiles"."anonymized_at" IS 'Cuando se anonimizo. La fila ya no representa a una persona: existe solo para sostener los pedidos.';



CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "module_id" "uuid" NOT NULL,
    "action_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."signup_email_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "code_hash" "text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 5 NOT NULL,
    "consumed_at" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "request_ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."signup_email_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."siigo_credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "refund_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "siigo_credit_note_id" "text",
    "siigo_number" "text",
    "stamped" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "request_payload" "jsonb",
    "response_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "siigo_credit_notes_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."siigo_credit_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."siigo_credit_notes" IS 'Cola de notas crédito de Siigo, una por devolución.';



CREATE TABLE IF NOT EXISTS "public"."siigo_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "siigo_invoice_id" "text",
    "siigo_number" "text",
    "stamped" boolean DEFAULT false NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "request_payload" "jsonb",
    "response_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "siigo_invoices_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."siigo_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_bank_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "bank_code" character(4),
    "account_kind" "text",
    "account_number" "text",
    "bbva_office_code" character(4),
    "holder_document_type" character(2) NOT NULL,
    "holder_document_number" "text" NOT NULL,
    "holder_document_dv" character(1) DEFAULT '0'::"bpchar" NOT NULL,
    "holder_name" "text" NOT NULL,
    "holder_address" "text" NOT NULL,
    "holder_email" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "rejection_reason" "text",
    "is_current" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_method" "text" DEFAULT 'account'::"text" NOT NULL,
    "breb_key" "text",
    CONSTRAINT "store_bank_accounts_account_kind_check" CHECK (("account_kind" = ANY (ARRAY['checking'::"text", 'savings'::"text"]))),
    CONSTRAINT "store_bank_accounts_bbva_office" CHECK ((("bank_code" <> '0013'::"bpchar") OR ("bbva_office_code" IS NOT NULL))),
    CONSTRAINT "store_bank_accounts_metodo_completo" CHECK (((("payment_method" = 'account'::"text") AND ("bank_code" IS NOT NULL) AND ("account_kind" IS NOT NULL) AND ("account_number" IS NOT NULL)) OR (("payment_method" = 'breb'::"text") AND ("breb_key" IS NOT NULL) AND ("breb_key" ~ '^[!-~]{1,17}$'::"text")))),
    CONSTRAINT "store_bank_accounts_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['account'::"text", 'breb'::"text"]))),
    CONSTRAINT "store_bank_accounts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "store_bank_accounts_tipo_documento" CHECK (("holder_document_type" = ANY (ARRAY['01'::"bpchar", '02'::"bpchar", '03'::"bpchar", '04'::"bpchar", '05'::"bpchar"])))
);


ALTER TABLE "public"."store_bank_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."store_bank_accounts" IS 'Cuenta bancaria a la que se le dispersa a cada tienda. Append-only: cambiarla es insertar otra y bajar la anterior.';



COMMENT ON COLUMN "public"."store_bank_accounts"."bbva_office_code" IS 'Campo 12 del registro 210. Obligatorio si el banco es BBVA; nulo en los demás.';



COMMENT ON COLUMN "public"."store_bank_accounts"."holder_document_type" IS 'Código del ARCHIVO del banco (01 cédula, 03 NIT), no el de identification_types.';



CREATE TABLE IF NOT EXISTS "public"."store_buyer_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "pqrs_id" "uuid",
    "reason" "text" NOT NULL,
    "blocked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lifted_at" timestamp with time zone,
    "lifted_by" "uuid",
    "lift_notes" "text"
);


ALTER TABLE "public"."store_buyer_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."store_buyer_blocks" IS 'Compradores que no pueden crear pedidos en una tienda. Vigente mientras lifted_at sea nulo.';



CREATE TABLE IF NOT EXISTS "public"."store_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_category_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_category_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_charges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "store_order_id" "uuid",
    "refund_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    "void_notes" "text",
    CONSTRAINT "store_charges_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."store_charges" OWNER TO "postgres";


COMMENT ON TABLE "public"."store_charges" IS 'Descuentos a una tienda por devoluciones que asume. Se restan en su siguiente dispersión.';



CREATE TABLE IF NOT EXISTS "public"."store_document_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "document_type_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "file_url" "text" NOT NULL,
    "status" "text" NOT NULL,
    "previous_status" "text",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "store_document_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['upload'::"text", 'status_change'::"text"])))
);


ALTER TABLE "public"."store_document_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "document_type_id" "uuid" NOT NULL,
    "file_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "store_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."store_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "store_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "store_groups_name_length" CHECK ((("char_length"("btrim"("name")) >= 1) AND ("char_length"("btrim"("name")) <= 120)))
);


ALTER TABLE "public"."store_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."store_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_offers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "store_product_id" "uuid" NOT NULL,
    "discount_pct" numeric(5,2),
    "special_price" numeric(12,2),
    "label" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    CONSTRAINT "store_offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."store_offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."store_order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_order_id" "uuid" NOT NULL,
    "status" "public"."order_status" NOT NULL,
    "notes" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "is_reversal" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."store_order_status_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."store_order_status_history"."is_reversal" IS 'true cuando la fila la creó revert_store_order_status: una corrección manual, no un avance del flujo.';



CREATE TABLE IF NOT EXISTS "public"."store_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "store_id" "uuid" NOT NULL,
    "buyer_id" "uuid" NOT NULL,
    "stars" smallint NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "store_reviews_stars_check" CHECK ((("stars" >= 1) AND ("stars" <= 5)))
);


ALTER TABLE "public"."store_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_deactivations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "period" "text" NOT NULL,
    "until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "lifted_at" timestamp with time zone,
    "lifted_by" "uuid",
    CONSTRAINT "user_deactivations_period_check" CHECK (("period" = ANY (ARRAY['15d'::"text", '1m'::"text", '6m'::"text", 'forever'::"text"])))
);


ALTER TABLE "public"."user_deactivations" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_deactivations" IS 'Historial de inactivaciones de cuenta: quién, por qué, por cuánto y hasta cuándo.';



COMMENT ON COLUMN "public"."user_deactivations"."lifted_by" IS 'Nulo junto con lifted_at puesto significa que la inactivación venció sola, no que alguien la levantó.';



CREATE OR REPLACE VIEW "public"."vitrina_productos" AS
 SELECT "sp"."id",
    "sp"."store_id",
    "sp"."price_per_unit",
    "sp"."stock",
    "sp"."is_featured",
    "sp"."featured_at",
    "cp"."name" AS "product_name",
    "cp"."search_text" AS "product_search_text",
    "cp"."image_url" AS "product_image_url",
    "c"."name" AS "category_name",
    "s"."name" AS "store_name",
    "s"."slug" AS "store_slug",
    "s"."marketplace_id",
    "m"."name" AS "marketplace_name",
    "mu"."abbreviation" AS "unit_abbreviation"
   FROM ((((("public"."store_products" "sp"
     JOIN "public"."catalog_products" "cp" ON (("cp"."id" = "sp"."catalog_product_id")))
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "cp"."category_id")))
     JOIN "public"."stores" "s" ON (("s"."id" = "sp"."store_id")))
     LEFT JOIN "public"."marketplaces" "m" ON (("m"."id" = "s"."marketplace_id")))
     LEFT JOIN "public"."measurement_units" "mu" ON (("mu"."id" = "sp"."unit_id")))
  WHERE ("sp"."is_active" AND "s"."is_active");


ALTER VIEW "public"."vitrina_productos" OWNER TO "postgres";


COMMENT ON VIEW "public"."vitrina_productos" IS 'Productos publicados de tiendas activas, aplanados para poder buscar, ordenar y paginar contra el servidor. Solo columnas publicas: no expone precio mayorista ni codigo interno.';



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "actions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."actions"
    ADD CONSTRAINT "actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_login_codes"
    ADD CONSTRAINT "admin_login_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."banks"
    ADD CONSTRAINT "banks_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."buyer_credit_movements"
    ADD CONSTRAINT "buyer_credit_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."buyer_payment_methods"
    ADD CONSTRAINT "buyer_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_siigo_id_unique" UNIQUE ("siigo_id");



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_document_number_key" UNIQUE ("document_number");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_addresses"
    ADD CONSTRAINT "delivery_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_types"
    ADD CONSTRAINT "document_types_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."email_change_codes"
    ADD CONSTRAINT "email_change_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identification_types"
    ADD CONSTRAINT "identification_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."identification_types"
    ADD CONSTRAINT "identification_types_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_user_id_document_id_key" UNIQUE ("user_id", "document_id");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_kind_version_key" UNIQUE ("kind", "version");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_delivery_users"
    ADD CONSTRAINT "marketplace_delivery_users_marketplace_id_user_id_key" UNIQUE ("marketplace_id", "user_id");



ALTER TABLE ONLY "public"."marketplace_delivery_users"
    ADD CONSTRAINT "marketplace_delivery_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_marketplace_user_key" UNIQUE ("marketplace_id", "user_id");



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplaces"
    ADD CONSTRAINT "marketplaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplaces"
    ADD CONSTRAINT "marketplaces_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."measurement_units"
    ADD CONSTRAINT "measurement_units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_parent_id_key_key" UNIQUE ("parent_id", "key");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_recipients"
    ADD CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_min_price_history"
    ADD CONSTRAINT "order_min_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_refund_items"
    ADD CONSTRAINT "order_refund_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_refund_items"
    ADD CONSTRAINT "order_refund_items_refund_id_order_item_id_key" UNIQUE ("refund_id", "order_item_id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_pqrs_id_key" UNIQUE ("pqrs_id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_idempotency_key_key" UNIQUE ("client_idempotency_key");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_change_codes"
    ADD CONSTRAINT "password_change_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."password_reset_codes"
    ADD CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_settings_history"
    ADD CONSTRAINT "payout_settings_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_type_identification_types"
    ADD CONSTRAINT "person_type_identification_types_pkey" PRIMARY KEY ("person_type_id", "identification_type_id");



ALTER TABLE ONLY "public"."person_types"
    ADD CONSTRAINT "person_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."person_types"
    ADD CONSTRAINT "person_types_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pibox_bookings"
    ADD CONSTRAINT "pibox_bookings_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."pibox_bookings"
    ADD CONSTRAINT "pibox_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqrs_attachments"
    ADD CONSTRAINT "pqrs_attachments_path_key" UNIQUE ("path");



ALTER TABLE ONLY "public"."pqrs_attachments"
    ADD CONSTRAINT "pqrs_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."pqrs_items"
    ADD CONSTRAINT "pqrs_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqrs_items"
    ADD CONSTRAINT "pqrs_items_pqrs_id_order_item_id_key" UNIQUE ("pqrs_id", "order_item_id");



ALTER TABLE ONLY "public"."pqrs_messages"
    ADD CONSTRAINT "pqrs_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pqrs_settings_history"
    ADD CONSTRAINT "pqrs_settings_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_settings_history"
    ADD CONSTRAINT "pricing_settings_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_stock_movements"
    ADD CONSTRAINT "product_stock_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_module_id_action_id_key" UNIQUE ("role_id", "module_id", "action_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."signup_email_codes"
    ADD CONSTRAINT "signup_email_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."siigo_credit_notes"
    ADD CONSTRAINT "siigo_credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."siigo_credit_notes"
    ADD CONSTRAINT "siigo_credit_notes_refund_id_key" UNIQUE ("refund_id");



ALTER TABLE ONLY "public"."siigo_invoices"
    ADD CONSTRAINT "siigo_invoices_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."siigo_invoices"
    ADD CONSTRAINT "siigo_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_bank_accounts"
    ADD CONSTRAINT "store_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_categories"
    ADD CONSTRAINT "store_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_categories"
    ADD CONSTRAINT "store_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."store_category_links"
    ADD CONSTRAINT "store_category_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_category_links"
    ADD CONSTRAINT "store_category_links_store_id_category_id_key" UNIQUE ("store_id", "category_id");



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_refund_id_key" UNIQUE ("refund_id");



ALTER TABLE ONLY "public"."store_document_events"
    ADD CONSTRAINT "store_document_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_documents"
    ADD CONSTRAINT "store_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_documents"
    ADD CONSTRAINT "store_documents_store_type_unique" UNIQUE ("store_id", "document_type_id");



ALTER TABLE ONLY "public"."store_favorites"
    ADD CONSTRAINT "store_favorites_buyer_id_store_id_key" UNIQUE ("buyer_id", "store_id");



ALTER TABLE ONLY "public"."store_favorites"
    ADD CONSTRAINT "store_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_groups"
    ADD CONSTRAINT "store_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_groups"
    ADD CONSTRAINT "store_groups_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_store_user_key" UNIQUE ("store_id", "user_id");



ALTER TABLE "public"."store_offers"
    ADD CONSTRAINT "store_offers_dates_ordered" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))) NOT VALID;



ALTER TABLE "public"."store_offers"
    ADD CONSTRAINT "store_offers_discount_pct_range" CHECK ((("discount_pct" IS NULL) OR (("discount_pct" > (0)::numeric) AND ("discount_pct" < (100)::numeric)))) NOT VALID;



ALTER TABLE "public"."store_offers"
    ADD CONSTRAINT "store_offers_discount_xor_price" CHECK (((("discount_pct" IS NOT NULL) AND ("special_price" IS NULL)) OR (("discount_pct" IS NULL) AND ("special_price" IS NOT NULL)))) NOT VALID;



COMMENT ON CONSTRAINT "store_offers_discount_xor_price" ON "public"."store_offers" IS 'Una oferta descuenta por porcentaje o fija un precio, nunca ambos ni ninguno.';



ALTER TABLE ONLY "public"."store_offers"
    ADD CONSTRAINT "store_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."store_offers"
    ADD CONSTRAINT "store_offers_special_price_positive" CHECK ((("special_price" IS NULL) OR ("special_price" > (0)::numeric))) NOT VALID;



ALTER TABLE ONLY "public"."store_order_status_history"
    ADD CONSTRAINT "store_order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_store_id_catalog_product_id_key" UNIQUE ("store_id", "catalog_product_id");



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_store_id_buyer_id_key" UNIQUE ("store_id", "buyer_id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_contact_email_unique" UNIQUE ("contact_email");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."user_deactivations"
    ADD CONSTRAINT "user_deactivations_pkey" PRIMARY KEY ("id");



CREATE INDEX "admin_login_codes_user_idx" ON "public"."admin_login_codes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "admin_user_actions_target_idx" ON "public"."admin_user_actions" USING "btree" ("target_user_id", "created_at" DESC);



CREATE INDEX "buyer_credit_movements_buyer_idx" ON "public"."buyer_credit_movements" USING "btree" ("buyer_id", "created_at" DESC);



CREATE INDEX "buyer_payment_methods_buyer_id_idx" ON "public"."buyer_payment_methods" USING "btree" ("buyer_id");



CREATE UNIQUE INDEX "buyer_payment_methods_zonapagos_token_idx" ON "public"."buyer_payment_methods" USING "btree" ("zonapagos_token") WHERE ("zonapagos_token" IS NOT NULL);



CREATE INDEX "catalog_products_owner_group_id_idx" ON "public"."catalog_products" USING "btree" ("owner_group_id");



CREATE INDEX "catalog_products_search_text_idx" ON "public"."catalog_products" USING "btree" ("search_text" "text_pattern_ops");



CREATE INDEX "catalog_products_siigo_synced_at_idx" ON "public"."catalog_products" USING "btree" ("siigo_synced_at") WHERE ("siigo_synced_at" IS NULL);



CREATE INDEX "clients_identification_type_id_idx" ON "public"."clients" USING "btree" ("identification_type_id");



CREATE INDEX "email_change_codes_user_idx" ON "public"."email_change_codes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_catalog_products_category_id" ON "public"."catalog_products" USING "btree" ("category_id");



CREATE INDEX "idx_catalog_products_default_unit_id" ON "public"."catalog_products" USING "btree" ("default_unit_id");



CREATE INDEX "idx_catalog_products_is_active" ON "public"."catalog_products" USING "btree" ("is_active");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_clients_document_number" ON "public"."clients" USING "btree" ("document_number");



CREATE INDEX "idx_clients_email" ON "public"."clients" USING "btree" ("email");



CREATE INDEX "idx_orders_client_idempotency_key" ON "public"."orders" USING "btree" ("client_idempotency_key");



CREATE INDEX "idx_orders_payment_status" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "idx_payments_order_id" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_payments_provider_payment_id" ON "public"."payments" USING "btree" ("provider_payment_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_str_id_pago" ON "public"."payments" USING "btree" ("str_id_pago");



CREATE INDEX "idx_pricing_settings_history_created_at" ON "public"."pricing_settings_history" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_role_permissions_lookup" ON "public"."role_permissions" USING "btree" ("role_id", "module_id", "action_id");



CREATE INDEX "legal_acceptances_user_idx" ON "public"."legal_acceptances" USING "btree" ("user_id");



CREATE INDEX "legal_documents_kind_version_idx" ON "public"."legal_documents" USING "btree" ("kind", "version" DESC);



CREATE INDEX "notification_recipients_user_unread_idx" ON "public"."notification_recipients" USING "btree" ("user_id", "read_at");



CREATE INDEX "order_refund_items_item_idx" ON "public"."order_refund_items" USING "btree" ("order_item_id");



CREATE INDEX "order_refunds_buyer_idx" ON "public"."order_refunds" USING "btree" ("buyer_id", "created_at" DESC);



CREATE INDEX "order_refunds_order_idx" ON "public"."order_refunds" USING "btree" ("order_id");



CREATE UNIQUE INDEX "orders_code_key" ON "public"."orders" USING "btree" ("code");



CREATE INDEX "password_change_codes_user_idx" ON "public"."password_change_codes" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "password_reset_codes_email_idx" ON "public"."password_reset_codes" USING "btree" ("email", "created_at" DESC);



CREATE UNIQUE INDEX "password_reset_codes_reset_token_idx" ON "public"."password_reset_codes" USING "btree" ("reset_token") WHERE ("reset_token" IS NOT NULL);



CREATE INDEX "payout_items_payout_idx" ON "public"."payout_items" USING "btree" ("payout_id", "store_id");



CREATE UNIQUE INDEX "payout_items_store_charge_unico" ON "public"."payout_items" USING "btree" ("store_charge_id") WHERE ("store_charge_id" IS NOT NULL);



CREATE UNIQUE INDEX "payout_items_store_order_unico" ON "public"."payout_items" USING "btree" ("store_order_id");



CREATE INDEX "payout_settings_history_created_at_idx" ON "public"."payout_settings_history" USING "btree" ("created_at" DESC);



CREATE INDEX "payouts_status_idx" ON "public"."payouts" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "person_type_identification_types_identification_idx" ON "public"."person_type_identification_types" USING "btree" ("identification_type_id");



CREATE INDEX "pibox_bookings_package_id_idx" ON "public"."pibox_bookings" USING "btree" ("package_id");



CREATE INDEX "pibox_bookings_store_order_id_idx" ON "public"."pibox_bookings" USING "btree" ("store_order_id");



CREATE INDEX "pqrs_attachments_pqrs_idx" ON "public"."pqrs_attachments" USING "btree" ("pqrs_id");



CREATE INDEX "pqrs_items_order_item_idx" ON "public"."pqrs_items" USING "btree" ("order_item_id");



CREATE INDEX "pqrs_messages_pqrs_idx" ON "public"."pqrs_messages" USING "btree" ("pqrs_id", "created_at");



CREATE INDEX "pqrs_opened_by_idx" ON "public"."pqrs" USING "btree" ("opened_by", "created_at" DESC);



CREATE INDEX "pqrs_order_idx" ON "public"."pqrs" USING "btree" ("order_id");



CREATE INDEX "pqrs_settings_history_created_at_idx" ON "public"."pqrs_settings_history" USING "btree" ("created_at" DESC);



CREATE INDEX "pqrs_status_idx" ON "public"."pqrs" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "pqrs_store_idx" ON "public"."pqrs" USING "btree" ("store_id", "created_at" DESC);



CREATE UNIQUE INDEX "pqrs_un_caso_abierto_por_motivo" ON "public"."pqrs" USING "btree" ("order_id", "reason", "opened_by") WHERE (("status" <> 'resolved'::"text") AND ("order_id" IS NOT NULL));



CREATE INDEX "profiles_identification_type_id_idx" ON "public"."profiles" USING "btree" ("identification_type_id");



CREATE INDEX "profiles_person_type_id_idx" ON "public"."profiles" USING "btree" ("person_type_id");



CREATE INDEX "signup_email_codes_email_idx" ON "public"."signup_email_codes" USING "btree" ("email", "created_at" DESC);



CREATE INDEX "siigo_credit_notes_status_idx" ON "public"."siigo_credit_notes" USING "btree" ("status", "attempts");



CREATE INDEX "siigo_invoices_status_idx" ON "public"."siigo_invoices" USING "btree" ("status", "attempts");



CREATE INDEX "store_bank_accounts_pendientes_idx" ON "public"."store_bank_accounts" USING "btree" ("status") WHERE (("status" = 'pending'::"text") AND "is_current");



CREATE INDEX "store_bank_accounts_store_idx" ON "public"."store_bank_accounts" USING "btree" ("store_id", "created_at" DESC);



CREATE UNIQUE INDEX "store_bank_accounts_vigente_idx" ON "public"."store_bank_accounts" USING "btree" ("store_id") WHERE "is_current";



CREATE INDEX "store_buyer_blocks_buyer_idx" ON "public"."store_buyer_blocks" USING "btree" ("buyer_id");



CREATE INDEX "store_buyer_blocks_pqrs_idx" ON "public"."store_buyer_blocks" USING "btree" ("pqrs_id");



CREATE UNIQUE INDEX "store_buyer_blocks_vigente" ON "public"."store_buyer_blocks" USING "btree" ("store_id", "buyer_id") WHERE ("lifted_at" IS NULL);



CREATE INDEX "store_category_links_category_id_idx" ON "public"."store_category_links" USING "btree" ("category_id");



CREATE INDEX "store_category_links_store_id_idx" ON "public"."store_category_links" USING "btree" ("store_id");



CREATE INDEX "store_charges_store_idx" ON "public"."store_charges" USING "btree" ("store_id") WHERE ("voided_at" IS NULL);



CREATE INDEX "store_document_events_lookup" ON "public"."store_document_events" USING "btree" ("store_id", "document_type_id", "created_at" DESC);



CREATE INDEX "store_favorites_buyer_id_idx" ON "public"."store_favorites" USING "btree" ("buyer_id");



CREATE INDEX "store_favorites_store_id_idx" ON "public"."store_favorites" USING "btree" ("store_id");



CREATE UNIQUE INDEX "store_orders_code_key" ON "public"."store_orders" USING "btree" ("code");



CREATE UNIQUE INDEX "store_products_store_code_key" ON "public"."store_products" USING "btree" ("store_id", "upper"("code")) WHERE ("code" IS NOT NULL);



CREATE INDEX "store_reviews_store_id_idx" ON "public"."store_reviews" USING "btree" ("store_id", "created_at" DESC);



CREATE INDEX "stores_store_group_id_idx" ON "public"."stores" USING "btree" ("store_group_id");



CREATE UNIQUE INDEX "unique_active_buyer_product" ON "public"."cart_items" USING "btree" ("buyer_id", "store_product_id") WHERE ("status" = 'active'::"public"."cart_item_status");



CREATE INDEX "user_deactivations_user_idx" ON "public"."user_deactivations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "user_deactivations_vivas_idx" ON "public"."user_deactivations" USING "btree" ("user_id") WHERE ("lifted_at" IS NULL);



CREATE OR REPLACE VIEW "public"."marketplaces_detail" AS
 SELECT "m"."id",
    "m"."name",
    "m"."slug",
    "m"."description",
    "m"."address",
    "m"."city",
    "m"."department",
    "m"."latitude",
    "m"."longitude",
    "m"."cover_image_url",
    "m"."logo_url",
    "m"."is_active",
    "m"."created_by",
    "m"."created_at",
    "m"."updated_at",
    ("count"("s"."id"))::integer AS "stores_count",
    COALESCE("json_agg"("json_build_object"('id', "s"."id", 'marketplace_id', "s"."marketplace_id", 'name', "s"."name", 'slug', "s"."slug", 'description', "s"."description", 'logo_url', "s"."logo_url", 'cover_image_url', "s"."cover_image_url", 'phone', "s"."phone", 'whatsapp', "s"."whatsapp", 'contact_name', "s"."contact_name", 'contact_email', "s"."contact_email", 'reputation_score', "s"."reputation_score", 'is_active', "s"."is_active", 'is_verified', "s"."is_verified", 'created_at', "s"."created_at", 'updated_at', "s"."updated_at")) FILTER (WHERE ("s"."id" IS NOT NULL)), '[]'::json) AS "stores"
   FROM ("public"."marketplaces" "m"
     LEFT JOIN "public"."stores" "s" ON ((("s"."marketplace_id" = "m"."id") AND ("s"."is_active" = true))))
  GROUP BY "m"."id";



CREATE OR REPLACE TRIGGER "orders_set_code" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_code"();



CREATE OR REPLACE TRIGGER "pibox_bookings_set_updated_at" BEFORE UPDATE ON "public"."pibox_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_pibox_bookings_updated_at"();



CREATE OR REPLACE TRIGGER "pqrs_set_code" BEFORE INSERT ON "public"."pqrs" FOR EACH ROW EXECUTE FUNCTION "public"."set_pqrs_code"();



CREATE OR REPLACE TRIGGER "pqrs_set_updated_at" BEFORE UPDATE ON "public"."pqrs" FOR EACH ROW EXECUTE FUNCTION "public"."set_pqrs_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_guard_authority" BEFORE INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_authority"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_profiles_updated_at"();



CREATE OR REPLACE TRIGGER "set_siigo_credit_notes_updated_at" BEFORE UPDATE ON "public"."siigo_credit_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_siigo_credit_notes_updated_at"();



CREATE OR REPLACE TRIGGER "set_siigo_invoices_updated_at" BEFORE UPDATE ON "public"."siigo_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_siigo_invoices_updated_at"();



CREATE OR REPLACE TRIGGER "set_store_groups_updated_at" BEFORE UPDATE ON "public"."store_groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_store_groups_updated_at"();



CREATE OR REPLACE TRIGGER "siigo_credit_note_on_refund" AFTER INSERT ON "public"."order_refunds" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_siigo_credit_note"();



CREATE OR REPLACE TRIGGER "siigo_invoice_on_payment_approved" AFTER UPDATE ON "public"."payments" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") AND ("new"."status" = 'approved'::"public"."payment_status"))) EXECUTE FUNCTION "public"."enqueue_siigo_invoice"();



CREATE OR REPLACE TRIGGER "siigo_invoice_on_payment_inserted" AFTER INSERT ON "public"."payments" FOR EACH ROW WHEN (("new"."status" = 'approved'::"public"."payment_status")) EXECUTE FUNCTION "public"."enqueue_siigo_invoice"();



CREATE OR REPLACE TRIGGER "store_bank_accounts_guard" BEFORE INSERT OR UPDATE ON "public"."store_bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."guard_store_bank_account"();



CREATE OR REPLACE TRIGGER "store_documents_guard_status" BEFORE INSERT OR UPDATE ON "public"."store_documents" FOR EACH ROW EXECUTE FUNCTION "public"."fn_guard_store_document_status"();



CREATE OR REPLACE TRIGGER "store_documents_log_event" AFTER INSERT OR UPDATE ON "public"."store_documents" FOR EACH ROW EXECUTE FUNCTION "public"."fn_log_store_document_event"();



CREATE OR REPLACE TRIGGER "store_orders_set_code" BEFORE INSERT ON "public"."store_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_store_order_code"();



CREATE OR REPLACE TRIGGER "store_reviews_reputation_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."store_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_store_reputation"();



CREATE OR REPLACE TRIGGER "trg_confirm_store_orders_on_payment" AFTER UPDATE OF "payment_status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_confirm_store_orders_on_payment"();



CREATE OR REPLACE TRIGGER "trg_order_credit_guard" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_order_credit_guard"();



CREATE OR REPLACE TRIGGER "trg_store_documents_guard_status" BEFORE INSERT OR UPDATE ON "public"."store_documents" FOR EACH ROW EXECUTE FUNCTION "public"."fn_store_documents_guard_status"();



CREATE OR REPLACE TRIGGER "trg_store_order_status_change" AFTER INSERT OR UPDATE OF "status" ON "public"."store_orders" FOR EACH ROW EXECUTE FUNCTION "public"."fn_process_store_order_status_change"();



ALTER TABLE ONLY "public"."admin_login_codes"
    ADD CONSTRAINT "admin_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."admin_user_actions"
    ADD CONSTRAINT "admin_user_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."buyer_credit_movements"
    ADD CONSTRAINT "buyer_credit_movements_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."buyer_credit_movements"
    ADD CONSTRAINT "buyer_credit_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."buyer_credit_movements"
    ADD CONSTRAINT "buyer_credit_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."buyer_credit_movements"
    ADD CONSTRAINT "buyer_credit_movements_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."order_refunds"("id");



ALTER TABLE ONLY "public"."buyer_payment_methods"
    ADD CONSTRAINT "buyer_payment_methods_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "public"."store_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_default_unit_id_fkey" FOREIGN KEY ("default_unit_id") REFERENCES "public"."measurement_units"("id");



ALTER TABLE ONLY "public"."catalog_products"
    ADD CONSTRAINT "catalog_products_owner_group_id_fkey" FOREIGN KEY ("owner_group_id") REFERENCES "public"."store_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_identification_type_id_fkey" FOREIGN KEY ("identification_type_id") REFERENCES "public"."identification_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."delivery_addresses"
    ADD CONSTRAINT "delivery_addresses_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_change_codes"
    ADD CONSTRAINT "email_change_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "fk_payments_order" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."legal_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_acceptances"
    ADD CONSTRAINT "legal_acceptances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_delivery_users"
    ADD CONSTRAINT "marketplace_delivery_users_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id");



ALTER TABLE ONLY "public"."marketplace_delivery_users"
    ADD CONSTRAINT "marketplace_delivery_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."marketplace_members"
    ADD CONSTRAINT "marketplace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplaces"
    ADD CONSTRAINT "marketplaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."modules"
    ADD CONSTRAINT "modules_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."modules"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notification_recipients"
    ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_recipients"
    ADD CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id");



ALTER TABLE ONLY "public"."order_min_price_history"
    ADD CONSTRAINT "order_min_price_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_refund_items"
    ADD CONSTRAINT "order_refund_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id");



ALTER TABLE ONLY "public"."order_refund_items"
    ADD CONSTRAINT "order_refund_items_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."order_refunds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_money_paid_by_fkey" FOREIGN KEY ("money_paid_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_pqrs_id_fkey" FOREIGN KEY ("pqrs_id") REFERENCES "public"."pqrs"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."order_refunds"
    ADD CONSTRAINT "order_refunds_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "public"."delivery_addresses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pricing_settings_id_fkey" FOREIGN KEY ("pricing_settings_id") REFERENCES "public"."pricing_settings_history"("id");



ALTER TABLE ONLY "public"."password_change_codes"
    ADD CONSTRAINT "password_change_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."store_bank_accounts"("id");



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_store_charge_id_fkey" FOREIGN KEY ("store_charge_id") REFERENCES "public"."store_charges"("id");



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."payout_items"
    ADD CONSTRAINT "payout_items_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id");



ALTER TABLE ONLY "public"."payout_settings_history"
    ADD CONSTRAINT "payout_settings_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "public"."payout_settings_history"("id");



ALTER TABLE ONLY "public"."person_type_identification_types"
    ADD CONSTRAINT "person_type_identification_types_identification_type_id_fkey" FOREIGN KEY ("identification_type_id") REFERENCES "public"."identification_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."person_type_identification_types"
    ADD CONSTRAINT "person_type_identification_types_person_type_id_fkey" FOREIGN KEY ("person_type_id") REFERENCES "public"."person_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pibox_bookings"
    ADD CONSTRAINT "pibox_bookings_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs_attachments"
    ADD CONSTRAINT "pqrs_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."pqrs_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs_attachments"
    ADD CONSTRAINT "pqrs_attachments_pqrs_id_fkey" FOREIGN KEY ("pqrs_id") REFERENCES "public"."pqrs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs_attachments"
    ADD CONSTRAINT "pqrs_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs_items"
    ADD CONSTRAINT "pqrs_items_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs_items"
    ADD CONSTRAINT "pqrs_items_pqrs_id_fkey" FOREIGN KEY ("pqrs_id") REFERENCES "public"."pqrs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs_messages"
    ADD CONSTRAINT "pqrs_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs_messages"
    ADD CONSTRAINT "pqrs_messages_pqrs_id_fkey" FOREIGN KEY ("pqrs_id") REFERENCES "public"."pqrs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_opened_by_fkey" FOREIGN KEY ("opened_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs_settings_history"
    ADD CONSTRAINT "pqrs_settings_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "public"."pqrs_settings_history"("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pqrs"
    ADD CONSTRAINT "pqrs_store_responded_by_fkey" FOREIGN KEY ("store_responded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."pricing_settings_history"
    ADD CONSTRAINT "pricing_settings_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."product_stock_movements"
    ADD CONSTRAINT "product_stock_movements_registered_by_fkey" FOREIGN KEY ("registered_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_stock_movements"
    ADD CONSTRAINT "product_stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_stock_movements"
    ADD CONSTRAINT "product_stock_movements_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_identification_type_id_fkey" FOREIGN KEY ("identification_type_id") REFERENCES "public"."identification_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_person_type_id_fkey" FOREIGN KEY ("person_type_id") REFERENCES "public"."person_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "public"."modules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."siigo_credit_notes"
    ADD CONSTRAINT "siigo_credit_notes_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."order_refunds"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."siigo_invoices"
    ADD CONSTRAINT "siigo_invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_bank_accounts"
    ADD CONSTRAINT "store_bank_accounts_bank_code_fkey" FOREIGN KEY ("bank_code") REFERENCES "public"."banks"("code");



ALTER TABLE ONLY "public"."store_bank_accounts"
    ADD CONSTRAINT "store_bank_accounts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_bank_accounts"
    ADD CONSTRAINT "store_bank_accounts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_bank_accounts"
    ADD CONSTRAINT "store_bank_accounts_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_blocked_by_fkey" FOREIGN KEY ("blocked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_pqrs_id_fkey" FOREIGN KEY ("pqrs_id") REFERENCES "public"."pqrs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_buyer_blocks"
    ADD CONSTRAINT "store_buyer_blocks_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_category_links"
    ADD CONSTRAINT "store_category_links_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_category_links"
    ADD CONSTRAINT "store_category_links_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "public"."order_refunds"("id");



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id");



ALTER TABLE ONLY "public"."store_charges"
    ADD CONSTRAINT "store_charges_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_document_events"
    ADD CONSTRAINT "store_document_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_document_events"
    ADD CONSTRAINT "store_document_events_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id");



ALTER TABLE ONLY "public"."store_document_events"
    ADD CONSTRAINT "store_document_events_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_documents"
    ADD CONSTRAINT "store_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_documents"
    ADD CONSTRAINT "store_documents_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_favorites"
    ADD CONSTRAINT "store_favorites_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_favorites"
    ADD CONSTRAINT "store_favorites_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_members"
    ADD CONSTRAINT "store_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_offers"
    ADD CONSTRAINT "store_offers_store_product_id_fkey" FOREIGN KEY ("store_product_id") REFERENCES "public"."store_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_order_status_history"
    ADD CONSTRAINT "store_order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."store_order_status_history"
    ADD CONSTRAINT "store_order_status_history_store_order_id_fkey" FOREIGN KEY ("store_order_id") REFERENCES "public"."store_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_orders"
    ADD CONSTRAINT "store_orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id");



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_catalog_product_id_fkey" FOREIGN KEY ("catalog_product_id") REFERENCES "public"."catalog_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_products"
    ADD CONSTRAINT "store_products_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."measurement_units"("id");



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."store_reviews"
    ADD CONSTRAINT "store_reviews_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id");



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_marketplace_id_fkey" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."stores"
    ADD CONSTRAINT "stores_store_group_id_fkey" FOREIGN KEY ("store_group_id") REFERENCES "public"."store_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_deactivations"
    ADD CONSTRAINT "user_deactivations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_deactivations"
    ADD CONSTRAINT "user_deactivations_lifted_by_fkey" FOREIGN KEY ("lifted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_deactivations"
    ADD CONSTRAINT "user_deactivations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow insert access to authenticated users" ON "public"."store_order_status_history" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow insert to authenticated" ON "public"."product_stock_movements" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."store_order_status_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read to authenticated" ON "public"."product_stock_movements" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Buyers manage their own favorite stores" ON "public"."store_favorites" USING (("buyer_id" = "auth"."uid"())) WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "Buyers manage their own payment methods" ON "public"."buyer_payment_methods" USING (("buyer_id" = "auth"."uid"())) WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "Permitir edición a usuarios autenticados" ON "public"."clients" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Permitir inserción a usuarios autenticados" ON "public"."clients" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Permitir lectura a usuarios autenticados" ON "public"."clients" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Recipients read their own notifications" ON "public"."notifications" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."notification_recipients" "nr"
  WHERE (("nr"."notification_id" = "notifications"."id") AND ("nr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own cart items" ON "public"."cart_items" TO "authenticated" USING (("auth"."uid"() = "buyer_id")) WITH CHECK (("auth"."uid"() = "buyer_id"));



CREATE POLICY "Users manage their own recipient rows" ON "public"."notification_recipients" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "actions_select" ON "public"."actions" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."admin_login_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_user_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_user_actions_select" ON "public"."admin_user_actions" FOR SELECT TO "authenticated" USING ("public"."has_permission"('users'::"text", 'read'::"text"));



ALTER TABLE "public"."banks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "banks_insert" ON "public"."banks" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('payouts'::"text", 'create'::"text"));



CREATE POLICY "banks_select" ON "public"."banks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "banks_update" ON "public"."banks" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('payouts'::"text", 'update'::"text"));



ALTER TABLE "public"."buyer_credit_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."buyer_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete_policy" ON "public"."categories" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "categories_insert_policy" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "categories_select_policy" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "categories_update_policy" ON "public"."categories" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."document_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "document_types_delete_policy" ON "public"."document_types" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "document_types_insert_policy" ON "public"."document_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "document_types_select_policy" ON "public"."document_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "document_types_update_policy" ON "public"."document_types" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."email_change_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."identification_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "identification_types_delete_policy" ON "public"."identification_types" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "identification_types_insert_policy" ON "public"."identification_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "identification_types_select_policy" ON "public"."identification_types" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "identification_types_update_policy" ON "public"."identification_types" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."legal_acceptances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "legal_acceptances_insert" ON "public"."legal_acceptances" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "legal_acceptances_select" ON "public"."legal_acceptances" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."has_permission"('users'::"text", 'read'::"text")));



ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "legal_documents_insert" ON "public"."legal_documents" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "legal_documents_select" ON "public"."legal_documents" FOR SELECT USING (true);



CREATE POLICY "legal_documents_update" ON "public"."legal_documents" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."measurement_units" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "measurement_units_delete_policy" ON "public"."measurement_units" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "measurement_units_insert_policy" ON "public"."measurement_units" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "measurement_units_select_policy" ON "public"."measurement_units" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "measurement_units_update_policy" ON "public"."measurement_units" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."modules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "modules_select_policy" ON "public"."modules" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "modules_update_policy" ON "public"."modules" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."notification_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_min_price_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_min_price_history_insert_policy" ON "public"."order_min_price_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "order_min_price_history_select_policy" ON "public"."order_min_price_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."order_refund_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_change_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."password_reset_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_items_select" ON "public"."payout_items" FOR SELECT TO "authenticated" USING (("public"."has_permission"('payouts'::"text", 'read'::"text") OR "public"."is_store_member"("store_id")));



ALTER TABLE "public"."payout_settings_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_settings_insert" ON "public"."payout_settings_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('payouts'::"text", 'create'::"text"));



CREATE POLICY "payout_settings_select" ON "public"."payout_settings_history" FOR SELECT TO "authenticated" USING ("public"."has_permission"('payouts'::"text", 'read'::"text"));



ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payouts_select" ON "public"."payouts" FOR SELECT TO "authenticated" USING ("public"."has_permission"('payouts'::"text", 'read'::"text"));



ALTER TABLE "public"."person_type_identification_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_type_identification_types_delete_policy" ON "public"."person_type_identification_types" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "person_type_identification_types_insert_policy" ON "public"."person_type_identification_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "person_type_identification_types_select_policy" ON "public"."person_type_identification_types" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "person_type_identification_types_update_policy" ON "public"."person_type_identification_types" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."person_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "person_types_delete_policy" ON "public"."person_types" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "person_types_insert_policy" ON "public"."person_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "person_types_select_policy" ON "public"."person_types" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "person_types_update_policy" ON "public"."person_types" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."pibox_bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pibox_bookings_select_policy" ON "public"."pibox_bookings" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."pqrs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pqrs_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pqrs_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pqrs_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pqrs_settings_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_settings_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_settings_insert" ON "public"."pricing_settings_history" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "pricing_settings_select" ON "public"."pricing_settings_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."product_stock_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "profiles_select_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "role_permissions_select" ON "public"."role_permissions" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_select" ON "public"."roles" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."signup_email_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."siigo_credit_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."siigo_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "siigo_invoices_select_policy" ON "public"."siigo_invoices" FOR SELECT TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'read'::"text"));



ALTER TABLE "public"."store_bank_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_bank_accounts_insert" ON "public"."store_bank_accounts" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_store_member"("store_id") OR "public"."has_permission"('payouts'::"text", 'create'::"text")));



CREATE POLICY "store_bank_accounts_select" ON "public"."store_bank_accounts" FOR SELECT TO "authenticated" USING (("public"."is_store_member"("store_id") OR "public"."has_permission"('payouts'::"text", 'read'::"text")));



CREATE POLICY "store_bank_accounts_update" ON "public"."store_bank_accounts" FOR UPDATE TO "authenticated" USING (("public"."is_store_member"("store_id") OR "public"."has_permission"('payouts'::"text", 'update'::"text")));



ALTER TABLE "public"."store_buyer_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_charges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_document_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_document_events_select" ON "public"."store_document_events" FOR SELECT TO "authenticated" USING (("public"."fn_is_store_member"("store_id") OR "public"."has_permission"('stores'::"text", 'read'::"text")));



ALTER TABLE "public"."store_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_documents_delete" ON "public"."store_documents" FOR DELETE TO "authenticated" USING ("public"."has_permission"('stores'::"text", 'delete'::"text"));



CREATE POLICY "store_documents_insert" ON "public"."store_documents" FOR INSERT TO "authenticated" WITH CHECK (("public"."fn_is_store_member"("store_id") OR "public"."has_permission"('stores'::"text", 'update'::"text")));



CREATE POLICY "store_documents_select" ON "public"."store_documents" FOR SELECT TO "authenticated" USING (("public"."fn_is_store_member"("store_id") OR "public"."has_permission"('stores'::"text", 'read'::"text")));



CREATE POLICY "store_documents_update" ON "public"."store_documents" FOR UPDATE TO "authenticated" USING (("public"."fn_is_store_member"("store_id") OR "public"."has_permission"('stores'::"text", 'update'::"text"))) WITH CHECK (("public"."fn_is_store_member"("store_id") OR "public"."has_permission"('stores'::"text", 'update'::"text")));



ALTER TABLE "public"."store_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_groups_delete_policy" ON "public"."store_groups" FOR DELETE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'delete'::"text"));



CREATE POLICY "store_groups_insert_policy" ON "public"."store_groups" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_permission"('system-settings'::"text", 'create'::"text"));



CREATE POLICY "store_groups_select_policy" ON "public"."store_groups" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "store_groups_update_policy" ON "public"."store_groups" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('system-settings'::"text", 'update'::"text"));



ALTER TABLE "public"."store_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_members_select" ON "public"."store_members" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



CREATE POLICY "store_members_write" ON "public"."store_members" TO "authenticated" USING (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"())) WITH CHECK (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



ALTER TABLE "public"."store_order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."store_products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_products_delete" ON "public"."store_products" FOR DELETE TO "authenticated" USING (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



CREATE POLICY "store_products_insert" ON "public"."store_products" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



CREATE POLICY "store_products_select" ON "public"."store_products" FOR SELECT USING ((("is_active" AND (EXISTS ( SELECT 1
   FROM "public"."stores" "s"
  WHERE (("s"."id" = "store_products"."store_id") AND "s"."is_active")))) OR "public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



CREATE POLICY "store_products_update" ON "public"."store_products" FOR UPDATE TO "authenticated" USING (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"())) WITH CHECK (("public"."is_store_member"("store_id") OR "public"."is_platform_admin"()));



ALTER TABLE "public"."store_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "store_reviews_delete_own" ON "public"."store_reviews" FOR DELETE TO "authenticated" USING (("buyer_id" = "auth"."uid"()));



CREATE POLICY "store_reviews_insert_own" ON "public"."store_reviews" FOR INSERT TO "authenticated" WITH CHECK (("buyer_id" = "auth"."uid"()));



CREATE POLICY "store_reviews_select_all" ON "public"."store_reviews" FOR SELECT USING (true);



CREATE POLICY "store_reviews_update_own" ON "public"."store_reviews" FOR UPDATE TO "authenticated" USING (("buyer_id" = "auth"."uid"())) WITH CHECK (("buyer_id" = "auth"."uid"()));



ALTER TABLE "public"."user_deactivations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_deactivations_select" ON "public"."user_deactivations" FOR SELECT TO "authenticated" USING ("public"."has_permission"('users'::"text", 'read'::"text"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";








GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































REVOKE ALL ON FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_revoke_user_sessions"("p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."anonymize_buyer"("target" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."anonymize_buyer"("target" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_buyer_credit"("p_buyer" "uuid", "p_amount" numeric, "p_kind" "text", "p_refund" "uuid", "p_order" "uuid", "p_notes" "text", "p_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_buyer_credit"("p_buyer" "uuid", "p_amount" numeric, "p_kind" "text", "p_refund" "uuid", "p_order" "uuid", "p_notes" "text", "p_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."buyer_credit_balance"("p_buyer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."buyer_credit_balance"("p_buyer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."call_app_cron"("path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."call_app_cron"("path" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."call_edge_cron"("fn" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."call_edge_cron"("fn" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_order_refund"("p" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order_refund"("p" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."email_registrado_en_auth"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."email_registrado_en_auth"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."enqueue_siigo_credit_note"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."enqueue_siigo_credit_note"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_siigo_invoice"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_siigo_invoice"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_siigo_invoice"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."escalate_overdue_pqrs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."escalate_overdue_pqrs"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_unpaid_orders"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_unpaid_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_confirm_store_orders_on_payment"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_confirm_store_orders_on_payment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_confirm_store_orders_on_payment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_guard_store_document_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_guard_store_document_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_guard_store_document_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_is_store_member"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_log_store_document_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_log_store_document_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_log_store_document_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."fn_order_credit_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fn_order_credit_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_process_store_order_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_process_store_order_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_process_store_order_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_store_documents_guard_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_store_documents_guard_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_store_documents_guard_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_profile_authority"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_profile_authority"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_profile_authority"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_profile_authority"() TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_store_bank_account"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_store_bank_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_store_bank_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("module_key" "text", "action_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("module_key" "text", "action_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("module_key" "text", "action_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."immutable_unaccent"("texto" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("texto" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."immutable_unaccent"("texto" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_store_member"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_store_member"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_store_member"("p_store_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON FUNCTION "public"."payable_until"("o" "public"."orders") TO "anon";
GRANT ALL ON FUNCTION "public"."payable_until"("o" "public"."orders") TO "authenticated";
GRANT ALL ON FUNCTION "public"."payable_until"("o" "public"."orders") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_to_money"("p_refund" "uuid", "p_by" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_to_money"("p_refund" "uuid", "p_by" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reserve_order_credit"("p_order" "uuid", "p_buyer" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reserve_order_credit"("p_order" "uuid", "p_buyer" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revert_store_order_status"("p_store_order_id" "uuid", "p_target_status" "public"."order_status", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pibox_bookings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pibox_bookings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pibox_bookings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pqrs_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pqrs_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pqrs_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_pqrs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_pqrs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_pqrs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_profiles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_siigo_credit_notes_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_siigo_credit_notes_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_siigo_credit_notes_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_siigo_invoices_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_siigo_invoices_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_siigo_invoices_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_store_groups_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_store_groups_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_store_groups_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_store_order_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_store_order_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_store_order_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_store_reputation"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_store_reputation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_store_reputation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vitrina_categorias"("p_store_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."void_store_charge"("p_refund" "uuid", "p_by" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_store_charge"("p_refund" "uuid", "p_by" "uuid", "p_notes" "text") TO "service_role";
























GRANT ALL ON TABLE "public"."actions" TO "anon";
GRANT ALL ON TABLE "public"."actions" TO "authenticated";
GRANT ALL ON TABLE "public"."actions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_login_codes" TO "anon";
GRANT ALL ON TABLE "public"."admin_login_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_login_codes" TO "service_role";



GRANT ALL ON TABLE "public"."admin_user_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_user_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_user_actions" TO "service_role";



GRANT ALL ON TABLE "public"."banks" TO "anon";
GRANT ALL ON TABLE "public"."banks" TO "authenticated";
GRANT ALL ON TABLE "public"."banks" TO "service_role";



GRANT ALL ON TABLE "public"."buyer_credit_movements" TO "anon";
GRANT ALL ON TABLE "public"."buyer_credit_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."buyer_credit_movements" TO "service_role";



GRANT ALL ON TABLE "public"."buyer_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."buyer_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."buyer_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."catalog_products" TO "anon";
GRANT ALL ON TABLE "public"."catalog_products" TO "authenticated";
GRANT ALL ON TABLE "public"."catalog_products" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_addresses" TO "anon";
GRANT ALL ON TABLE "public"."delivery_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."document_types" TO "anon";
GRANT ALL ON TABLE "public"."document_types" TO "authenticated";
GRANT ALL ON TABLE "public"."document_types" TO "service_role";



GRANT ALL ON TABLE "public"."email_change_codes" TO "anon";
GRANT ALL ON TABLE "public"."email_change_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."email_change_codes" TO "service_role";



GRANT ALL ON TABLE "public"."identification_types" TO "anon";
GRANT ALL ON TABLE "public"."identification_types" TO "authenticated";
GRANT ALL ON TABLE "public"."identification_types" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."legal_acceptances" TO "anon";
GRANT ALL ON TABLE "public"."legal_acceptances" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_acceptances" TO "service_role";



GRANT ALL ON TABLE "public"."legal_documents" TO "anon";
GRANT ALL ON TABLE "public"."legal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_delivery_users" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_delivery_users" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_delivery_users" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_members" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_members" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_members" TO "service_role";



GRANT ALL ON TABLE "public"."marketplaces" TO "anon";
GRANT ALL ON TABLE "public"."marketplaces" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplaces" TO "service_role";



GRANT ALL ON TABLE "public"."marketplaces_detail" TO "anon";
GRANT ALL ON TABLE "public"."marketplaces_detail" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplaces_detail" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_units" TO "anon";
GRANT ALL ON TABLE "public"."measurement_units" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_units" TO "service_role";



GRANT ALL ON TABLE "public"."modules" TO "anon";
GRANT ALL ON TABLE "public"."modules" TO "authenticated";
GRANT ALL ON TABLE "public"."modules" TO "service_role";



GRANT ALL ON TABLE "public"."notification_recipients" TO "anon";
GRANT ALL ON TABLE "public"."notification_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_min_price_history" TO "anon";
GRANT ALL ON TABLE "public"."order_min_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_min_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."order_refund_items" TO "anon";
GRANT ALL ON TABLE "public"."order_refund_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_refund_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_refunds" TO "anon";
GRANT ALL ON TABLE "public"."order_refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."order_refunds" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_consecutive_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_consecutive_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_consecutive_seq" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."store_orders" TO "anon";
GRANT ALL ON TABLE "public"."store_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."store_orders" TO "service_role";



GRANT ALL ON TABLE "public"."store_products" TO "anon";
GRANT ALL ON TABLE "public"."store_products" TO "authenticated";
GRANT ALL ON TABLE "public"."store_products" TO "service_role";



GRANT ALL ON TABLE "public"."stores" TO "anon";
GRANT ALL ON TABLE "public"."stores" TO "authenticated";
GRANT ALL ON TABLE "public"."stores" TO "service_role";



GRANT ALL ON TABLE "public"."orders_detail_view" TO "anon";
GRANT ALL ON TABLE "public"."orders_detail_view" TO "authenticated";
GRANT ALL ON TABLE "public"."orders_detail_view" TO "service_role";



GRANT ALL ON TABLE "public"."password_change_codes" TO "anon";
GRANT ALL ON TABLE "public"."password_change_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_change_codes" TO "service_role";



GRANT ALL ON TABLE "public"."password_reset_codes" TO "anon";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."password_reset_codes" TO "service_role";



GRANT ALL ON TABLE "public"."payout_items" TO "anon";
GRANT ALL ON TABLE "public"."payout_items" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_items" TO "service_role";



GRANT ALL ON TABLE "public"."payout_settings_history" TO "anon";
GRANT ALL ON TABLE "public"."payout_settings_history" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_settings_history" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payouts_consecutive_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payouts_consecutive_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payouts_consecutive_seq" TO "service_role";



GRANT ALL ON TABLE "public"."person_type_identification_types" TO "anon";
GRANT ALL ON TABLE "public"."person_type_identification_types" TO "authenticated";
GRANT ALL ON TABLE "public"."person_type_identification_types" TO "service_role";



GRANT ALL ON TABLE "public"."person_types" TO "anon";
GRANT ALL ON TABLE "public"."person_types" TO "authenticated";
GRANT ALL ON TABLE "public"."person_types" TO "service_role";



GRANT ALL ON TABLE "public"."pibox_bookings" TO "anon";
GRANT ALL ON TABLE "public"."pibox_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."pibox_bookings" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pqrs_consecutive_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pqrs_consecutive_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pqrs_consecutive_seq" TO "service_role";



GRANT ALL ON TABLE "public"."pqrs" TO "anon";
GRANT ALL ON TABLE "public"."pqrs" TO "authenticated";
GRANT ALL ON TABLE "public"."pqrs" TO "service_role";



GRANT ALL ON TABLE "public"."pqrs_attachments" TO "anon";
GRANT ALL ON TABLE "public"."pqrs_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."pqrs_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."pqrs_items" TO "anon";
GRANT ALL ON TABLE "public"."pqrs_items" TO "authenticated";
GRANT ALL ON TABLE "public"."pqrs_items" TO "service_role";



GRANT ALL ON TABLE "public"."pqrs_messages" TO "anon";
GRANT ALL ON TABLE "public"."pqrs_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."pqrs_messages" TO "service_role";



GRANT ALL ON TABLE "public"."pqrs_settings_history" TO "anon";
GRANT ALL ON TABLE "public"."pqrs_settings_history" TO "authenticated";
GRANT ALL ON TABLE "public"."pqrs_settings_history" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_settings_history" TO "anon";
GRANT ALL ON TABLE "public"."pricing_settings_history" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_settings_history" TO "service_role";



GRANT ALL ON TABLE "public"."product_stock_movements" TO "anon";
GRANT ALL ON TABLE "public"."product_stock_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."product_stock_movements" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."signup_email_codes" TO "anon";
GRANT ALL ON TABLE "public"."signup_email_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."signup_email_codes" TO "service_role";



GRANT ALL ON TABLE "public"."siigo_credit_notes" TO "anon";
GRANT ALL ON TABLE "public"."siigo_credit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."siigo_credit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."siigo_invoices" TO "anon";
GRANT ALL ON TABLE "public"."siigo_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."siigo_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."store_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."store_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."store_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."store_buyer_blocks" TO "anon";
GRANT ALL ON TABLE "public"."store_buyer_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."store_buyer_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."store_categories" TO "anon";
GRANT ALL ON TABLE "public"."store_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."store_categories" TO "service_role";



GRANT ALL ON TABLE "public"."store_category_links" TO "anon";
GRANT ALL ON TABLE "public"."store_category_links" TO "authenticated";
GRANT ALL ON TABLE "public"."store_category_links" TO "service_role";



GRANT ALL ON TABLE "public"."store_charges" TO "anon";
GRANT ALL ON TABLE "public"."store_charges" TO "authenticated";
GRANT ALL ON TABLE "public"."store_charges" TO "service_role";



GRANT ALL ON TABLE "public"."store_document_events" TO "anon";
GRANT ALL ON TABLE "public"."store_document_events" TO "authenticated";
GRANT ALL ON TABLE "public"."store_document_events" TO "service_role";



GRANT ALL ON TABLE "public"."store_documents" TO "anon";
GRANT ALL ON TABLE "public"."store_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."store_documents" TO "service_role";



GRANT ALL ON TABLE "public"."store_favorites" TO "anon";
GRANT ALL ON TABLE "public"."store_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."store_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."store_groups" TO "anon";
GRANT ALL ON TABLE "public"."store_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."store_groups" TO "service_role";



GRANT ALL ON TABLE "public"."store_members" TO "anon";
GRANT ALL ON TABLE "public"."store_members" TO "authenticated";
GRANT ALL ON TABLE "public"."store_members" TO "service_role";



GRANT ALL ON TABLE "public"."store_offers" TO "anon";
GRANT ALL ON TABLE "public"."store_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."store_offers" TO "service_role";



GRANT ALL ON TABLE "public"."store_order_status_history" TO "anon";
GRANT ALL ON TABLE "public"."store_order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."store_order_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."store_reviews" TO "anon";
GRANT ALL ON TABLE "public"."store_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."store_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."user_deactivations" TO "anon";
GRANT ALL ON TABLE "public"."user_deactivations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_deactivations" TO "service_role";



GRANT ALL ON TABLE "public"."vitrina_productos" TO "anon";
GRANT ALL ON TABLE "public"."vitrina_productos" TO "authenticated";
GRANT ALL ON TABLE "public"."vitrina_productos" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


-- ============================================================================
-- Lo que `supabase db dump` no trae
-- ============================================================================

SET search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Storage: buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('plazas',          'plazas',          true,  null, null),
  ('stores',          'stores',          true,  null, null),
  ('assets',          'assets',          true,  null, null),
  ('products',        'products',        true,  null, null),
  ('avatars',         'avatars',         true,  null, null),
  ('legal',           'legal',           true,  null, null),
  ('store-documents', 'store-documents', false, null, null),
  ('payouts',         'payouts',         false, null, null),
  -- Sin políticas a propósito: a las fotos de PQRS solo se llega por el
  -- servidor, con URL firmadas.
  ('pqrs',            'pqrs',            false, 8388608,
     array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage: políticas
-- ---------------------------------------------------------------------------
create policy plazas_read   on storage.objects for select to authenticated using (bucket_id = 'plazas');
create policy plazas_upload on storage.objects for insert to authenticated with check (bucket_id = 'plazas' and public.has_permission('marketplace', 'create'));
create policy plazas_update on storage.objects for update to authenticated using (bucket_id = 'plazas' and public.has_permission('marketplace', 'update'));
create policy plazas_delete on storage.objects for delete to authenticated using (bucket_id = 'plazas' and public.has_permission('marketplace', 'delete'));

create policy stores_read   on storage.objects for select to authenticated using (bucket_id = 'stores');
create policy stores_upload on storage.objects for insert to authenticated with check (bucket_id = 'stores' and public.has_permission('stores', 'create'));
create policy stores_update on storage.objects for update to authenticated using (bucket_id = 'stores' and public.has_permission('stores', 'update'));
create policy stores_delete on storage.objects for delete to authenticated using (bucket_id = 'stores' and public.has_permission('stores', 'delete'));

create policy products_read   on storage.objects for select to authenticated using (bucket_id = 'products');
create policy products_upload on storage.objects for insert to authenticated with check (bucket_id = 'products' and public.has_permission('products', 'create'));
create policy products_update on storage.objects for update to authenticated using (bucket_id = 'products' and public.has_permission('products', 'update'));
create policy products_delete on storage.objects for delete to authenticated using (bucket_id = 'products' and public.has_permission('products', 'delete'));

create policy avatars_read   on storage.objects for select to public using (bucket_id = 'avatars');
create policy avatars_upload on storage.objects for insert to public with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);
create policy avatars_update on storage.objects for update to public using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);
create policy avatars_delete on storage.objects for delete to public using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (auth.uid())::text);

create policy store_documents_files_select on storage.objects for select to authenticated
  using (bucket_id = 'store-documents' and name ~ '^stores/[0-9a-fA-F-]{36}/'
         and (public.fn_is_store_member(((storage.foldername(name))[2])::uuid) or public.has_permission('stores', 'read')));
create policy store_documents_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store-documents' and name ~ '^stores/[0-9a-fA-F-]{36}/'
              and (public.fn_is_store_member(((storage.foldername(name))[2])::uuid) or public.has_permission('stores', 'update')));
create policy store_documents_files_update on storage.objects for update to authenticated
  using (bucket_id = 'store-documents' and name ~ '^stores/[0-9a-fA-F-]{36}/'
         and (public.fn_is_store_member(((storage.foldername(name))[2])::uuid) or public.has_permission('stores', 'update')));
create policy store_documents_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store-documents' and public.has_permission('stores', 'delete'));

create policy legal_read   on storage.objects for select to public using (bucket_id = 'legal');
create policy legal_upload on storage.objects for insert to authenticated with check (bucket_id = 'legal' and public.has_permission('system-settings', 'update'));
create policy legal_update on storage.objects for update to authenticated using (bucket_id = 'legal' and public.has_permission('system-settings', 'update'));
create policy legal_delete on storage.objects for delete to authenticated using (bucket_id = 'legal' and public.has_permission('system-settings', 'delete'));

create policy payouts_read   on storage.objects for select to authenticated using (bucket_id = 'payouts' and public.has_permission('payouts', 'read'));
create policy payouts_upload on storage.objects for insert to authenticated with check (bucket_id = 'payouts' and public.has_permission('payouts', 'update'));

-- ---------------------------------------------------------------------------
-- Funciones que no se pueden llamar desde el navegador
--
-- Un proyecto nuevo de Supabase le da EXECUTE a `anon` y `authenticated` sobre
-- toda función que se cree en `public`. En producción se les quitó a estas, y el
-- volcado no lo refleja: sin este bloque, en local y en staging cualquiera
-- podría llamarlas por la API (abonar saldo, crear devoluciones...).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.anonymize_buyer(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.anonymize_buyer(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.apply_buyer_credit(uuid, numeric, text, uuid, uuid, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_buyer_credit(uuid, numeric, text, uuid, uuid, text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.buyer_credit_balance(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.buyer_credit_balance(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.call_app_cron(text) FROM anon;
REVOKE ALL ON FUNCTION public.call_app_cron(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.call_edge_cron(text) FROM anon;
REVOKE ALL ON FUNCTION public.call_edge_cron(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.create_order_refund(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.create_order_refund(jsonb) FROM authenticated;
REVOKE ALL ON FUNCTION public.email_registrado_en_auth(text) FROM anon;
REVOKE ALL ON FUNCTION public.email_registrado_en_auth(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.enqueue_siigo_credit_note() FROM anon;
REVOKE ALL ON FUNCTION public.enqueue_siigo_credit_note() FROM authenticated;
REVOKE ALL ON FUNCTION public.escalate_overdue_pqrs() FROM anon;
REVOKE ALL ON FUNCTION public.escalate_overdue_pqrs() FROM authenticated;
REVOKE ALL ON FUNCTION public.expire_unpaid_orders() FROM anon;
REVOKE ALL ON FUNCTION public.expire_unpaid_orders() FROM authenticated;
REVOKE ALL ON FUNCTION public.fn_order_credit_guard() FROM anon;
REVOKE ALL ON FUNCTION public.fn_order_credit_guard() FROM authenticated;
REVOKE ALL ON FUNCTION public.refund_to_money(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.refund_to_money(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.reserve_order_credit(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_order_credit(uuid, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.revert_store_order_status(uuid, public.order_status, text) FROM anon;
REVOKE ALL ON FUNCTION public.void_store_charge(uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.void_store_charge(uuid, uuid, text) FROM authenticated;

-- ---------------------------------------------------------------------------
-- Tareas programadas (pg_cron)
--
-- `call_app_cron` y `call_edge_cron` leen de Vault `app_base_url` y
-- `app_cron_secret`. Los secretos no viajan en migraciones: cada entorno los
-- crea aparte (en local, `supabase/seed/local.sql`).
-- ---------------------------------------------------------------------------
select cron.schedule('pibox_sync',            '*/10 * * * *', $$select public.call_app_cron('/api/pibox/sync')$$);
select cron.schedule('siigo_invoices',        '*/5 * * * *',  $$select public.call_app_cron('/api/siigo/invoices/process')$$);
select cron.schedule('siigo_credit_notes',    '*/5 * * * *',  $$select public.call_app_cron('/api/siigo/credit-notes/process')$$);
select cron.schedule('payouts_draft',         '0 11 * * 2,4', $$select public.call_app_cron('/api/cron/payouts')$$);
select cron.schedule('sonda',                 '*/5 * * * *',  $$select public.call_edge_cron('zonapagos-sonda')$$);
select cron.schedule('expire_unpaid_orders',  '*/15 * * * *', $$select public.expire_unpaid_orders()$$);
select cron.schedule('escalate_overdue_pqrs', '*/15 * * * *', $$select public.escalate_overdue_pqrs()$$);

RESET ALL;
