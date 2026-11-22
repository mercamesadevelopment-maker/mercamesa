'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parsePastedCells } from '@/lib/utils/pasted-cells';
import type { GridErrors, GridValue } from '../types';

/** Lo que entiende una celda: el valor a guardar en el borrador, o el error. */
export type CellParse = { ok: true; value: GridValue } | { ok: false; error: string };

export interface SaveResult {
  ok: boolean;
  /** Ids guardados. */
  saved?: string[];
  /** Errores por fila y campo que devolvió el servidor. */
  errors?: GridErrors;
  error?: string;
}

export interface GridDraftsOptions<TDraft extends { id: string }, TRow> {
  /** Lo guardado, por id. */
  originals: Map<string, TDraft>;
  /** Los campos editables. */
  fields: readonly string[];
  /** Interpreta lo escrito o pegado en una celda. */
  parseCell: (field: string, texto: string) => CellParse;
  /** Los campos que difieren de lo guardado. */
  changedFields: (original: TDraft | undefined, draft: TDraft) => string[];
  /** Las filas a guardar y los errores de las reglas. */
  build: (editadas: TDraft[]) => { rows: TRow[]; errors: GridErrors };
  save: (rows: TRow[]) => Promise<SaveResult>;
  reload: () => Promise<void>;
}

function unirErrores(...fuentes: GridErrors[]): GridErrors {
  const out: GridErrors = {};
  for (const fuente of fuentes) {
    for (const [key, porCampo] of Object.entries(fuente)) out[key] = { ...out[key], ...porCampo };
  }
  return out;
}

/**
 * El estado de una tabla tipo Excel que edita filas que ya existen: lo
 * guardado, lo editado, qué cambió, qué está mal, pegar desde Excel y guardar
 * todo junto. Las reglas (qué es válido, cómo se lee una celda, cómo se guarda)
 * las pone quien la usa.
 *
 * Solo guarda las filas tocadas, por id: un cambio no se pierde porque un
 * filtro o la página oculten su fila.
 */
export function useGridDrafts<TDraft extends { id: string }, TRow>(o: GridDraftsOptions<TDraft, TRow>) {
  const { originals } = o;
  const [editadas, setEditadas] = useState<Record<string, TDraft>>({});
  const [erroresPegado, setErroresPegado] = useState<GridErrors>({});
  const [erroresServidor, setErroresServidor] = useState<GridErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Al recargar, lo que ya quedó guardado deja de verse como cambio.
  useEffect(() => {
    setEditadas((prev) => {
      const quedan: Record<string, TDraft> = {};
      for (const [id, d] of Object.entries(prev)) {
        if (!originals.has(id) || o.changedFields(originals.get(id), d).length > 0) quedan[id] = d;
      }
      return quedan;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originals]);

  const draftOf = useCallback((id: string): TDraft | undefined => editadas[id] ?? originals.get(id), [editadas, originals]);

  const limpiarErrorDe = (id: string, field: string) => {
    const quitar = (prev: GridErrors) => {
      if (!prev[id]?.[field]) return prev;
      const { [field]: _, ...resto } = prev[id];
      return { ...prev, [id]: resto };
    };
    setErroresPegado(quitar);
    setErroresServidor(quitar);
  };

  const updateCell = (id: string, field: string, value: GridValue) => {
    const actual = draftOf(id);
    if (!actual || !o.fields.includes(field)) return;
    // Lo escrito se normaliza igual que lo pegado («5.500» queda «5500»); lo que
    // no se entiende se deja tal cual, y la validación lo marca.
    const r = typeof value === 'string' ? o.parseCell(field, value) : null;
    const valor = r && r.ok ? r.value : value;
    setEditadas((prev) => ({ ...prev, [id]: { ...actual, ...prev[id], [field]: valor } }));
    limpiarErrorDe(id, field);
    setSavedCount(null);
  };

  /**
   * Reparte lo pegado desde la celda hacia la derecha y hacia abajo. `columnas`
   * son las llaves de las columnas en el orden en que se ven: las de solo
   * lectura se saltan, así se puede pegar desde un Excel con el mismo orden.
   */
  const paste = (visibleIds: string[], id: string, columna: string, texto: string, columnas: string[]) => {
    const filaInicial = visibleIds.indexOf(id);
    const colInicial = columnas.indexOf(columna);
    if (filaInicial < 0 || colInicial < 0) return;

    const nuevas: Record<string, TDraft> = {};
    const nuevosErrores: GridErrors = {};
    // Las celdas que esta vez se pegaron bien: su error anterior ya no aplica.
    const corregidas: [string, string][] = [];
    parsePastedCells(texto).forEach((celdas, i) => {
      const destino = visibleIds[filaInicial + i];
      if (!destino) return; // No crea filas: lo que sobra abajo se ignora.
      let fila = nuevas[destino] ?? draftOf(destino);
      if (!fila) return;
      celdas.forEach((t, j) => {
        const campo = columnas[colInicial + j];
        if (!campo || !o.fields.includes(campo)) return;
        const r = o.parseCell(campo, t);
        if ('error' in r) (nuevosErrores[destino] ??= {})[campo] = r.error;
        else {
          fila = { ...fila!, [campo]: r.value };
          corregidas.push([destino, campo]);
        }
      });
      nuevas[destino] = fila;
    });

    setEditadas((prev) => ({ ...prev, ...nuevas }));
    corregidas.forEach(([fila, campo]) => limpiarErrorDe(fila, campo));
    setErroresPegado((prev) => unirErrores(prev, nuevosErrores));
    setSavedCount(null);
  };

  /**
   * Vuelca en la tabla valores ya leídos (de un archivo importado, por ejemplo):
   * quedan como cambios sin guardar, igual que lo pegado, y los que no se
   * pudieron leer quedan como error de su celda.
   */
  const applyCells = (
    cambios: { id: string; field: string; value: GridValue }[],
    errores: { id: string; field: string; error: string }[] = []
  ) => {
    const nuevas: Record<string, TDraft> = {};
    for (const c of cambios) {
      if (!o.fields.includes(c.field)) continue;
      const fila = nuevas[c.id] ?? draftOf(c.id);
      if (fila) nuevas[c.id] = { ...fila, [c.field]: c.value };
    }
    const nuevosErrores: GridErrors = {};
    for (const e of errores) if (originals.has(e.id)) (nuevosErrores[e.id] ??= {})[e.field] = e.error;

    setEditadas((prev) => ({ ...prev, ...nuevas }));
    cambios.forEach((c) => limpiarErrorDe(c.id, c.field));
    setErroresPegado((prev) => unirErrores(prev, nuevosErrores));
    setSavedCount(null);
  };

  const discard = () => {
    setEditadas({});
    setErroresPegado({});
    setErroresServidor({});
    setSaveError(null);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lote = useMemo(() => o.build(Object.values(editadas)), [editadas, originals]);
  const errores = useMemo(
    () => unirErrores(lote.errors, erroresPegado, erroresServidor),
    [lote.errors, erroresPegado, erroresServidor]
  );
  const errorCount = Object.values(errores).reduce((n, c) => n + Object.keys(c).length, 0);
  const changedCount = lote.rows.length;

  const isChanged = (id: string, field: string) => {
    const d = editadas[id];
    return d ? o.changedFields(originals.get(id), d).includes(field) : false;
  };

  const save = async () => {
    if (changedCount === 0 || errorCount > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const r = await o.save(lote.rows);
      if (r.errors) setErroresServidor(r.errors);
      if (!r.ok) {
        setSaveError(r.error || 'No se pudieron guardar los cambios.');
        return;
      }
      const fallidos = Object.keys(r.errors ?? {}).length;
      if (fallidos > 0) setSaveError(`${fallidos} fila(s) no se pudieron guardar; quedaron marcadas.`);
      const guardados = new Set(r.saved ?? []);
      setEditadas((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !guardados.has(id))) as Record<string, TDraft>);
      setSavedCount(guardados.size);
      await o.reload();
    } catch {
      setSaveError('No se pudo conectar para guardar. Revisa tu conexión e intenta de nuevo.');
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
    draftOf,
    errores,
    errorCount,
    changedCount,
    isChanged,
    updateCell,
    paste,
    applyCells,
    discard,
    save,
    saving,
    saveError,
    savedCount,
    clearSaveError: () => setSaveError(null),
  };
}

export type GridDrafts = ReturnType<typeof useGridDrafts>;

/** Llama a una ruta `PATCH` de guardado en lote con `{ rows }` y lee la respuesta. */
export async function patchBatch(url: string, rows: unknown[]): Promise<SaveResult> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; saved?: string[]; errors?: GridErrors };
  return { ok: res.ok, saved: json.saved, errors: json.errors, error: json.error };
}
