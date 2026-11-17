import { describe, expect, it } from 'vitest';
import { phoneticKey } from './phonetic';
import { PHONETIC_CASES } from './phonetic.cases';
import { editDistance, fuzzyFilter, matchScore } from './fuzzy';

describe('phoneticKey', () => {
  it.each(PHONETIC_CASES)('%s → %s', (texto, clave) => {
    expect(phoneticKey(texto)).toBe(clave);
  });
});

describe('editDistance', () => {
  it('cuenta la trasposición como un solo error', () => {
    expect(editDistance('agua', 'auga')).toBe(1);
    expect(editDistance('aguacte', 'aguacate')).toBe(1);
    expect(editDistance('casa', 'perro', 1)).toBeGreaterThan(1);
  });
});

const productos = [
  'Vino tinto Gato Negro',
  'Agua Cristal 600 ml',
  'Arroz Diana 500 g',
  'Aguacate Hass',
  'Papa criolla',
  'Arepa de papa',
  'Pan tajado',
  'Ponqué Ramo',
];
const buscar = (q: string) => fuzzyFilter(productos, q, (p) => p);

describe('fuzzyFilter: lo que pidió el cliente', () => {
  it('bino → vino, hagua → agua, aros → arroz', () => {
    expect(buscar('bino')[0]).toBe('Vino tinto Gato Negro');
    expect(buscar('hagua')[0]).toBe('Agua Cristal 600 ml');
    expect(buscar('aros')[0]).toBe('Arroz Diana 500 g');
  });

  it('un error de tecleo también encuentra', () => {
    expect(buscar('aguacte')).toContain('Aguacate Hass');
  });

  it('varias palabras: todas tienen que estar', () => {
    expect(buscar('aros diana')).toEqual(['Arroz Diana 500 g']);
    expect(buscar('arroz roa')).toEqual([]);
  });

  it('lo exacto va antes, y lo que empieza igual antes que lo que lo contiene', () => {
    expect(buscar('papa')).toEqual(['Papa criolla', 'Arepa de papa']);
  });

  it('las palabras cortas no se toleran: «pan» no trae «pon»', () => {
    expect(buscar('pan')).toEqual(['Pan tajado']);
  });

  it('sin consulta, todo igual', () => {
    expect(buscar('  ')).toEqual(productos);
  });

  it('también sirve para otras cosas: varios campos por elemento', () => {
    const usuarios = [{ nombre: 'Jéssica Gómez', correo: 'jgomez@x.co' }, { nombre: 'Óscar Vélez', correo: 'ov@x.co' }];
    expect(fuzzyFilter(usuarios, 'yesica', (u) => [u.nombre, u.correo])).toEqual([]);
    expect(fuzzyFilter(usuarios, 'jesica gomes', (u) => [u.nombre, u.correo])[0].nombre).toBe('Jéssica Gómez');
    expect(fuzzyFilter(usuarios, 'belez', (u) => [u.nombre, u.correo])[0].nombre).toBe('Óscar Vélez');
  });

  it('matchScore es 0 cuando no coincide', () => {
    expect(matchScore('cerveza', 'Vino tinto')).toBe(0);
  });
});
