import { useEffect, useMemo, useState } from 'react';
import { patchBatch, useGridDrafts } from '@/components/ui/editable-grid/hooks/useGridDrafts';
import {
  buildMasterBatch,
  changedMasterFields,
  draftFromMaster,
  MASTER_FIELDS,
  masterValueFromPaste,
  type MasterBatchRow,
  type MasterDraft,
  type MasterField,
  type MasterOptions,
} from '@/lib/catalog/master-grid';
import type { Database } from '@/types/database_generated';

type CatalogRow = Database['public']['Tables']['catalog_products']['Row'];

function draftOf(p: CatalogRow): MasterDraft {
  return draftFromMaster(p.id, {
    name: p.name,
    categoryId: p.category_id,
    unitId: p.default_unit_id,
    ivaRate: Number(p.iva_rate ?? 0),
    groupId: p.owner_group_id,
    isActive: Boolean(p.is_active),
    description: p.description,
  });
}

/**
 * La tabla del catálogo maestro mientras se edita.
 *
 * El catálogo se pagina en el servidor: se recuerdan los originales de todas
 * las páginas vistas, para que un cambio hecho en la página 2 siga contando
 * (y guardándose) aunque ahora se vea la 3.
 */
export function useMasterGrid(products: CatalogRow[], opts: MasterOptions, reload: () => Promise<void>) {
  const [vistos, setVistos] = useState<Map<string, MasterDraft>>(new Map());

  useEffect(() => {
    if (products.length === 0) return;
    setVistos((prev) => {
      const next = new Map(prev);
      for (const p of products) next.set(p.id, draftOf(p));
      return next;
    });
  }, [products]);

  // La página actual siempre gana: es lo más reciente que dijo el servidor.
  const originals = useMemo(() => {
    const m = new Map(vistos);
    for (const p of products) m.set(p.id, draftOf(p));
    return m;
  }, [vistos, products]);

  return useGridDrafts<MasterDraft, MasterBatchRow>({
    originals,
    // La descripción no es columna de la tabla: se edita en «Editar».
    fields: MASTER_FIELDS.filter((f) => f !== 'description'),
    parseCell: (field, texto) => masterValueFromPaste(field as MasterField, texto, opts),
    changedFields: (o, d) => changedMasterFields(o, d),
    build: (editadas) => buildMasterBatch(originals, editadas),
    save: (rows) => patchBatch('/api/products/batch', rows),
    reload,
  });
}
