'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { SearchableSelect, type SelectOption } from '@/components/ui/searchable-select';
import { Button, normalizeText } from '@/src/components/Shared';
import { mergeProductService, searchApprovedProductsService } from '../services/review.service';

interface MergeProductModalProps {
  /** El producto en revisión que se va a unir. `null` cierra el modal. */
  product: { id: string; name: string } | null;
  onClose: () => void;
  onMerged: () => void;
}

/**
 * Unir un producto propuesto por un tendero con uno que ya estaba en el
 * catálogo. Las tiendas que lo vendían pasan a vender el existente.
 */
export function MergeProductModal({ product, onClose, onMerged }: MergeProductModalProps) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, se busca por el nombre propuesto: lo más probable es que el
  // existente se parezca.
  useEffect(() => {
    setTargetId('');
    setError(null);
    setSearch(product ? normalizeText(product.name).split(' ')[0] ?? '' : '');
  }, [product]);

  useEffect(() => {
    if (!product) return;
    let vigente = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchApprovedProductsService(normalizeText(search))
        .then((found) => {
          if (!vigente) return;
          setOptions(
            found.map((p) => ({ value: p.id, label: p.category ? `${p.name} · ${p.category}` : p.name }))
          );
        })
        .catch((err: unknown) => vigente && setError(err instanceof Error ? err.message : 'Error al buscar'))
        .finally(() => vigente && setLoading(false));
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [search, product]);

  const merge = async () => {
    if (!product || !targetId) return;
    setIsMerging(true);
    setError(null);
    try {
      await mergeProductService(product.id, targetId);
      onMerged();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo unir el producto.');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Modal isOpen={!!product} onClose={onClose} title="Unir con un producto del catálogo" maxWidth="max-w-lg">
      <div className="p-8 space-y-5">
        <p className="text-sm text-mm-txs leading-relaxed">
          <strong className="text-mm-g">{product?.name}</strong> ya existe en el catálogo con otro
          nombre. Elige cuál: las tiendas que lo venden pasan a vender ese, con su precio y su stock,
          y el propuesto se borra.
        </p>

        <SearchableSelect
          label="Producto del catálogo"
          options={options}
          value={targetId}
          onChange={setTargetId}
          placeholder="Busca el producto..."
          searchValue={search}
          onSearchChange={setSearch}
          loading={loading}
          emptyMessage="No hay productos aprobados con ese nombre."
        />

        {error && (
          <div className="p-3 text-xs bg-rl text-r rounded-xl font-bold">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isMerging}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" onClick={merge} disabled={!targetId} loading={isMerging}>
            Unir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
