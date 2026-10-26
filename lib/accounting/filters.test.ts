import { describe, expect, it } from 'vitest';
import { parseAccountingFilters, periodDates, periodRange, sanitizeSearch } from './filters';

const TIENDA = '308c1270-b687-448c-ae21-1b21fa2368bf';

describe('parseAccountingFilters', () => {
  it('lee los cuatro filtros', () => {
    const f = parseAccountingFilters(
      new URLSearchParams({ buyer: '  Ana ', store_id: TIENDA, marketplace_id: TIENDA, year: '2026', month: '10' })
    );
    expect(f).toEqual({ buyerQuery: 'Ana', storeId: TIENDA, marketplaceId: TIENDA, year: 2026, month: 10 });
  });

  it('descarta lo inválido', () => {
    const f = parseAccountingFilters(
      new URLSearchParams({ store_id: 'x', marketplace_id: "1' or 1=1", year: '26', month: '13' })
    );
    expect(f).toEqual({ buyerQuery: null, storeId: null, marketplaceId: null, year: null, month: null });
  });

  it('un mes sin año no filtra', () => {
    expect(parseAccountingFilters(new URLSearchParams({ month: '5' })).month).toBeNull();
  });
});

describe('periodRange', () => {
  it('el mes va de la medianoche de Colombia a la del mes siguiente', () => {
    expect(periodRange({ year: 2026, month: 10 })).toEqual({
      from: '2026-10-01T05:00:00.000Z',
      to: '2026-11-01T05:00:00.000Z',
    });
  });

  it('diciembre termina en enero del año siguiente', () => {
    expect(periodRange({ year: 2026, month: 12 })?.to).toBe('2027-01-01T05:00:00.000Z');
  });

  it('solo el año: todo el año', () => {
    expect(periodRange({ year: 2026, month: null })).toEqual({
      from: '2026-01-01T05:00:00.000Z',
      to: '2027-01-01T05:00:00.000Z',
    });
  });

  it('sin zona, para columnas timestamp que guardan UTC', () => {
    expect(periodRange({ year: 2026, month: 10 }, { withZone: false })?.from).toBe('2026-10-01T05:00:00');
  });

  it('sin año no hay periodo', () => {
    expect(periodRange({ year: null, month: 3 })).toBeNull();
  });
});

describe('periodDates', () => {
  it('fechas de calendario del mes y del año', () => {
    expect(periodDates({ year: 2026, month: 9 })).toEqual({ from: '2026-09-01', to: '2026-10-01' });
    expect(periodDates({ year: 2026, month: 12 })).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(periodDates({ year: 2026, month: null })).toEqual({ from: '2026-01-01', to: '2027-01-01' });
  });
});

describe('sanitizeSearch', () => {
  it('quita lo que rompería un .or() de PostgREST', () => {
    expect(sanitizeSearch('ana,email.eq.x)*%')).toBe('ana email.eq.x');
  });
});
