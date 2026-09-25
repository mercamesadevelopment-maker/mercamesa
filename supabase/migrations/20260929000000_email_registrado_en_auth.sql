-- ¿Ese correo ya tiene usuario de Auth?
--
-- El registro preguntaba solo por `profiles`, pero `auth.signUp` mira
-- `auth.users`. Los correos que estaban en una tabla y no en la otra —nueve, el
-- más viejo de junio— pasaban el primer filtro, recibían el código, llenaban
-- todo el formulario y solo al final se topaban con "la cuenta ya existe".
--
-- `auth.users` no se puede consultar por PostgREST, y la alternativa desde la
-- aplicación —`auth.admin.listUsers()`— devuelve solo los primeros 50 si no se
-- pagina: funcionaría hoy con 34 usuarios y empezaría a fallar en silencio
-- después, que es la peor forma de fallar.
--
-- SECURITY DEFINER porque `auth.users` no es accesible para los roles normales.
-- Devuelve un booleano y nada más: no expone ids, fechas ni ningún otro dato, y
-- quien llama ya conoce el correo que está preguntando.

create or replace function public.email_registrado_en_auth(p_email text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(btrim(p_email))
  );
$$;

comment on function public.email_registrado_en_auth(text) is
  'Si existe un usuario de Auth con ese correo. La usa el registro para no dejar avanzar a alguien que después chocaría contra auth.signUp.';

-- Solo el servidor: la ruta de registro la llama con la llave de servicio. Si se
-- dejara abierta al rol anónimo sería una forma directa de averiguar qué correos
-- están registrados, que es justo lo que el resto del flujo evita.
revoke execute on function public.email_registrado_en_auth(text) from public;
revoke execute on function public.email_registrado_en_auth(text) from anon;
revoke execute on function public.email_registrado_en_auth(text) from authenticated;
grant execute on function public.email_registrado_en_auth(text) to service_role;
