import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas unitarias: lógica pura, sin base de datos ni red.
 *
 * Viven junto al archivo que prueban (`*.test.ts`). Las de base de datos están
 * en `supabase/tests` (pgTAP) y las de punta a punta en `e2e/` (Playwright);
 * ninguna de las dos pasa por acá.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**', 'supabase/**'],
    environment: 'node',
  },
});
