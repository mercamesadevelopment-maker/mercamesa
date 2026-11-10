import { describe, expect, it } from 'vitest';
import { MCP_RELEASES, MCP_VERSION } from './changelog';

const parts = (v: string) => v.split('.').map(Number);

/** > 0 si `a` es más nueva que `b`. */
function compare(a: string, b: string) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

describe('cambios del MCP', () => {
  it('cada versión es semver y la fecha es un día válido', () => {
    for (const r of MCP_RELEASES) {
      expect(r.version, r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.fecha, r.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${r.fecha}T00:00:00Z`).toISOString().slice(0, 10), r.version).toBe(r.fecha);
    }
  });

  it('van de la más nueva a la más vieja, sin repetir, y las fechas no retroceden', () => {
    for (let i = 1; i < MCP_RELEASES.length; i++) {
      const [nueva, vieja] = [MCP_RELEASES[i - 1], MCP_RELEASES[i]];
      expect(compare(nueva.version, vieja.version), `${nueva.version} después de ${vieja.version}`).toBeGreaterThan(0);
      expect(nueva.fecha >= vieja.fecha, `${nueva.version} tiene fecha anterior a ${vieja.version}`).toBe(true);
    }
  });

  it('cada versión dice qué cambió', () => {
    for (const r of MCP_RELEASES) {
      expect(r.resumen.trim(), r.version).not.toBe('');
      expect(r.cambios.length, r.version).toBeGreaterThan(0);
      for (const c of r.cambios) {
        expect(c.donde.trim(), r.version).not.toBe('');
        expect(c.detalle.trim(), r.version).not.toBe('');
      }
    }
  });

  it('un cambio que rompe sube el primer número', () => {
    for (let i = 0; i < MCP_RELEASES.length - 1; i++) {
      const [r, anterior] = [MCP_RELEASES[i], MCP_RELEASES[i + 1]];
      if (r.cambios.some((c) => c.rompe)) {
        expect(parts(r.version)[0], `${r.version} rompe y debería pasar de ${parts(anterior.version)[0]}.x`).toBeGreaterThan(
          parts(anterior.version)[0]
        );
      }
    }
  });

  it('la versión del servidor es la más nueva', () => {
    expect(MCP_VERSION).toBe(MCP_RELEASES[0].version);
  });
});
