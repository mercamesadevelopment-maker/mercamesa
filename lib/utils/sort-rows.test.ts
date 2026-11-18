import { describe, expect, it } from 'vitest';
import { nextSort, sortRows } from './sort-rows';

describe('sortRows', () => {
  const filas = [
    { n: 'Ñame', p: 3000 },
    { n: 'arroz', p: null },
    { n: 'Árbol 10', p: 500 },
    { n: 'Árbol 2', p: 500 },
    { n: '', p: 1200 },
  ];

  it('textos en español, sin importar tildes ni mayúsculas, con números naturales', () => {
    expect(sortRows(filas, (f) => f.n, 'asc').map((f) => f.n)).toEqual(['Árbol 2', 'Árbol 10', 'arroz', 'Ñame', '']);
  });

  it('números como números, vacíos al final en las dos direcciones, y estable', () => {
    expect(sortRows(filas, (f) => f.p, 'asc').map((f) => f.n)).toEqual(['Árbol 10', 'Árbol 2', '', 'Ñame', 'arroz']);
    expect(sortRows(filas, (f) => f.p, 'desc').map((f) => f.n)).toEqual(['Ñame', '', 'Árbol 10', 'Árbol 2', 'arroz']);
  });

  it('no cambia el arreglo original', () => {
    const copia = [...filas];
    sortRows(filas, (f) => f.n, 'desc');
    expect(filas).toEqual(copia);
  });

  it('booleanos: falso antes que verdadero', () => {
    expect(sortRows([{ a: true }, { a: false }], (f) => f.a, 'asc')).toEqual([{ a: false }, { a: true }]);
  });
});

describe('nextSort', () => {
  it('ascendente, descendente y sin orden; otra columna empieza en ascendente', () => {
    const a = nextSort({ key: null, order: 'asc' }, 'precio');
    expect(a).toEqual({ key: 'precio', order: 'asc' });
    const b = nextSort(a, 'precio');
    expect(b).toEqual({ key: 'precio', order: 'desc' });
    expect(nextSort(b, 'precio')).toEqual({ key: null, order: 'asc' });
    expect(nextSort(b, 'stock')).toEqual({ key: 'stock', order: 'asc' });
  });
});
