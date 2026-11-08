'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pqrsService } from '../services/pqrs.service';
import { MAX_PHOTOS, MIN_DESCRIPTION } from '@/lib/pqrs/rules';
import type { PqrsFormContext } from '@/lib/pqrs/types';

interface UsePqrsFormParams {
  isOpen: boolean;
  as: 'buyer' | 'seller';
  /** Tienda activa del tendero. */
  storeId?: string | null;
  /** Pedido con el que se abre el formulario, por cualquiera de sus dos ids. */
  initialOrderId?: string | null;
  initialStoreOrderId?: string | null;
  initialReason?: string | null;
  onCreated: (created: { id: string; code: string }) => void;
}

/**
 * El formulario de radicación.
 *
 * Lo que se puede elegir lo dice el servidor (`/api/pqrs/context`): los pedidos,
 * los productos del elegido y qué motivos le aplican. Cambiar de pedido vuelve a
 * preguntar, porque los motivos disponibles dependen de él.
 */
export function usePqrsForm({
  isOpen,
  as,
  storeId,
  initialOrderId,
  initialStoreOrderId,
  initialReason,
  onCreated,
}: UsePqrsFormParams) {
  const [context, setContext] = useState<PqrsFormContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [storeOrderId, setStoreOrderId] = useState<string | null>(null);
  const [reasonKey, setReasonKey] = useState('');
  const [description, setDescription] = useState('');
  /** Cantidad reclamada por línea del pedido. Ausente = no marcada. */
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [photos, setPhotos] = useState<File[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(
    async (params: { storeOrderId?: string | null; orderId?: string | null }) => {
      try {
        setLoading(true);
        setLoadError(null);
        const ctx = await pqrsService.formContext({ as, storeId, ...params });
        setContext(ctx);
        setStoreOrderId(ctx.order?.storeOrderId ?? null);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : 'No se pudo abrir el formulario.');
      } finally {
        setLoading(false);
      }
    },
    [as, storeId]
  );

  // Al abrir se parte de cero: un formulario a medias de otro pedido no debe
  // aparecer en este.
  useEffect(() => {
    if (!isOpen) return;
    setReasonKey(initialReason ?? '');
    setDescription('');
    setQuantities({});
    setPhotos([]);
    setSubmitError(null);
    load({ storeOrderId: initialStoreOrderId, orderId: initialOrderId });
  }, [isOpen, initialOrderId, initialStoreOrderId, initialReason, load]);

  const reason = useMemo(
    () => context?.reasons.find((r) => r.key === reasonKey) ?? null,
    [context, reasonKey]
  );

  const selectOrder = useCallback(
    (id: string | null) => {
      setQuantities({});
      load({ storeOrderId: id });
    },
    [load]
  );

  const toggleItem = useCallback((itemId: string, max: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (itemId in next) delete next[itemId];
      else next[itemId] = max;
      return next;
    });
  }, []);

  const setItemQuantity = useCallback((itemId: string, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [itemId]: quantity }));
  }, []);

  /**
   * Lo primero que falta, para decirlo junto al botón. El servidor valida lo
   * mismo; esto solo evita un viaje para decir algo que ya se sabe.
   */
  const missing = useMemo((): string | null => {
    if (!reason) return 'Elige un motivo.';
    if (reason.order === 'required' && !context?.order) return 'Elige el pedido.';
    if (context?.order && reason.unavailableWhy) return reason.unavailableWhy;
    if (reason.items === 'required' && Object.keys(quantities).length === 0) {
      return 'Marca al menos un producto.';
    }
    if (reason.photo && photos.length === 0) return 'Adjunta al menos una foto.';
    if (photos.length > MAX_PHOTOS) return `Puedes adjuntar hasta ${MAX_PHOTOS} fotos.`;
    if (description.trim().length < MIN_DESCRIPTION) {
      return `Describe lo que pasó (mínimo ${MIN_DESCRIPTION} caracteres).`;
    }
    return null;
  }, [reason, context, quantities, photos, description]);

  const submit = useCallback(async () => {
    if (!reason || missing) return;
    try {
      setSubmitting(true);
      setSubmitError(null);

      const attachments = await pqrsService.uploadPhotos(photos);
      const llevaProductos = reason.items !== 'none';

      const created = await pqrsService.create({
        reason: reason.key,
        description,
        storeOrderId: reason.order === 'none' ? null : storeOrderId,
        storeId: as === 'seller' ? storeId : null,
        items: llevaProductos
          ? Object.entries(quantities).map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
          : [],
        attachments,
      });

      onCreated(created);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'No se pudo radicar el caso.');
    } finally {
      setSubmitting(false);
    }
  }, [reason, missing, photos, description, storeOrderId, as, storeId, quantities, onCreated]);

  return {
    context,
    loading,
    loadError,
    reason,
    reasonKey,
    setReasonKey,
    storeOrderId,
    selectOrder,
    description,
    setDescription,
    quantities,
    toggleItem,
    setItemQuantity,
    photos,
    setPhotos,
    missing,
    submitting,
    submitError,
    submit,
  };
}
