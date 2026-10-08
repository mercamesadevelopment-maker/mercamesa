/**
 * scripts/generate-pwa-icons.ts
 *
 * Genera los íconos de la app instalable (PWA) a partir del logo.
 *
 * El logo (`public/logo-mercamesa.png`) no es cuadrado, y los íconos de app sí
 * deben serlo: se centra sobre el fondo crema de la marca. Se corre una vez y
 * los PNG resultantes se suben al repo; hay que volver a correrlo solo si
 * cambia el logo.
 *
 * Uso:
 *   pnpm exec tsx scripts/generate-pwa-icons.ts
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = path.join('public', 'logo-mercamesa.png');
const OUT_DIR = path.join('public', 'icons');
/** El mismo fondo del sitio (`body` en globals.css). */
const BACKGROUND = '#FAFAF5';

/**
 * `padding` es la fracción del lado que queda libre a cada lado. El maskable
 * lleva más: Android lo puede recortar en círculo, y la zona segura es el 80 %
 * central.
 */
const ICONS = [
  { file: 'icon-192.png', size: 192, padding: 0.1 },
  { file: 'icon-512.png', size: 512, padding: 0.1 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.2 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0.1 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const { file, size, padding } of ICONS) {
    const inner = Math.round(size * (1 - padding * 2));
    const logo = await sharp(SOURCE)
      .resize(inner, inner, { fit: 'contain', background: BACKGROUND })
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
