import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal/modal';
import { Loader2, ArrowUpRight, ArrowDownLeft, Sliders, Calendar, User, FileText, History } from 'lucide-react';

interface Movement {
  id: string;
  store_product_id: string;
  store_id: string;
  type: 'entry' | 'exit' | 'adjustment';
  quantity: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_at: string;
  registered_by: string | null;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    stock: number;
    unit: string;
    emoji?: string;
    image?: string;
  } | null;
}

export function StockHistoryModal({ isOpen, onClose, product }: StockHistoryModalProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && product?.id) {
      fetchMovements();
    }
  }, [isOpen, product?.id]);

  const fetchMovements = async () => {
    if (!product?.id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/store-products/${product.id}/movements`);
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Error al obtener movimientos');
      }
      setMovements(resData.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getMovementBadge = (type: 'entry' | 'exit' | 'adjustment') => {
    switch (type) {
      case 'entry':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E6F4EA] text-[#137333] border border-[#C2E7CD]">
            <ArrowUpRight className="w-3 h-3" /> Entrada
          </span>
        );
      case 'exit':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]">
            <ArrowDownLeft className="w-3 h-3" /> Salida
          </span>
        );
      case 'adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#FEF7E0] text-[#B06000] border border-[#FEEFC3]">
            <Sliders className="w-3 h-3" /> Ajuste
          </span>
        );
    }
  };

  const formatQuantity = (type: 'entry' | 'exit' | 'adjustment', qty: number) => {
    const formattedQty = Number(qty).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    });
    if (type === 'entry') return `+${formattedQty}`;
    if (type === 'exit') return `-${formattedQty}`;
    return formattedQty;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bitácora de Inventario"
    >
      <div className="p-10 space-y-6 max-h-[80vh] overflow-y-auto">
        {/* Product Summary Card */}
        {product && (
          <div className="flex items-center gap-4 p-4 bg-mm-gbg/20 rounded-3xl border border-mm-crd shadow-sm">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl overflow-hidden shrink-0 border border-mm-crd shadow-sm">
              {product.image ? (
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">{product.emoji || '📦'}</span>
              )}
            </div>
            <div className="flex-grow min-w-0">
              <h3 className="font-bold text-mm-g text-lg truncate leading-tight">{product.name}</h3>
              <p className="text-xs text-mm-txs mt-0.5">Historial de variaciones de stock</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Stock Actual</p>
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-3xl font-fraunces font-bold text-mm-g leading-none">
                  {product.stock}
                </span>
                <span className="text-xs font-bold text-mm-txw uppercase">{product.unit}s</span>
              </div>
            </div>
          </div>
        )}

        {/* Movements History List */}
        <div className="space-y-4">
          <h4 className="text-sm font-black uppercase tracking-wider text-mm-txw px-1">Registros de Movimientos</h4>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-mm-txw">
              <Loader2 className="w-8 h-8 animate-spin text-mm-g mb-2" />
              <p className="text-xs font-bold">Cargando bitácora...</p>
            </div>
          ) : error ? (
            <div className="text-center py-10 bg-mm-gbg/10 border border-r/20 rounded-3xl p-6 text-r">
              <p className="text-sm font-bold">{error}</p>
              <button 
                onClick={fetchMovements}
                className="mt-3 text-xs font-bold underline hover:opacity-80 transition-opacity"
              >
                Reintentar
              </button>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 bg-mm-gbg/10 border border-dashed border-mm-crd rounded-3xl p-6 text-mm-txw">
              <History className="w-10 h-10 mx-auto opacity-30 mb-2 text-mm-txw" />
              <p className="text-sm font-bold italic">No se han registrado movimientos de inventario aún</p>
            </div>
          ) : (
            <div className="border border-mm-crd rounded-[24px] overflow-hidden bg-white divide-y divide-mm-crd shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mm-gbg/15 border-b border-mm-crd text-[10px] font-black uppercase text-mm-txw tracking-wider">
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Cant.</th>
                    <th className="px-4 py-3">Detalle / Notas</th>
                    <th className="px-4 py-3">Registrado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mm-crd text-xs">
                  {movements.map((movement) => {
                    const date = new Date(movement.created_at);
                    const formattedDate = date.toLocaleString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    });

                    return (
                      <tr key={movement.id} className="hover:bg-mm-gbg/5 transition-colors">
                        <td className="px-4 py-3 text-mm-txw whitespace-nowrap">
                          <div className="flex items-center gap-1.5 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-mm-txw opacity-60 shrink-0" />
                            {formattedDate}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {getMovementBadge(movement.type)}
                        </td>
                        <td className={`px-4 py-3 font-bold text-right whitespace-nowrap text-sm ${
                          movement.type === 'entry' ? 'text-[#137333]' : 
                          movement.type === 'exit' ? 'text-[#C5221F]' : 'text-mm-g'
                        }`}>
                          {formatQuantity(movement.type, movement.quantity)} {product?.unit}
                        </td>
                        <td className="px-4 py-3 text-mm-g font-medium max-w-[200px] truncate" title={movement.notes || ''}>
                          <div className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-mm-txw opacity-60 shrink-0" />
                            <span>{movement.notes || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-mm-txs">
                          <div className="flex items-center gap-1.5 max-w-[150px] truncate" title={movement.profiles?.email || 'Sistema'}>
                            <User className="w-3.5 h-3.5 text-mm-txw opacity-60 shrink-0" />
                            <span>
                              {movement.profiles?.full_name || 'Sistema'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex gap-2.5 p-4 bg-mm-gbg/10 rounded-2xl border border-mm-crd text-xs text-mm-txs font-medium leading-relaxed">
          <span className="text-mm-g">💡</span>
          <p>
            Los movimientos son automáticos por pedidos web y físicos (Entradas/Salidas), o generados manualmente por cambios de stock en el panel de vendedor.
          </p>
        </div>

        <div className="pt-2 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-6 py-2.5 bg-mm-g text-white hover:bg-mm-g/90 rounded-full font-bold shadow-sm transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
