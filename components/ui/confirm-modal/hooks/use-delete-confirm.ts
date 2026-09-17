'use client';

import { useState } from 'react';

/**
 * Estado del borrado con confirmación: a quién se va a borrar, si está en curso
 * y qué motivo devolvió el servidor si se negó.
 *
 * Existe porque el mismo ciclo —preguntar, borrar, explicar el rechazo— estaba
 * repetido en todas las pestañas de Parametrización, y antes resuelto con
 * `confirm()` y `alert()` del navegador. La parte visual sigue en cada pestaña
 * (los textos cambian por entidad); lo que se comparte es la mecánica.
 *
 * @example
 * const borrado = useDeleteConfirm<CategoryRow>((c) => deleteCategory(c.id));
 * <button onClick={() => borrado.ask(item)} />
 * <ConfirmModal isOpen={!!borrado.target} onConfirm={borrado.confirm} ... />
 */
export function useDeleteConfirm<T>(onDelete: (item: T) => Promise<void>) {
  const [target, setTarget] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirm = async () => {
    if (!target) return;
    setIsDeleting(true);
    try {
      await onDelete(target);
      setTarget(null);
    } catch (err: unknown) {
      // El servidor es el que manda: puede rechazar el borrado aunque la tabla
      // mostrara cero dependencias, si alguien creó una mientras tanto.
      setTarget(null);
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    /** Fila pendiente de confirmación, o `null`. */
    target,
    /** Abre la confirmación para una fila. */
    ask: setTarget,
    /** Cierra la confirmación sin borrar. */
    cancel: () => setTarget(null),
    confirm,
    isDeleting,
    /** Motivo del rechazo, para el modal de aviso. */
    error,
    dismissError: () => setError(null),
  };
}
