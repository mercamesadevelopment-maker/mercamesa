'use client';

import { useCallback, useEffect, useState } from 'react';
import { pqrsService, type PqrsResolveInput } from '../services/pqrs.service';
import type { PqrsDetail } from '@/lib/pqrs/types';

/**
 * Un caso y lo que se le puede hacer.
 *
 * Cada acción devuelve el caso como quedó, así que no hay que volver a pedirlo.
 * `onChanged` le avisa al listado, que muestra el estado.
 */
export function usePqrsDetail(id: string | null, onChanged?: () => void) {
  const [detail, setDetail] = useState<PqrsDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setActionError(null);
    if (!id) return;

    let vigente = true;
    setLoading(true);
    pqrsService
      .detail(id)
      .then((d) => vigente && setDetail(d))
      .catch((e: unknown) => vigente && setError(e instanceof Error ? e.message : 'No se pudo cargar el caso.'))
      .finally(() => vigente && setLoading(false));

    return () => {
      vigente = false;
    };
  }, [id]);

  /** Corre una acción y deja el caso actualizado. Devuelve si salió bien. */
  const run = useCallback(
    async (accion: () => Promise<PqrsDetail>): Promise<boolean> => {
      try {
        setWorking(true);
        setActionError(null);
        setDetail(await accion());
        onChanged?.();
        return true;
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : 'No pudimos completar la operación.');
        return false;
      } finally {
        setWorking(false);
      }
    },
    [onChanged]
  );

  const sendMessage = useCallback(
    (body: string, photos: File[], isInternal: boolean) =>
      run(async () => {
        const attachments = await pqrsService.uploadPhotos(photos);
        return pqrsService.sendMessage(id!, { body, isInternal, attachments });
      }),
    [id, run]
  );

  const respondAsStore = useCallback(
    (decision: 'accept' | 'reject', notes: string) =>
      run(() => pqrsService.respondAsStore(id!, { decision, notes })),
    [id, run]
  );

  const resolve = useCallback(
    (input: PqrsResolveInput) => run(() => pqrsService.resolve(id!, input)),
    [id, run]
  );

  const liftBlock = useCallback(
    (notes: string) => run(() => pqrsService.liftBlock(id!, { notes })),
    [id, run]
  );

  const refundAction = useCallback(
    (action: 'to_money' | 'mark_paid' | 'void_store_charge', notes?: string) =>
      run(() => pqrsService.refundAction(id!, { action, notes })),
    [id, run]
  );

  return {
    detail,
    loading,
    error,
    working,
    actionError,
    sendMessage,
    respondAsStore,
    resolve,
    liftBlock,
    refundAction,
  };
}
