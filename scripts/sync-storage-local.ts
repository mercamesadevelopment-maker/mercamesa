/**
 * scripts/sync-storage-local.ts
 *
 * Copia al Storage LOCAL —o al de staging, con `--staging`— los archivos de los
 * buckets públicos de producción (fotos de productos, tiendas y plazas, avatares,
 * documentos legales).
 *
 * `supabase db reset` trae los datos, pero los archivos no viajan en un volcado
 * de la base: sin esto, en local las imágenes salen rotas. Los buckets privados
 * (documentos de tiendas, dispersiones, fotos de PQRS) no se copian.
 *
 * Uso:
 *   pnpm db:sync-storage              Todos los buckets públicos
 *   pnpm db:sync-storage plazas       Solo uno
 *   pnpm staging:sync-storage         Lo mismo, hacia staging
 *
 * Lee producción de `.env` y el destino de `.env.local` (o `.env.staging`). Nunca
 * escribe en producción: en local exige que la URL sea de esta máquina, y en
 * staging que no sea la de producción. Lo que ya existe en local se
 * salta, así que se puede cortar y volver a correr.
 *
 * Lo bajado queda en `supabase/.storage-cache` (fuera de git). `supabase db
 * reset` vacía el Storage local, y sin esa copia cada reinicio volvería a bajar
 * todo de producción (las fotos de productos pesan cerca de 800 MB).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKETS_PUBLICOS = ['plazas', 'stores', 'assets', 'products', 'avatars', 'legal'];
const EN_PARALELO = 8;
const POR_PAGINA = 1000;
const CACHE = path.join('supabase', '.storage-cache');

function leerEnv(archivo: string): Record<string, string> {
  if (!fs.existsSync(archivo)) throw new Error(`No existe ${archivo}.`);
  return parse(fs.readFileSync(archivo));
}

function cliente(env: Record<string, string>, origen: string): SupabaseClient {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error(`Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en ${origen}.`);
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Todas las rutas de un bucket, bajando por las carpetas. */
async function listarTodo(supabase: SupabaseClient, bucket: string, carpeta = ''): Promise<string[]> {
  const rutas: string[] = [];

  for (let desde = 0; ; desde += POR_PAGINA) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(carpeta, { limit: POR_PAGINA, offset: desde, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`No se pudo listar ${bucket}/${carpeta}: ${error.message}`);

    for (const entrada of data ?? []) {
      const ruta = carpeta ? `${carpeta}/${entrada.name}` : entrada.name;
      // Las carpetas llegan sin id.
      if (entrada.id === null) rutas.push(...(await listarTodo(supabase, bucket, ruta)));
      else rutas.push(ruta);
    }

    if (!data || data.length < POR_PAGINA) break;
  }

  return rutas;
}

async function copiarBucket(prod: SupabaseClient, local: SupabaseClient, bucket: string) {
  const [enProd, enLocal] = await Promise.all([listarTodo(prod, bucket), listarTodo(local, bucket)]);
  const yaEstan = new Set(enLocal);
  const faltan = enProd.filter((ruta) => !yaEstan.has(ruta));

  console.log(`${bucket}: ${enProd.length} archivos, ${faltan.length} por copiar.`);

  let copiados = 0;
  let fallidos = 0;

  const copiar = async (ruta: string) => {
    const enCache = path.join(CACHE, bucket, ruta);
    const enCacheTipo = `${enCache}.tipo`;
    let contenido: Buffer;
    let tipo: string | undefined;

    if (fs.existsSync(enCache)) {
      contenido = fs.readFileSync(enCache);
      tipo = fs.existsSync(enCacheTipo) ? fs.readFileSync(enCacheTipo, 'utf8') : undefined;
    } else {
      const { data: archivo, error: errorBajada } = await prod.storage.from(bucket).download(ruta);
      if (errorBajada || !archivo) {
        fallidos++;
        console.error(`  no se pudo bajar ${bucket}/${ruta}: ${errorBajada?.message}`);
        return;
      }
      contenido = Buffer.from(await archivo.arrayBuffer());
      tipo = archivo.type || undefined;
      fs.mkdirSync(path.dirname(enCache), { recursive: true });
      fs.writeFileSync(enCache, contenido);
      if (tipo) fs.writeFileSync(enCacheTipo, tipo);
    }

    const { error: errorSubida } = await local.storage
      .from(bucket)
      .upload(ruta, contenido, { contentType: tipo, upsert: true });
    if (errorSubida) {
      fallidos++;
      console.error(`  no se pudo subir ${bucket}/${ruta}: ${errorSubida.message}`);
      return;
    }

    copiados++;
    if (copiados % 200 === 0) console.log(`  ${bucket}: ${copiados}/${faltan.length}`);
  };

  // Tandas cortas: sin límite, miles de descargas a la vez tumban la conexión.
  for (let i = 0; i < faltan.length; i += EN_PARALELO) {
    await Promise.all(faltan.slice(i, i + EN_PARALELO).map(copiar));
  }

  console.log(`${bucket}: ${copiados} copiados${fallidos ? `, ${fallidos} con error` : ''}.`);
}

const PROD_REF = 'zaqvcpehhmkiyjdbcufj';

/** El Storage al que se copia: el local o, con `--staging`, el de staging. */
function destino(): { env: Record<string, string>; archivo: string } {
  if (process.argv.includes('--staging')) {
    const env = leerEnv('.env.staging');
    if ((env.NEXT_PUBLIC_SUPABASE_URL ?? '').includes(PROD_REF)) {
      throw new Error('.env.staging apunta al proyecto de PRODUCCIÓN. No se hace nada.');
    }
    return { env, archivo: '.env.staging' };
  }

  const env = leerEnv('.env.local');
  const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://sin-url').hostname;
  if (!['127.0.0.1', 'localhost'].includes(host)) {
    throw new Error(`El destino debe ser la base local, y .env.local apunta a ${host}.`);
  }
  return { env, archivo: '.env.local' };
}

async function main() {
  const dest = destino();
  const prod = cliente(leerEnv('.env'), '.env');
  const local = cliente(dest.env, dest.archivo);

  const pedido = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (pedido && !BUCKETS_PUBLICOS.includes(pedido)) {
    throw new Error(`"${pedido}" no es un bucket público. Opciones: ${BUCKETS_PUBLICOS.join(', ')}.`);
  }

  for (const bucket of pedido ? [pedido] : BUCKETS_PUBLICOS) {
    await copiarBucket(prod, local, bucket);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
