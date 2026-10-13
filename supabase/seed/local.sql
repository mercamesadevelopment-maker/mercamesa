-- Ajustes que solo valen para la base local. Corre al final de cada
-- `supabase db reset`, después de `post.sql`, que tiene lo que comparte con staging.

-- Secretos de Vault. Son valores de mentira: el de verdad vive solo en el Vault
-- de cada proyecto y nunca en un archivo. `CRON_SECRET` de `.env.local` tiene
-- que decir lo mismo que `app_cron_secret`.
select vault.create_secret('http://host.docker.internal:4005', 'app_base_url')
where not exists (select 1 from vault.secrets where name = 'app_base_url');

select vault.create_secret('local-cron-secret', 'app_cron_secret')
where not exists (select 1 from vault.secrets where name = 'app_cron_secret');
