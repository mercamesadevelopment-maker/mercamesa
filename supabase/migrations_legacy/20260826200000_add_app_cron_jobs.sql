-- Crons de la aplicación en Supabase, no en Vercel.
--
-- El plan Hobby de Vercel solo permite crons DIARIOS: un `vercel.json` con
-- "*/10 * * * *" hace fallar el despliegue. Supabase ya está pago y trae
-- pg_cron + pg_net, y el proyecto ya usa ese patrón para `zonapagos-sonda`.
--
-- Los dos trabajos que se programan acá:
--   /api/pibox/sync              reconcilia domicilios cuyos webhooks se hayan perdido
--   /api/siigo/invoices/process  emite en Siigo las facturas encoladas
--
-- El secreto NO va en el comando del cron. El trabajo `sonda` lo dejó escrito
-- en claro dentro de `cron.job.command`, donde lo ve cualquiera que pueda leer
-- esa tabla; acá se lee de Vault en tiempo de ejecución.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

/**
 * Llama a una ruta de la aplicación con el secreto del cron.
 *
 * SECURITY DEFINER porque solo el dueño puede leer `vault.decrypted_secrets`,
 * y así el secreto nunca aparece en la definición del trabajo.
 */
create or replace function public.call_app_cron(path text)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  base_url text;
  secret text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'app_base_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'app_cron_secret';

  if base_url is null or secret is null then
    -- Falla ruidosamente: un cron que no hace nada en silencio es peor que uno
    -- que no existe, porque nadie se entera de que dejó de correr.
    raise exception 'Faltan los secretos app_base_url o app_cron_secret en Vault';
  end if;

  -- pg_net registra la extension en el esquema `extensions`, pero sus funciones
  -- viven en el esquema `net`: con `extensions.net.http_post` Postgres lo lee
  -- como base.esquema.funcion y falla.
  return net.http_post(
    url := rtrim(base_url, '/') || path,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || secret
    ),
    body := '{}'::jsonb,
    -- Emitir facturas contra Siigo puede tomar varios segundos: el trabajo
    -- `sonda` usa 1000 ms y eso cortaría la respuesta a medias.
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.call_app_cron(text) from public, anon, authenticated;

-- `unschedule` falla si el trabajo no existe, así que se consulta primero.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'pibox_sync') then
    perform cron.unschedule('pibox_sync');
  end if;
  if exists (select 1 from cron.job where jobname = 'siigo_invoices') then
    perform cron.unschedule('siigo_invoices');
  end if;
end $$;

-- Cada 10 min: los webhooks de Pibox son at-most-once, esto los reconcilia.
select cron.schedule('pibox_sync', '*/10 * * * *', $$select public.call_app_cron('/api/pibox/sync')$$);

-- Cada 5 min: que la factura salga poco después de confirmarse el pago.
select cron.schedule('siigo_invoices', '*/5 * * * *', $$select public.call_app_cron('/api/siigo/invoices/process')$$);
