/**
 * scripts/backfill-image-variants.ts
 *
 * Genera los derivados WebP (ver lib/images/variants.ts) para todas las
 * imágenes ya subidas antes de este cambio, para que la app deje de depender
 * de Supabase Storage Image Transformations sin dejar imágenes rotas.
 *
 * Es puramente aditivo: solo sube objetos nuevos, nunca toca ni borra los
 * originales existentes, así que es seguro correrlo contra producción en
 * cualquier momento (incluso antes de deployar el resto del cambio).
 *
 * Idempotente: si el derivado ya existe lo salta, así que se puede
 * interrumpir y volver a correr sin duplicar trabajo.
 *
 * Uso:
 *   pnpm backfill:images --dry-run   (solo inventaria, no sube nada)
 *   pnpm backfill:images             (genera y sube los derivados)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { ImageVariant, derivativePath } from '../lib/images/variants';
import { generateVariantBuffer } from '../lib/images/generate';
import type { Database } from '../types/database_generated';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno (.env).');
  process.exit(1);
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const DRY_RUN = process.argv.includes('--dry-run');

interface Target {
  bucket: string;
  path: string;
  variants: ImageVariant[];
  label: string;
}

async function collectTargets(): Promise<Target[]> {
  const targets: Target[] = [];

  const { data: products, error: productsError } = await supabase
    .from('catalog_products')
    .select('name, image_url');
  if (productsError) throw productsError;
  for (const p of products ?? []) {
    if (p.image_url) {
      targets.push({ bucket: 'products', path: p.image_url, variants: ['thumb', 'card'], label: `catalog_products/${p.name}` });
    }
  }

  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('name, logo_url, cover_image_url');
  if (storesError) throw storesError;
  for (const s of stores ?? []) {
    if (s.logo_url) targets.push({ bucket: 'stores', path: s.logo_url, variants: ['logo'], label: `stores/${s.name}/logo` });
    if (s.cover_image_url) targets.push({ bucket: 'stores', path: s.cover_image_url, variants: ['cover'], label: `stores/${s.name}/cover` });
  }

  const { data: marketplaces, error: marketplacesError } = await supabase
    .from('marketplaces')
    .select('name, logo_url, cover_image_url');
  if (marketplacesError) throw marketplacesError;
  for (const m of marketplaces ?? []) {
    if (m.logo_url) targets.push({ bucket: 'plazas', path: m.logo_url, variants: ['logo'], label: `marketplaces/${m.name}/logo` });
    if (m.cover_image_url) targets.push({ bucket: 'plazas', path: m.cover_image_url, variants: ['cover'], label: `marketplaces/${m.name}/cover` });
  }

  // Nota: categories.image_url existe en el esquema, pero no se encontró
  // ninguna ruta de subida ni ningún lugar de la app que lo transforme/sirva
  // hoy, así que no hay convención de bucket confiable para incluirlo aquí.
  // Si en el futuro se agrega esa funcionalidad, sumar su recolección aquí.

  return targets;
}

async function derivativeExists(bucket: string, derivedPath: string): Promise<boolean> {
  const lastSlash = derivedPath.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : derivedPath.slice(0, lastSlash);
  const filename = lastSlash === -1 ? derivedPath : derivedPath.slice(lastSlash + 1);

  const { data, error } = await supabase.storage.from(bucket).list(dir, { search: filename });
  if (error) return false;
  return (data ?? []).some((f) => f.name === filename);
}

async function processTarget(target: Target): Promise<'processed' | 'skipped' | 'failed'> {
  const pendingVariants: ImageVariant[] = [];
  for (const variant of target.variants) {
    const exists = await derivativeExists(target.bucket, derivativePath(target.path, variant));
    if (!exists) pendingVariants.push(variant);
  }

  if (pendingVariants.length === 0) return 'skipped';
  if (DRY_RUN) return 'processed';

  const { data: original, error: downloadError } = await supabase.storage.from(target.bucket).download(target.path);
  if (downloadError || !original) {
    console.error(`\n  ✗ No se pudo descargar ${target.bucket}/${target.path}: ${downloadError?.message}`);
    return 'failed';
  }

  const buffer = Buffer.from(await original.arrayBuffer());

  for (const variant of pendingVariants) {
    try {
      const derivedBuffer = await generateVariantBuffer(buffer, variant);
      const derivedPath = derivativePath(target.path, variant);
      const { error: uploadError } = await supabase.storage.from(target.bucket).upload(derivedPath, derivedBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
      if (uploadError) throw new Error(uploadError.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n  ✗ Fallo con la variante "${variant}" de ${target.label} (${target.bucket}/${target.path}): ${message}`);
      return 'failed';
    }
  }

  return 'processed';
}

async function main() {
  console.log(
    DRY_RUN
      ? 'Modo --dry-run: solo se va a inventariar, no se sube nada.\n'
      : 'Generando derivados WebP en Supabase Storage...\n'
  );

  const targets = await collectTargets();
  console.log(`Imágenes referenciadas en la base de datos: ${targets.length}`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const target of targets) {
    const result = await processTarget(target);
    if (result === 'processed') processed++;
    else if (result === 'skipped') skipped++;
    else {
      failed++;
      failures.push(`${target.label} (${target.bucket}/${target.path})`);
    }
    process.stdout.write('.');
  }

  console.log('\n\nResumen:');
  console.log(`  ${DRY_RUN ? 'Pendientes de generar' : 'Procesadas'}: ${processed}`);
  console.log(`  Ya tenían sus derivados (saltadas): ${skipped}`);
  console.log(`  Fallidas: ${failed}`);

  if (failures.length > 0) {
    console.log('\nFallos:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
}

main().catch((err) => {
  console.error('Error fatal en el backfill:', err);
  process.exit(1);
});
