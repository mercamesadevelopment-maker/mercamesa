-- Guardar las categorías del catálogo en lote.
--
-- La pestaña de categorías se edita como una hoja de cálculo y guarda todo
-- junto: nombres, madres, descripciones, orden y activa, y filas nuevas. Si
-- algo falla, no queda nada a medias: todo va en una función, y una función es
-- una sola transacción.
--
-- `security invoker`: corren las políticas de `categories`, que ya piden
-- `has_permission('system-settings', 'create')` para crear y `'update'` para
-- editar. La validación con mensajes por celda la hace antes el servidor
-- (lib/categories/batch.ts); acá se vuelven a comprobar las dos reglas que
-- protegen la forma del árbol, para que una llamada directa no las salte.
--
-- p_filas: [{ key, id, slug, name, parent_key, description, sort_order, is_active }]
--   id         null en las nuevas.
--   parent_key id de una categoría guardada, o `key` de una nueva del mismo lote.
-- Devuelve { key: id } de las creadas.
create or replace function public.guardar_categorias(p_filas jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_creadas jsonb := '{}'::jsonb;
  v_claves_nuevas text[];
  f jsonb;
  v_id uuid;
  pasada int;
begin
  select coalesce(array_agg(x->>'key'), '{}') into v_claves_nuevas
  from jsonb_array_elements(p_filas) x
  where x->>'id' is null;

  -- Las nuevas, en dos pasadas: primero las que no cuelgan de otra nueva (las
  -- raíces y las hijas de una guardada); después las hijas de las recién
  -- creadas. Con dos niveles no hace falta más.
  for pasada in 1..2 loop
    for f in select x from jsonb_array_elements(p_filas) x where x->>'id' is null loop
      continue when v_creadas ? (f->>'key');
      continue when pasada = 1 and (f->>'parent_key') = any (v_claves_nuevas);

      insert into categories (name, slug, parent_id, description, sort_order, is_active)
      values (
        f->>'name',
        f->>'slug',
        case
          when f->>'parent_key' is null then null
          when v_creadas ? (f->>'parent_key') then (v_creadas->>(f->>'parent_key'))::uuid
          else (f->>'parent_key')::uuid
        end,
        nullif(f->>'description', ''),
        coalesce((f->>'sort_order')::int, 0),
        coalesce((f->>'is_active')::boolean, true)
      )
      returning id into v_id;

      v_creadas := v_creadas || jsonb_build_object(f->>'key', v_id);
    end loop;
  end loop;

  -- Las editadas. Su madre puede ser una de las recién creadas.
  for f in select x from jsonb_array_elements(p_filas) x where x->>'id' is not null loop
    update categories
    set name = f->>'name',
        parent_id = case
          when f->>'parent_key' is null then null
          when v_creadas ? (f->>'parent_key') then (v_creadas->>(f->>'parent_key'))::uuid
          else (f->>'parent_key')::uuid
        end,
        description = nullif(f->>'description', ''),
        sort_order = coalesce((f->>'sort_order')::int, 0),
        is_active = coalesce((f->>'is_active')::boolean, true)
    where id = (f->>'id')::uuid;

    -- Sin permiso, la política deja el update en cero filas sin error: se dice.
    if not found then
      raise exception 'No se pudo editar la categoría «%»: no existe o no tienes permiso.', f->>'name'
        using errcode = 'P0001';
    end if;
  end loop;

  -- La forma del árbol, ya con todo aplicado.
  if exists (select 1 from categories where parent_id = id) then
    raise exception 'Una categoría no puede ser su propia madre.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from categories c join categories m on m.id = c.parent_id where m.parent_id is not null
  ) then
    raise exception 'Una categoría madre tiene que ser raíz: no hay subcategorías de subcategorías.'
      using errcode = 'P0001';
  end if;

  return v_creadas;
end;
$$;

comment on function public.guardar_categorias(jsonb) is
  'Crea y edita categorías del catálogo en una sola transacción (pestaña de categorías de Parametrización).';

revoke all on function public.guardar_categorias(jsonb) from public, anon;
grant execute on function public.guardar_categorias(jsonb) to authenticated;
