-- El código del producto (`store_products.code`) deja de ser obligatorio para
-- quien lo escribe: si llega vacío, la base le asigna uno (`MM-000123`).
--
-- Va en la base y no en la aplicación porque el código entra por varios lados
-- (las ventanas del admin y del tendero, la plantilla del tendero, la
-- asignación en lote del admin) y así todos quedan cubiertos, también los que
-- vengan después.
--
-- El consecutivo es global: no choca entre tiendas ni entre dos altas al mismo
-- tiempo. Si una tienda ya escribió a mano justo ese código, se salta.

create sequence public.store_product_code_seq;

-- `security definer`: tiene que ver todos los códigos de la tienda para no
-- repetir uno, no solo los que la RLS le deja ver a quien inserta.
create function public.generar_codigo_producto(p_store uuid) returns text
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
declare
  candidato text;
begin
  loop
    candidato := 'MM-' || lpad(nextval('public.store_product_code_seq')::text, 6, '0');
    exit when not exists (
      select 1 from store_products where store_id = p_store and upper(code) = candidato
    );
  end loop;
  return candidato;
end;
$$;

revoke all on function public.generar_codigo_producto(uuid) from public, anon, authenticated;

create function public.store_products_codigo_generado() returns trigger
    language plpgsql
    security definer
    set search_path to 'public'
    as $$
begin
  if new.code is null or btrim(new.code) = '' then
    new.code := generar_codigo_producto(new.store_id);
  end if;
  return new;
end;
$$;

create trigger store_products_codigo_generado
  before insert or update of code on public.store_products
  for each row execute function public.store_products_codigo_generado();

-- Los productos que ya estaban sin código (los asignó el admin en lote). Lo
-- llama también `supabase/seed/post.sql`: la copia de producción se carga
-- después de las migraciones y sin triggers.
create function public.asignar_codigos_faltantes() returns void
    language plpgsql
    set search_path to 'public'
    as $$
declare
  fila record;
begin
  for fila in
    select id, store_id from store_products where code is null order by store_id, created_at, id
  loop
    update store_products set code = generar_codigo_producto(fila.store_id) where id = fila.id;
  end loop;
end;
$$;

revoke all on function public.asignar_codigos_faltantes() from public, anon, authenticated;

select public.asignar_codigos_faltantes();
