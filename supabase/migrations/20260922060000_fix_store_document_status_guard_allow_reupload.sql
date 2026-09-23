-- El guardián bloqueaba también el reemplazo legítimo.
--
-- La versión anterior rechazaba CUALQUIER cambio de estado hecho por quien no
-- administra. Pero subir un archivo nuevo devuelve el documento a «pendiente», y
-- eso lo hace la tienda: con el guardián tal como estaba, el tendero ya no podía
-- reemplazar un documento aprobado, que es justo lo que el producto promete.
--
-- La excepción no es un hueco: solo permite BAJAR a pendiente, y únicamente
-- cuando el archivo cambia. Aprobarse a sí misma sigue siendo imposible.

create or replace function public.fn_guard_store_document_status()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    -- Un documento recién subido no lo ha revisado nadie.
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
