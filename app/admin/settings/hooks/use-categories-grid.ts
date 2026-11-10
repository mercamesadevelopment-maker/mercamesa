import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCategoryBatch,
  CATEGORY_FIELDS,
  changedFields,
  countErrors,
  draftFromCategory,
  emptyDraft,
  isNewKey,
  newCategoryKey,
  parsePastedCells,
  validateCategories,
  valueFromPaste,
  type CategoryDraft,
  type CategoryErrors,
  type CategoryField,
} from '@/lib/categories/batch';
import type { CategoryRow } from '../types/settings.types';
import { CategoryBatchError, saveCategoriesBatchService } from '../services/settings.service';

/** Une los errores de las reglas, de lo pegado y del servidor, celda por celda. */
function unirErrores(...fuentes: CategoryErrors[]): CategoryErrors {
  const out: CategoryErrors = {};
  for (const fuente of fuentes) {
    for (const [key, porCampo] of Object.entries(fuente)) out[key] = { ...out[key], ...porCampo };
  }
  return out;
}

/**
 * El estado de la tabla de categorías mientras se edita: lo guardado, lo
 * editado, qué cambió, qué está mal, y guardar todo junto.
 */
export function useCategoriesGrid(categories: CategoryRow[], reload: () => Promise<void>) {
  const originales = useMemo(() => categories.map(draftFromCategory), [categories]);
  const originalesPorKey = useMemo(() => new Map(originales.map((o) => [o.key, o])), [originales]);

  const [drafts, setDrafts] = useState<CategoryDraft[]>(originales);
  // Lo pegado que no se pudo interpretar, y lo que rechazó el servidor.
  const [erroresPegado, setErroresPegado] = useState<CategoryErrors>({});
  const [erroresServidor, setErroresServidor] = useState<CategoryErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const contador = useRef(0);

  // Al cargar o recargar (después de guardar), la tabla vuelve a lo guardado.
  useEffect(() => {
    setDrafts(originales);
    setErroresPegado({});
    setErroresServidor({});
  }, [originales]);

  const nuevaKey = () => newCategoryKey(++contador.current);

  const limpiarErrorDe = (key: string, field: CategoryField) => {
    const quitar = (prev: CategoryErrors) => {
      if (!prev[key]?.[field]) return prev;
      const { [field]: _, ...resto } = prev[key];
      return { ...prev, [key]: resto };
    };
    setErroresPegado(quitar);
    setErroresServidor(quitar);
  };

  const updateCell = useCallback((key: string, field: CategoryField, value: string | boolean) => {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)));
    limpiarErrorDe(key, field);
  }, []);

  /**
   * Reparte lo pegado desde la celda (`key`, `field`) hacia la derecha y hacia
   * abajo, en el orden en que se ven las filas. Lo que sobra abajo, filas nuevas.
   */
  const paste = (visibleKeys: string[], key: string, field: CategoryField, texto: string) => {
    const matriz = parsePastedCells(texto);
    const filaInicial = visibleKeys.indexOf(key);
    const colInicial = CATEGORY_FIELDS.indexOf(field);
    if (filaInicial < 0 || colInicial < 0) return;

    const tabla = [...drafts];
    const nuevosErrores: CategoryErrors = {};

    matriz.forEach((celdas, i) => {
      let destino = visibleKeys[filaInicial + i];
      if (!destino) {
        const nueva = emptyDraft(nuevaKey());
        tabla.push(nueva);
        destino = nueva.key;
      }
      const idx = tabla.findIndex((d) => d.key === destino);

      celdas.forEach((texto, j) => {
        const campo = CATEGORY_FIELDS[colInicial + j];
        if (!campo) return;
        // Se interpreta contra la tabla como va quedando: una madre pegada en
        // una fila anterior ya sirve para las hijas de abajo.
        const r = valueFromPaste(campo, texto, tabla);
        if ('error' in r) (nuevosErrores[destino] ??= {})[campo] = r.error;
        else tabla[idx] = { ...tabla[idx], [campo]: r.value };
      });
    });

    setDrafts(tabla);
    setErroresPegado((prev) => unirErrores(prev, nuevosErrores));
  };

  const addRow = () => setDrafts((prev) => [...prev, emptyDraft(nuevaKey())]);
  const removeNewRow = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const discard = () => {
    setDrafts(originales);
    setErroresPegado({});
    setErroresServidor({});
    setSaveError(null);
  };

  const errores = useMemo(
    () => unirErrores(validateCategories(drafts, originales), erroresPegado, erroresServidor),
    [drafts, originales, erroresPegado, erroresServidor]
  );
  const errorCount = countErrors(errores);

  const changedCount = useMemo(
    () => drafts.filter((d) => changedFields(originalesPorKey.get(d.key), d).length > 0).length,
    [drafts, originalesPorKey]
  );

  const isChanged = (key: string, field: string) => {
    const d = drafts.find((x) => x.key === key);
    return d ? changedFields(originalesPorKey.get(key), d).includes(field as CategoryField) : false;
  };

  const save = async () => {
    if (changedCount === 0 || errorCount > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      // El slug lo pone el servidor: acá no hace falta conocer los usados.
      await saveCategoriesBatchService(buildCategoryBatch(originales, drafts, new Set()));
      await reload();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'No se pudieron guardar las categorías.');
      if (err instanceof CategoryBatchError && err.errors) setErroresServidor(err.errors);
    } finally {
      setSaving(false);
    }
  };

  // Salir de la página con cambios sin guardar pide confirmación.
  useEffect(() => {
    if (changedCount === 0) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [changedCount]);

  return {
    drafts,
    errores,
    errorCount,
    changedCount,
    isChanged,
    isNew: isNewKey,
    updateCell,
    paste,
    addRow,
    removeNewRow,
    discard,
    save,
    saving,
    saveError,
    clearSaveError: () => setSaveError(null),
  };
}
