/**
 * scripts/generate-pwa-icons.ts
 *
 * Genera los íconos de la app instalable (PWA) a partir del símbolo de la marca.
 *
 * Como el «Ícono de app» de la marca (lámina 8 del caso de marca): el símbolo en
 * lima sobre fondo tinta. Se corre una vez y los PNG resultantes se suben al
 * repo; hay que volver a correrlo solo si cambia el símbolo.
 *
 * Uso:
 *   pnpm exec tsx scripts/generate-pwa-icons.ts
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = path.join('public', 'brand', 'mercamesa-simbolo-lima.svg');
const OUT_DIR = path.join('public', 'icons');
/** Verde tinta de la marca. */
const BACKGROUND = '#0E3B2F';

/**
 * `padding` es la fracción del lado que queda libre a cada lado. El maskable
 * lleva más: Android lo puede recortar en círculo, y la zona segura es el 80 %
 * central.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, padding: 0.16 },
  { file: 'icon-512.png', size: 512, padding: 0.16 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.24 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.16 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const { file, size, padding } of ICONS) {
    const inner = Math.round(size * (1 - padding * 2));
    // `density`: el SVG se rasteriza grande antes de reducirlo, para que el
    // trazo salga nítido.
    const logo = await sharp(SOURCE, { density: 600 })
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    await sharp({
      create: { width: size, height: size, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: logo, gravity: 'center' }])
      .png()
      .toFile(path.join(OUT_DIR, file));

    console.log(`✓ ${file} (${size}×${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
