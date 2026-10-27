import { describe, expect, it } from 'vitest';
import { closesAt, inactiveBefore, nextStep, storesLeftWithoutOwner } from './inactivity';

const now = new Date('2027-10-27T14:00:00Z');
const dias = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe('nextStep', () => {
  it('sin aviso: nada si la usó en el último año, avisar si no', () => {
    expect(nextStep({ lastActivity: dias(300), notice: null, now })).toBe('none');
    expect(nextStep({ lastActivity: dias(366), notice: null, now })).toBe('notify');
  });

  it('justo al año todavía no se avisa', () => {
    expect(nextStep({ lastActivity: inactiveBefore(now), notice: null, now })).toBe('none');
  });

  it('con aviso: esperar las dos semanas y después cerrar', () => {
    const notice = { notifiedAt: dias(10), closesAt: closesAt(dias(10)) };
    expect(nextStep({ lastActivity: dias(400), notice, now })).toBe('wait');
    const vencido = { notifiedAt: dias(14), closesAt: closesAt(dias(14)) };
    expect(nextStep({ lastActivity: dias(400), notice: vencido, now })).toBe('close');
  });

  it('si volvió después del aviso, se cancela, aunque ya estuviera vencido', () => {
    const vencido = { notifiedAt: dias(20), closesAt: closesAt(dias(20)) };
    expect(nextStep({ lastActivity: dias(3), notice: vencido, now })).toBe('cancel');
    // El mismo día del aviso, pero después.
    const hoy = { notifiedAt: dias(1), closesAt: closesAt(dias(1)) };
    expect(nextStep({ lastActivity: new Date(dias(1).getTime() + 60_000), notice: hoy, now })).toBe('cancel');
  });
});

describe('storesLeftWithoutOwner', () => {
  const m = (storeId: string, userId: string, isOwner: boolean) => ({ storeId, userId, isOwner });

  it('el único dueño deja la tienda sin dueño', () => {
    expect(storesLeftWithoutOwner([m('A', 'ana', true), m('A', 'beto', false)], 'ana')).toEqual(['A']);
  });

  it('con otro dueño, la tienda sigue', () => {
    expect(storesLeftWithoutOwner([m('A', 'ana', true), m('A', 'beto', true)], 'ana')).toEqual([]);
  });

  it('un vendedor que no es dueño no deja ninguna tienda sin dueño', () => {
    expect(storesLeftWithoutOwner([m('A', 'ana', true), m('A', 'beto', false)], 'beto')).toEqual([]);
  });

  it('varias tiendas: solo las que eran solo suyas', () => {
    const memberships = [m('A', 'ana', true), m('B', 'ana', true), m('B', 'carla', true)];
    expect(storesLeftWithoutOwner(memberships, 'ana')).toEqual(['A']);
  });
});
