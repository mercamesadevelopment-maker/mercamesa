import React, { useState } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Button, Input } from '@/src/components/Shared';
import { ArrowUpRight, ArrowDownLeft, Sliders, Loader2 } from 'lucide-react';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  product: {
    id: string;
    name: string;
    stock: number;
    unit: string;
    emoji?: string;
    image?: string;
  } | null;
}

export function StockMovementModal({ isOpen, onClose, onSuccess, product }: StockMovementModalProps) {
  const [type, setType] = useState<'entry' | 'exit' | 'adjustment'>('entry');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product?.id || quantity === '' || quantity < 0) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/store-products/${product.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          quantity: Number(quantity),
          notes: notes.trim(),
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Error al guardar el movimiento');
      }

      await onSuccess();
      onClose();
      // Reset state
      setType('entry');
      setQuantity('');
      setNotes('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Movimiento de Stock"
    >
      <form onSubmit={handleSubmit} className="p-10 space-y-6">
        {product && (
          <div className="flex items-center gap-4 p-4 bg-mm-gbg/20 rounded-3xl border border-mm-crd shadow-sm">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl overflow-hidden shrink-0 border border-mm-crd shadow-sm">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl">{product.emoji || '📦'}</span>
              )}
            </div>
            <div>
              <h3 className="font-bold text-mm-g text-sm leading-tight">{product.name}</h3>
              <p className="text-xs text-mm-txw mt-0.5">
                Stock actual: <span className="font-bold text-mm-g">{product.stock} {product.unit}s</span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-rl/15 border border-r/20 rounded-2xl text-xs text-r font-bold text-center">
            {error}
          </div>
        )}

        {/* Tipo de movimiento */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-mm-txs ml-1">Tipo de Movimiento</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType('entry')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                type === 'entry'
                  ? 'bg-[#E6F4EA] text-[#137333] border-[#C2E7CD] shadow-sm'
                  : 'bg-white text-mm-g border-mm-crd hover:bg-mm-gbg/20'
              }`}
            >
              <ArrowUpRight className="w-5 h-5 mb-1 text-[#137333]" />
              Entrada (+)
            </button>
            <button
              type="button"
              onClick={() => setType('exit')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                type === 'exit'
                  ? 'bg-[#FCE8E6] text-[#C5221F] border-[#FAD2CF] shadow-sm'
                  : 'bg-white text-mm-g border-mm-crd hover:bg-mm-gbg/20'
              }`}
            >
              <ArrowDownLeft className="w-5 h-5 mb-1 text-[#C5221F]" />
              Salida (-)
            </button>
            <button
              type="button"
              onClick={() => setType('adjustment')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-xs font-bold transition-all ${
                type === 'adjustment'
                  ? 'bg-[#FEF7E0] text-[#B06000] border-[#FEEFC3] shadow-sm'
                  : 'bg-white text-mm-g border-mm-crd hover:bg-mm-gbg/20'
              }`}
            >
              <Sliders className="w-5 h-5 mb-1 text-[#B06000]" />
              Ajuste (Fijar)
            </button>
          </div>
        </div>

        {/* Cantidad */}
        <Input
          label={
            type === 'entry'
              ? 'Cantidad a ingresar'
              : type === 'exit'
              ? 'Cantidad a retirar'
              : 'Nuevo valor de stock físico'
          }
          type="number"
          required
          min="0.001"
          step="any"
          placeholder={type === 'adjustment' && product ? String(product.stock) : '0'}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
        />

        {/* Notas / Detalle */}
        <Input
          label="Notas / Motivo"
          placeholder="Ej: Conteo físico, Merma, Carga de mercadería"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Botones de acción */}
        <div className="pt-4 flex gap-3 border-t border-mm-gbg">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="flex-1 flex items-center justify-center gap-1.5"
            disabled={loading || quantity === ''}
          >
            {loading ? (
              <>
                Guardando...
                <Loader2 className="w-4 h-4 animate-spin" />
              </>
            ) : (
              'Guardar Movimiento'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
