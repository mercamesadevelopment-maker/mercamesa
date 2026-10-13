import { describe, expect, it } from 'vitest';
import { sanitizeAddress } from './sanitize-address';

const valida = {
  address_line: 'Calle 10 # 5-20',
  municipality: 'Bogotá',
  department: 'Cundinamarca',
  delivery_instructions: 'Torre 2, apartamento 301',
  latitude: 4.65,
  longitude: -74.05,
};

describe('sanitizeAddress', () => {
  it('acepta una dirección completa y descarta columnas que no son suyas', () => {
    const r = sanitizeAddress({ ...valida, buyer_id: 'otra-cuenta' });
    expect(r.error).toBeUndefined();
    expect(r.data).not.toHaveProperty('buyer_id');
    expect(r.data?.latitude).toBe(4.65);
  });

  it('exige indicaciones de entrega de al menos 10 caracteres', () => {
    expect(sanitizeAddress({ ...valida, delivery_instructions: 'casa' }).error).toMatch(/indicaciones/i);
    expect(sanitizeAddress({ ...valida, delivery_instructions: undefined }).error).toMatch(/indicaciones/i);
  });

  it('una coordenada vacía es "sin punto", no (0,0)', () => {
    expect(sanitizeAddress({ ...valida, latitude: '', longitude: '' }).error).toMatch(/mapa/);
  });

  it('rechaza un punto fuera de Colombia', () => {
    expect(sanitizeAddress({ ...valida, latitude: 0, longitude: 0 }).error).toMatch(/Colombia/);
  });

  it('rechaza un cuerpo que no es objeto', () => {
    expect(sanitizeAddress(null).error).toBeDefined();
  });
});
