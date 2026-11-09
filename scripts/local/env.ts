/**
 * Lo común de los scripts `local:*`.
 *
 * Leen las variables igual que `pnpm dev`: primero `.env.local` y después
 * `.env`, sin pisar lo que ya venía del primero. Así ven lo mismo que la app en
 * esta máquina.
 *
 * Importar este archivo antes que cualquier módulo de `lib/`: carga las
 * variables al evaluarse.
 */
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

const HOSTS_LOCALES = ['127.0.0.1', 'localhost'];

export interface LocalEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

/**
 * Las llaves de la base local. Lanza si la URL no es de esta máquina: aprobar
 * un pago o inventar pedidos en producción no tiene vuelta atrás.
 */
export function localEnv(): LocalEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceKey) {
    throw new Error(
      'No se encontró .env.local con NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  if (!HOSTS_LOCALES.includes(new URL(url).hostname)) {
    throw new Error(`Este script solo corre contra la base local, y la URL configurada es ${new URL(url).host}.`);
  }

  return { url, anonKey, serviceKey };
}

/** Termina el script con el mensaje del error, sin la traza. */
export function exitWithError(err: unknown): never {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
