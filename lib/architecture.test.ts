import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La dirección de las dependencias: la interfaz (`src/`, `app/`, `components/`)
 * puede importar de `lib/`, pero no al revés. Y `app/api/` es servidor: tampoco
 * importa de la interfaz. Así `lib/` se prueba sin React y `src/` se puede
 * mover o borrar sin romper el servidor.
 */
const ROOT = resolve(__dirname, '..');

const IMPORT = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));
}

/** La carpeta del repo a la que apunta un import (`src`, `app/api`…), o null si es un paquete. */
function target(file: string, spec: string): string | null {
  if (spec.startsWith('@/')) return spec.slice(2);
  if (spec.startsWith('.')) return relative(ROOT, resolve(ROOT, dirname(file), spec)).replace(/\\/g, '/');
  return null;
}

function violations(dir: string, forbidden: (path: string) => boolean): string[] {
  const found: string[] = [];
  for (const file of sourceFiles(dir)) {
    readFileSync(join(ROOT, file), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const [, spec] of line.matchAll(IMPORT)) {
          const path = target(file, spec);
          if (path && forbidden(path)) found.push(`${file.replace(/\\/g, '/')}:${i + 1} → ${spec}`);
        }
      });
  }
  return found;
}

const isUi = (path: string) => /^(src|app|components)(\/|$)/.test(path);

describe('dirección de las dependencias', () => {
  it('lib/ no importa de src/, app/ ni components/', () => {
    expect(violations('lib', isUi)).toEqual([]);
  });

  it('app/api/ no importa de la interfaz', () => {
    expect(violations('app/api', (p) => isUi(p) && !p.startsWith('app/api'))).toEqual([]);
  });
});
