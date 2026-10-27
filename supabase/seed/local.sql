-- Ajustes que solo valen para la base local. Corre al final de cada
-- `supabase db reset`, después de `post.sql`, que tiene lo que comparte con staging.

-- Secretos de Vault. Son valores de mentira: el de verdad vive solo en el Vault
-- de cada proyecto y nunca en un archivo. `CRON_SECRET` de `.env.local` tiene
-- que decir lo mismo que `app_cron_secret`.
select vault.create_secret('http://host.docker.internal:4005', 'app_base_url')
where not exists (select 1 from vault.secrets where name = 'app_base_url');

select vault.create_secret('local-cron-secret', 'app_cron_secret')
where not exists (select 1 from vault.secrets where name = 'app_cron_secret');

-- Una cuenta de auxiliar contable para probar Contabilidad sin invitarla. La
-- copia de producción no trae ninguna. La contraseña es solo de esta base local
-- (`contable-local`); como el rol pide código, `pnpm dev` lo muestra en la
-- consola del servidor. En staging y producción se invita desde Usuarios.
do $$
declare
  v_id uuid := '00000000-0000-0000-0000-00000000c0a7';
begin
  if exists (select 1 from auth.users where email = 'contable@mercamesa.local') then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    'contable@mercamesa.local', extensions.crypt('contable-local', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', 'contable@mercamesa.local', 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, email, full_name, role_id, language, is_active)
  select v_id, 'contable@mercamesa.local', 'Auxiliar contable (local)', r.id, 'es', true
  from public.roles r where r.name = 'accountant';
end $$;
