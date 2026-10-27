import { describe, expect, it } from 'vitest';
import { isStoreVerified } from './verification';

const doc = (document_type_id: string, status = 'approved') => ({ document_type_id, status });

describe('isStoreVerified', () => {
  it('con obligatorios: todos aprobados', () => {
    expect(isStoreVerified([doc('rut'), doc('cc')], ['rut', 'cc'])).toBe(true);
  });

  it('con obligatorios: falta uno o no está aprobado', () => {
    expect(isStoreVerified([doc('rut')], ['rut', 'cc'])).toBe(false);
    expect(isStoreVerified([doc('rut'), doc('cc', 'pending')], ['rut', 'cc'])).toBe(false);
  });

  it('con obligatorios: un opcional pendiente no la frena', () => {
    expect(isStoreVerified([doc('rut'), doc('banco', 'pending')], ['rut'])).toBe(true);
  });

  // El caso de producción (27 oct.): nadie quedó obligatorio y todas las
  // tiendas salían «Pendiente», sin poder invitar miembros.
  it('sin obligatorios: verificada si todo lo que subió está aprobado', () => {
    expect(isStoreVerified([doc('rut'), doc('cc'), doc('banco')], [])).toBe(true);
  });

  it('sin obligatorios: no, si algo está pendiente o rechazado, o no subió nada', () => {
    expect(isStoreVerified([doc('rut'), doc('cc', 'rejected')], [])).toBe(false);
    expect(isStoreVerified([doc('rut', 'pending')], [])).toBe(false);
    expect(isStoreVerified([], [])).toBe(false);
    expect(isStoreVerified(null, [])).toBe(false);
  });
});
