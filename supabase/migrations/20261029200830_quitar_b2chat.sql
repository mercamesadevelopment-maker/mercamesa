-- Se retira la integración con B2Chat: la reemplaza el MCP de Meteor, que
-- resuelve cada consulta contra el usuario real y no con una cuenta técnica
-- que ve todo. Sus rutas (`app/api/b2chat`) salen en el mismo cambio.
--
-- «La plataforma» queda en admin y superadmin. La cuenta de integración leía
-- pedidos y clientes de todos los compradores, y su contraseña quedó en el
-- repositorio: se borra la cuenta, no solo el rol.

create or replace function public.es_lector_de_plataforma()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles p join roles r on r.id = p.role_id
    where p.id = auth.uid() and p.is_active
      and r.name in ('admin', 'superadmin')
  );
$$;

-- El perfil cae en cascada. En una base recién creada no hay cuentas todavía
-- (las migraciones corren antes de los datos) y esto no hace nada; la copia de
-- producción que se cargue después la limpia `supabase/seed/post.sql`.
delete from auth.users
where id in (
  select p.id from public.profiles p
  join public.roles r on r.id = p.role_id
  where r.name = 'b2chat_integration'
);

delete from public.role_permissions
where role_id in (select id from public.roles where name = 'b2chat_integration');

delete from public.roles where name = 'b2chat_integration';
