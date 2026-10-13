/**
 * scripts/staging-refresh.ts
 *
 * Deja la base de STAGING igual a producción: borra staging, aplica todas las
 * migraciones y carga la última copia de los datos de producción. Es el mismo
 * ciclo de `pnpm db:reset` en local, contra el proyecto de staging.
 *
 * Uso:
 *   pnpm db:pull-data                    Trae la copia más reciente de producción
 *   pnpm staging:refresh                 Muestra qué va a hacer, sin tocar nada
 *   pnpm staging:refresh --si            Lo hace
 *   pnpm staging:sync-storage            Copia las imágenes (aparte: tarda)
 *
 * Lee `.env.staging` (fuera de git; ver `.env.staging.example`). Se niega a
 * correr si cualquier URL apunta al proyecto de producción.
 *
 * Qué queda en staging:
 * - el esquema de `supabase/migrations`;
 * - los datos de producción (`supabase/seed/prod_data.sql`), con los ajustes de
 *   `post.sql`: tareas programadas que llaman hacia afuera apagadas, todos los
 *   módulos activos;
 * - los secretos de Vault de staging (`app_base_url`, `app_cron_secret`), que
 *   salen de `.env.staging` y nunca se escriben en un archivo del repo.
 *
 * La copia trae datos personales reales y contraseñas cifradas: las cuentas
 * entran con su contraseña de producción. Por eso staging debe tener
 * `EMAIL_DRY_RUN=true` y `PIBOX_DRY_RUN=true`.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';

const PROD_REF = 'zaqvcpehhmkiyjdbcufj';
const DATOS = path.join('supabase', 'seed', 'prod_data.sql');
const DIAS_PARA_AVISAR = 7;

function leerEnvStaging(): Record<string, string> {
  if (!fs.existsSync('.env.staging')) {
    throw new Error('No existe .env.staging. Cópialo de .env.staging.example y llénalo.');
  }
  return parse(fs.readFileSync('.env.staging'));
}

function exigir(env: Record<string, string>, clave: string): string {
  const valor = env[clave]?.trim();
  if (!valor) throw new Error(`Falta ${clave} en .env.staging.`);
  return valor;
}

/** Comillas simples de SQL. */
function literal(valor: string): string {
  return `'${valor.replace(/'/g, "''")}'`;
}

function supabase(args: string[]) {
  const r = spawnSync('supabase', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`Falló: supabase ${args[0]} ${args[1] ?? ''}`);
}

function main() {
  const env = leerEnvStaging();
  const dbUrl = exigir(env, 'STAGING_DB_URL');
  const apiUrl = exigir(env, 'NEXT_PUBLIC_SUPABASE_URL');
  const appUrl = exigir(env, 'STAGING_APP_URL');
  const cronSecret = exigir(env, 'CRON_SECRET');

  // La protección que importa: este script BORRA la base de destino.
  for (const [nombre, valor] of [['STAGING_DB_URL', dbUrl], ['NEXT_PUBLIC_SUPABASE_URL', apiUrl]]) {
    if (valor.includes(PROD_REF)) {
      throw new Error(`${nombre} apunta al proyecto de PRODUCCIÓN. No se hace nada.`);
    }
  }

  if (!fs.existsSync(DATOS)) {
    throw new Error(`No existe ${DATOS}. Corre primero: pnpm db:pull-data`);
  }
  const dias = (Date.now() - fs.statSync(DATOS).mtimeMs) / 86_400_000;

  console.log(`Destino: ${new URL(apiUrl).host}`);
  console.log(`Datos: ${DATOS}, de hace ${dias.toFixed(1)} días.`);
  if (dias > DIAS_PARA_AVISAR) {
    console.log(`  Tiene más de ${DIAS_PARA_AVISAR} días: considera correr antes pnpm db:pull-data.`);
  }

  if (!process.argv.includes('--si')) {
    console.log('\nEsto BORRA staging y lo vuelve a cargar. Para hacerlo: pnpm staging:refresh --si');
    return;
  }

  // 1. Esquema y datos: mismo orden que `[db.seed]` en config.toml, sin local.sql.
  supabase([
    'db', 'reset', '--db-url', dbUrl, '--yes',
    '--sql-paths', './seed/pre.sql',
    '--sql-paths', './seed/prod_data.sql',
    '--sql-paths', './seed/post.sql',
  ]);

  // 2. Vault. Va en un archivo temporal, fuera del repo, y se borra al terminar.
  const sql = ['app_base_url', 'app_cron_secret']
    .map((nombre, i) => {
      const valor = literal(i === 0 ? appUrl : cronSecret);
      return `select case
  when exists (select 1 from vault.secrets where name = '${nombre}')
    then (select vault.update_secret(id, ${valor}) from vault.secrets where name = '${nombre}')::text
  else vault.create_secret(${valor}, '${nombre}')::text
end as ${nombre};`;
    })
    .join('\n');

  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'staging-')), 'vault.sql');
  try {
    fs.writeFileSync(tmp, sql);
    supabase(['db', 'query', '--db-url', dbUrl, '-f', tmp]);
  } finally {
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  }

  console.log('\nStaging quedó con los datos de producción. Faltan las imágenes: pnpm staging:sync-storage');
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
