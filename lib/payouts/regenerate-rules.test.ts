import { describe, expect, it } from 'vitest';
import { planearCuentas } from './regenerate-rules';

const item = (storeId: string, bankAccountId: string, storeName = `Tienda ${storeId}`) => ({
  storeId,
  storeName,
  bankAccountId,
});

describe('planearCuentas', () => {
  it('sin cambios de cuenta: no cambia nada', () => {
    expect(planearCuentas([item('a', 'c1'), item('a', 'c1')], [{ storeId: 'a', id: 'c1' }])).toEqual({
      ok: true,
      cambios: [],
    });
  });

  it('la tienda corrigió su cuenta: pasa a la vigente, una vez por cuenta vieja', () => {
    const r = planearCuentas(
      [item('a', 'vieja'), item('a', 'vieja'), item('b', 'c2')],
      [
        { storeId: 'a', id: 'nueva' },
        { storeId: 'b', id: 'c2' },
      ]
    );
    expect(r).toEqual({ ok: true, cambios: [{ storeId: 'a', storeName: 'Tienda a', from: 'vieja', to: 'nueva' }] });
  });

  it('pedidos de una tienda con dos cuentas viejas distintas', () => {
    const r = planearCuentas([item('a', 'v1'), item('a', 'v2')], [{ storeId: 'a', id: 'nueva' }]);
    expect(r.ok && r.cambios.map((c) => c.from)).toEqual(['v1', 'v2']);
  });

  it('una tienda sin cuenta verificada vigente: no se regenera y dice cuál', () => {
    const r = planearCuentas([item('a', 'c1', 'Frutas Darío'), item('b', 'c2')], [{ storeId: 'b', id: 'c2' }]);
    expect(r).toEqual({
      ok: false,
      error: 'Frutas Darío no tiene una cuenta verificada vigente. Verifícala y vuelve a intentarlo.',
    });
  });
});
