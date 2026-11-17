import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Product } from '@/features/products/types/product.types';
import { parsePastedCells } from '@/lib/utils/pasted-cells';
import {
  buildPriceBatch,
  changedFields,
  countPriceErrors,
  draftFromValues,
  PRICE_FIELDS,
  priceValueFromPaste,
  type PriceDraft,
  type PriceErrors,
  type PriceField,
  type PriceValues,
} from '@/lib/store-products/price-grid';

function valuesOf(p: Product): PriceValues {
  return {
    price: p.retailPrice,
    wsPrice: p.wholesalePrice ?? null,
    wsMin: p.wholesaleMinQty ?? null,
    stock: p.stock,
    isActive: p.status === 'active',
  };
}

/** Une los errores de las reglas, de lo pegado y del servidor, celda por celda. */
function unirErrores(...fuentes: PriceErrors[]): PriceErrors {
  const out: PriceErrors = {};
  for (const fuente of fuentes) {
    for (const [key, porCampo] of Object.entries(fuente)) out[key] = { ...out[key], ...porCampo };
  }
  return out;
}

async function savePriceBatchService(rows: unknown[]) {
  const res = await fetch('/api/store-products/batch', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json: json as { error?: string; saved?: string[]; errors?: PriceErrors } };
}

/**
 * La tabla de productos del tendero mientras se edita: lo guardado, lo editado,
 * qué cambió, qué está mal, pegar desde Excel y guardar todo junto.
 *
 * Trabaja sobre todos los productos, no solo los filtrados: un cambio no se
 * pierde porque un filtro oculte su fila.
 */
export function useProductsGrid(products: Product[], reload: () => Promise<void>) {
  const actuales = useMemo(() => new Map(products.map((p) => [String(p.id), valuesOf(p)])), [products]);
  const originales = useMemo(
    () => new Map(products.map((p) => [String(p.id), draftFromValues(String(p.id), valuesOf(p))])),
    [products]
  );

  // Solo las filas tocadas; las demás se leen de `originales`.
  const [editadas, setEditadas] = useState<Record<string, PriceDraft>>({});
  const [erroresPegado, setErroresPegado] = useState<PriceErrors>({});
  const [erroresServidor, setErroresServidor] = useState<PriceErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Al recargar (después de guardar), lo que ya quedó deja de verse como cambio.
  useEffect(() => {
    setEditadas((prev) => {
      const quedan: Record<string, PriceDraft> = {};
      for (const [id, d] of Object.entries(prev)) {
        if (changedFields(originales.get(id), d).length > 0) quedan[id] = d;
      }
      return quedan;
    });
  }, [originales]);

  const draftOf = useCallback(
    (id: string): PriceDraft | undefined => editadas[id] ?? originales.get(id),
    [editadas, originales]
  );

  const limpiarErrorDe = (id: string, field: PriceField) => {
    const quitar = (prev: PriceErrors) => {
      if (!prev[id]?.[field]) return prev;
      const { [field]: _, ...resto } = prev[id];
      return { ...prev, [id]: resto };
    };
    setErroresPegado(quitar);
    setErroresServidor(quitar);
  };

  const updateCell = (id: string, field: PriceField, value: string | boolean) => {
    const actual = draftOf(id);
    if (!actual) return;
    // Lo escrito se normaliza igual que lo pegado («5.500» queda «5500»); lo que
    // no se entiende se deja tal cual, y la validación lo marca.
    const r = typeof value === 'string' ? priceValueFromPaste(field, value) : null;
    const valor = r && 'value' in r ? r.value : value;
    setEditadas((prev) => ({ ...prev, [id]: { ...actual, ...prev[id], [field]: valor } }));
    limpiarErrorDe(id, field);
    setSavedCount(null);
  };

  /** Reparte lo pegado desde la celda hacia la derecha y hacia abajo, en el orden visible. */
  const paste = (visibleIds: string[], id: string, field: PriceField, texto: string) => {
    const filaInicial = visibleIds.indexOf(id);
    const colInicial = PRICE_FIELDS.indexOf(field);
    if (filaInicial < 0 || colInicial < 0) return;

    const nuevas: Record<string, PriceDraft> = {};
    const nuevosErrores: PriceErrors = {};
    parsePastedCells(texto).forEach((celdas, i) => {
      const destino = visibleIds[filaInicial + i];
      if (!destino) return; // Esta tabla no crea productos: lo que sobra abajo se ignora.
      let fila = nuevas[destino] ?? draftOf(destino);
      if (!fila) return;
      celdas.forEach((t, j) => {
        const campo = PRICE_FIELDS[colInicial + j];
        if (!campo) return;
        const r = priceValueFromPaste(campo, t);
        if ('error' in r) (nuevosErrores[destino] ??= {})[campo] = r.error;
        else fila = { ...fila!, [campo]: r.value };
      });
      nuevas[destino] = fila;
    });

    setEditadas((prev) => ({ ...prev, ...nuevas }));
    setErroresPegado((prev) => unirErrores(prev, nuevosErrores));
    setSavedCount(null);
  };

  const discard = () => {
    setEditadas({});
    setErroresPegado({});
    setErroresServidor({});
    setSaveError(null);
  };

  const lote = useMemo(
    () => buildPriceBatch(originales, Object.values(editadas), actuales),
    [originales, editadas, actuales]
  );
  const errores = useMemo(
    () => unirErrores(lote.errors, erroresPegado, erroresServidor),
    [lote.errors, erroresPegado, erroresServidor]
  );
  const errorCount = countPriceErrors(errores);
  const changedCount = lote.rows.length;

  const isChanged = (id: string, field: string) => {
    const d = editadas[id];
    return d ? changedFields(originales.get(id), d).includes(field as PriceField) : false;
  };

  const save = async () => {
    if (changedCount === 0 || errorCount > 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { ok, json } = await savePriceBatchService(lote.rows);
      if (json.errors) setErroresServidor(json.errors);
      if (!ok) {
        setSaveError(json.error || 'No se pudieron guardar los cambios.');
        return;
      }
      const fallidos = Object.keys(json.errors ?? {}).length;
      if (fallidos > 0) setSaveError(`${fallidos} producto(s) no se pudieron guardar; quedaron marcados.`);
      const guardados = new Set(json.saved ?? []);
      setEditadas((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !guardados.has(id))));
      setSavedCount(guardados.size);
      await reload();
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
    discard,
    save,
    saving,
    saveError,
    savedCount,
    clearSaveError: () => setSaveError(null),
  };
}
