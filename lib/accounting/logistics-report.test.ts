import { describe, expect, it } from 'vitest';
import { bogotaToday, buildLogisticsReport, elapsedDays, logisticsPeriod } from './logistics-report';

describe('bogotaToday', () => {
  it('a las 11:30 p. m. de Colombia sigue siendo ese día, aunque en UTC ya sea el siguiente', () => {
    expect(bogotaToday(new Date('2026-11-09T04:30:00Z'))).toBe('2026-11-08');
    expect(bogotaToday(new Date('2026-11-09T05:00:00Z'))).toBe('2026-11-09');
  });
});

describe('logisticsPeriod', () => {
  it('sin filtro de fecha es el mes en curso', () => {
    expect(logisticsPeriod({ year: null, month: null }, '2026-11-08')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
  });

  it('un mes del filtro', () => {
    expect(logisticsPeriod({ year: 2026, month: 12 }, '2026-11-08')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
  });

  it('un año entero', () => {
    expect(logisticsPeriod({ year: 2026, month: null }, '2026-11-08')).toEqual({ from: '2026-01-01', to: '2027-01-01' });
  });
});

describe('elapsedDays', () => {
  const nov = { from: '2026-11-01', to: '2026-12-01' };

  it('un mes en curso cuenta hasta hoy, incluido', () => {
    expect(elapsedDays(nov, '2026-11-08')).toBe(8);
    expect(elapsedDays(nov, '2026-11-01')).toBe(1);
  });

  it('un mes que ya pasó cuenta completo', () => {
    expect(elapsedDays(nov, '2026-12-15')).toBe(30);
    expect(elapsedDays(nov, '2026-11-30')).toBe(30);
  });

  it('un mes que no ha empezado no tiene días', () => {
    expect(elapsedDays(nov, '2026-10-31')).toBe(0);
  });
});

describe('buildLogisticsReport', () => {
  const plazas = [
    { id: 'sin', name: 'Plaza sin logística', is_active: true, logistics_enabled: false, runner_enabled: false },
    { id: 'con', name: 'Plaza con logística', is_active: true, logistics_enabled: true, runner_enabled: true },
  ];

  const reporte = buildLogisticsReport({
    period: { from: '2026-11-01', to: '2026-12-01' },
    today: '2026-11-04',
    marketplaces: plazas,
    staff: [{ marketplace_id: 'con' }, { marketplace_id: 'con' }],
    days: [
      { marketplaceId: 'con', day: '2026-11-01', services: 3, partsReceived: 7, partsDamaged: 1 },
      { marketplaceId: 'con', day: '2026-11-03', services: 2, partsReceived: 2, partsDamaged: 0 },
    ],
  });

  it('las plazas con logística van primero, con su personal', () => {
    expect(reporte.rows.map((r) => r.marketplaceId)).toEqual(['con', 'sin']);
    expect(reporte.rows[0].logisticsStaff).toBe(2);
    expect(reporte.rows[0].runnerEnabled).toBe(true);
  });

  it('suma el periodo y el detalle por día coincide con la suma', () => {
    const con = reporte.rows[0];
    expect(con.services).toBe(5);
    expect(con.partsReceived).toBe(9);
    expect(con.partsDamaged).toBe(1);
    expect(con.days.reduce((a, d) => a + d.services, 0)).toBe(con.services);
    expect(con.days.map((d) => d.day)).toEqual(['2026-11-03', '2026-11-01']);
  });

  it('el promedio es sobre los días corridos, con un decimal', () => {
    expect(reporte.elapsedDays).toBe(4);
    expect(reporte.rows[0].averagePerDay).toBe(1.3);
  });

  it('una plaza sin logística aparece en cero', () => {
    const sin = reporte.rows[1];
    expect(sin).toMatchObject({ logisticsEnabled: false, services: 0, partsReceived: 0, averagePerDay: 0, days: [] });
  });

  it('los totales', () => {
    expect(reporte.totals).toEqual({ services: 5, partsReceived: 9, partsDamaged: 1, marketplacesWithLogistics: 1 });
  });
});
