-- La sonda de ZonaPagos no corría: 277 de 277 llamadas con 401.
--
-- El trabajo `sonda` de pg_cron llamaba a la función con `headers:='{}'`. La
-- clave se quitó del comando al sacarla del texto plano (ver
-- 20260826200000_add_app_cron_jobs.sql), pero no se reemplazó por nada, y la
-- puerta de Supabase además exigía un JWT que el cron no tiene. Sin la sonda
-- ningún pago abandonado en la pasarela se confirma ni se rechaza.
--
-- La función se despliega ahora sin verificación de JWT: su única puerta es
-- `x-cron-secret`, que se lee de Vault en tiempo de ejecución, igual que
-- `call_app_cron`. El `CRON_SECRET` de las Edge Functions debe ser igual a
-- `app_cron_secret`.

create or replace function public.call_edge_cron(fn text)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
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
    -- La sonda consulta a ZonaPagos un pago a la vez: 1000 ms la cortaban.
    timeout_milliseconds := 30000
  );
end;
$$;

revoke all on function public.call_edge_cron(text) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'sonda') then
    perform cron.unschedule('sonda');
  end if;
end $$;

select cron.schedule('sonda', '*/5 * * * *', $$select public.call_edge_cron('zonapagos-sonda')$$);
