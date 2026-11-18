import { describe, expect, it } from 'vitest';
import {
  buildMasterBatch,
  changedMasterFields,
  draftFromMaster,
  masterRowFromDraft,
  masterValueFromPaste,
  parseMasterBatchBody,
  type MasterOptions,
  type MasterValues,
  isMasterSortField,
  masterSortField,
} from './master-grid';

const v: MasterValues = {
  name: 'Arroz Diana 500 g',
  categoryId: 'c-granos',
  unitId: 'u-und',
  ivaRate: 0,
  groupId: null,
  isActive: true,
  description: 'Arroz blanco',
};
const original = draftFromMaster('p1', v);

const opts: MasterOptions = {
  categories: [
    { id: 'c-granos', name: 'Arroz, pastas y legumbres', label: 'Granos y despensa › Arroz, pastas y legumbres' },
    { id: 'c-ff', name: 'Frutas frescas', label: 'Frutas y verduras › Frutas frescas' },
    { id: 'c-ff2', name: 'Frutas frescas', label: 'Mercado › Frutas frescas' },
  ],
  units: [
    { id: 'u-und', name: 'Unidad', abbreviation: 'und' },
    { id: 'u-kg', name: 'Kilogramo', abbreviation: 'kg' },
  ],
  groups: [{ id: 'g-1', name: 'Decorarte' }],
};

describe('changedMasterFields', () => {
  it('lo guardado no es cambio; lo tocado sí', () => {
    expect(changedMasterFields(original, { ...original })).toEqual([]);
    expect(changedMasterFields(original, { ...original, iva: '0.19', isActive: false })).toEqual(['iva', 'isActive']);
  });
});

describe('masterRowFromDraft', () => {
  it('manda solo lo cambiado', () => {
    const r = masterRowFromDraft(original, { ...original, name: ' Arroz Diana 1 kg ', unit: 'u-kg', group: 'g-1' });
    expect(r.errors).toEqual({});
    expect(r.row).toEqual({ id: 'p1', name: 'Arroz Diana 1 kg', default_unit_id: 'u-kg', owner_group_id: 'g-1' });
  });

  it('volver público manda null, y una descripción vacía también', () => {
    const o = draftFromMaster('p2', { ...v, groupId: 'g-1' });
    expect(masterRowFromDraft(o, { ...o, group: '', description: '  ' }).row).toEqual({
      id: 'p2',
      owner_group_id: null,
      description: null,
    });
  });

  it('nombre vacío, categoría vacía o IVA raro son errores', () => {
    const r = masterRowFromDraft(original, { ...original, name: ' ', category: '', iva: '12' });
    expect(Object.keys(r.errors).sort()).toEqual(['category', 'iva', 'name']);
  });
});

describe('masterValueFromPaste', () => {
  it('categoría por «Madre › Sub», con > o sin tildes, o por la sub si es única', () => {
    expect(masterValueFromPaste('category', 'Granos y despensa > Arroz, pastas y legumbres', opts)).toEqual({ ok: true, value: 'c-granos' });
    expect(masterValueFromPaste('category', 'arroz, pastas y legumbres', opts)).toEqual({ ok: true, value: 'c-granos' });
    expect(masterValueFromPaste('category', 'Frutas y verduras › Frutas frescas', opts)).toEqual({ ok: true, value: 'c-ff' });
  });

  it('una sub repetida pide la madre; una inexistente es error', () => {
    expect(masterValueFromPaste('category', 'Frutas frescas', opts).ok).toBe(false);
    expect(masterValueFromPaste('category', 'Juguetes', opts).ok).toBe(false);
  });

  it('unidad, IVA, grupo y activo', () => {
    expect(masterValueFromPaste('unit', 'KG', opts)).toEqual({ ok: true, value: 'u-kg' });
    expect(masterValueFromPaste('iva', '19%', opts)).toEqual({ ok: true, value: '0.19' });
    expect(masterValueFromPaste('iva', '12', opts).ok).toBe(false);
    expect(masterValueFromPaste('group', 'Público', opts)).toEqual({ ok: true, value: '' });
    expect(masterValueFromPaste('group', 'decorarte', opts)).toEqual({ ok: true, value: 'g-1' });
    expect(masterValueFromPaste('isActive', 'no', opts)).toEqual({ ok: true, value: false });
  });
});

describe('buildMasterBatch y parseMasterBatchBody', () => {
  it('junta lo cambiado con sus errores', () => {
    const o2 = draftFromMaster('p2', v);
    const r = buildMasterBatch(new Map([['p1', original], ['p2', o2]]), [{ ...original, iva: '0.05' }, { ...o2, name: '' }]);
    expect(r.rows.map((x) => x.id)).toEqual(['p1', 'p2']);
    expect(r.errors.p2.name).toBeDefined();
  });

  it('el cuerpo se lee sin confiar en él', () => {
    expect(parseMasterBatchBody({ rows: [{ id: 'a', iva_rate: 0.19, owner_group_id: null }] })).toEqual({
      rows: [{ id: 'a', iva_rate: 0.19, owner_group_id: null }],
    });
    expect('error' in parseMasterBatchBody({ rows: [{ id: 'a', iva_rate: '19' }] })).toBe(true);
    expect('error' in parseMasterBatchBody({ rows: [] })).toBe(true);
  });
});

describe('orden del catálogo maestro', () => {
  it('cada columna ordenable va a su campo; categoría y unidad no', () => {
    expect(masterSortField('code')).toBe('siigo_id');
    expect(masterSortField('iva')).toBe('iva_rate');
    expect(masterSortField('category')).toBeNull();
    expect(masterSortField('unit')).toBeNull();
    expect(masterSortField('toString')).toBeNull();
    expect(masterSortField(null)).toBeNull();
  });

  it('el servidor solo acepta esos campos', () => {
    expect(isMasterSortField('siigo_id')).toBe(true);
    expect(isMasterSortField('name')).toBe(true);
    expect(isMasterSortField('created_by')).toBe(false);
    expect(isMasterSortField(null)).toBe(false);
  });
});
