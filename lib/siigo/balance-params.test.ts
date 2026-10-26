import { describe, expect, it } from 'vitest';
import { cleanIdentification, parseBalanceRequest } from './balance-params';

const HOY = new Date('2026-10-26T12:00:00Z');
const base = { year: 2026, month_start: 1, month_end: 12 };

describe('parseBalanceRequest', () => {
  it('el general: sin cuentas no las manda, y sin tercero', () => {
    expect(parseBalanceRequest(base, HOY)).toEqual({
      ok: true,
      kind: 'general',
      payload: { year: 2026, month_start: 1, month_end: 12, includes_tax_difference: false },
      thirdPartyName: null,
    });
  });

  it('con rango de cuentas, diferencia fiscal y el mes 13 (cierre)', () => {
    const r = parseBalanceRequest(
      { ...base, month_end: '13', account_start: ' 11050501 ', account_end: '41350501', includes_tax_difference: true },
      HOY
    );
    expect(r).toMatchObject({
      ok: true,
      payload: { account_start: '11050501', account_end: '41350501', month_end: 13, includes_tax_difference: true },
    });
  });

  it('un general no lleva tercero aunque se lo manden', () => {
    const r = parseBalanceRequest({ ...base, identification: '123456' }, HOY);
    expect(r.ok && r.payload.customer).toBeUndefined();
  });

  it.each([
    [{ ...base, year: 1999 }, 'año'],
    [{ ...base, year: 2027 }, 'año'],
    [{ ...base, year: '26' }, 'año'],
    [{ ...base, month_start: 0 }, 'meses'],
    [{ ...base, month_end: 14 }, 'meses'],
    [{ ...base, month_start: 6, month_end: 3 }, 'posterior'],
    [{ ...base, account_start: '1105-05' }, 'solo números'],
    [{ ...base, account_start: '41350501', account_end: '11050501' }, 'mayor'],
  ])('rechaza %j', (body, texto) => {
    const r = parseBalanceRequest(body, HOY);
    expect(r.ok).toBe(false);
    expect('message' in r && r.message).toContain(texto);
  });

  it('por tercero: limpia la identificación y la sucursal va en 0 por defecto', () => {
    expect(
      parseBalanceRequest({ ...base, kind: 'third_party', identification: '900.123.456-7', third_party_name: ' Ana ' }, HOY)
    ).toEqual({
      ok: true,
      kind: 'third_party',
      payload: {
        year: 2026,
        month_start: 1,
        month_end: 12,
        includes_tax_difference: false,
        customer: { identification: '900123456', branch_office: 0 },
      },
      thirdPartyName: 'Ana',
    });
  });

  it('por tercero: exige identificación y una sucursal válida', () => {
    expect(parseBalanceRequest({ ...base, kind: 'third_party' }, HOY).ok).toBe(false);
    expect(parseBalanceRequest({ ...base, kind: 'third_party', identification: 'abc' }, HOY).ok).toBe(false);
    expect(parseBalanceRequest({ ...base, kind: 'third_party', identification: '123', branch_office: 1000 }, HOY).ok).toBe(false);
    expect(parseBalanceRequest({ ...base, kind: 'third_party', identification: '123', branch_office: '7' }, HOY)).toMatchObject({
      ok: true,
      payload: { customer: { identification: '123', branch_office: 7 } },
    });
  });
});

describe('cleanIdentification', () => {
  it('deja solo el número, sin dígito de verificación', () => {
    expect(cleanIdentification(' 71.385.915 ')).toBe('71385915');
    expect(cleanIdentification('900123456-7')).toBe('900123456');
    expect(cleanIdentification(52525)).toBe('52525');
    expect(cleanIdentification('CC 123')).toBeNull();
    expect(cleanIdentification('')).toBeNull();
  });
});
