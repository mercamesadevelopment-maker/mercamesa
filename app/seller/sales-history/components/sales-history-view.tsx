import React from 'react';
import { 
  History, User2, Eye, MessageSquare, Receipt, Package, ArrowUpRight, 
  Check, X, Globe, ShoppingBag 
} from 'lucide-react';
import { useSalesHistory, UnifiedHistoryItem } from '../hooks/use-sales-history';
import { Table } from '@/components/ui/table/components/Table';
import { Modal } from '@/components/ui/modal/modal';
import { Badge, Button, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

export function SalesHistoryView() {
  const {
    unifiedHistory,
    selectedItem,
    setSelectedItem,
    totalHistoricalRevenue,
    storeName,
    stores,
    storeId,
    selectStore,
  } = useSalesHistory();

  const shareOnWhatsApp = (item: UnifiedHistoryItem) => {
    const date = new Date(item.date).toLocaleString();
    const itemsText = item.items.map(i => {
      const qtyText = i.unit === 'kg' && i.qty < 1 ? `${Math.round(i.qty * 1000)}g` : `${i.qty} ${i.unit}`;
      return `• ${i.emoji} ${i.name}: ${qtyText} - ${fmt(i.price * i.qty)}`;
    }).join('\n');

    const message = `*MERCAMESA - Recibo de Venta (${item.type === 'online' ? 'Digital' : 'Físico'})*\n\n` +
      `*Tienda:* ${storeName}\n` +
      `*Código:* ${item.id}\n` +
      `*Fecha:* ${date}\n\n` +
      `*Productos:*\n${itemsText}\n\n` +
      `*TOTAL:* ${fmt(item.total)}\n\n` +
      `*Cliente:* ${item.customerName}\n` +
      `¡Gracias por tu compra en MercaMesa! 🍎🥕`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
  };

  const columns = [
    {
      key: 'id',
      label: 'Código',
      render: (item: UnifiedHistoryItem) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono font-black text-mm-g text-base tracking-tighter">{item.id}</span>
          <Badge 
            variant={item.type === 'online' ? 'info' : 'default'} 
            className="w-fit text-[8px] px-2 py-0"
          >
            {item.type === 'online' ? 'Online' : 'En Sitio'}
          </Badge>
        </div>
      )
    },
    {
      key: 'date',
      label: 'Fecha / Hora',
      render: (item: UnifiedHistoryItem) => (
        <div>
          <p className="text-sm text-mm-g font-bold">{new Date(item.date).toLocaleDateString()}</p>
          <p className="text-[10px] text-mm-txw font-bold opacity-60 uppercase">
            {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )
    },
    {
      key: 'customerName',
      label: 'Cliente',
      render: (item: UnifiedHistoryItem) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-mm-gbg flex items-center justify-center text-mm-txw border border-mm-crd shrink-0">
            <User2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-mm-g leading-none">{item.customerName}</p>
            {item.customerID && <p className="text-[10px] text-mm-txw mt-1">ID: {item.customerID}</p>}
          </div>
        </div>
      )
    },
    {
      key: 'items',
      label: 'Detalle',
      render: (item: UnifiedHistoryItem) => (
        <div>
          <div className="flex gap-1 overflow-hidden max-w-[120px]">
            {item.items.map(i => (
              <div key={i.id} title={i.name} className="w-6 h-6 rounded-md bg-mm-gbg flex items-center justify-center text-xs shrink-0 border border-mm-crd/50">
                {i.emoji}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-mm-txw font-bold mt-1 uppercase tracking-tighter">
            {item.items.length} items
          </p>
        </div>
      )
    },
    {
      key: 'total',
      label: 'Monto',
      render: (item: UnifiedHistoryItem) => <span className="font-mono font-bold text-mm-g">{fmt(item.total)}</span>
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: UnifiedHistoryItem) => (
        <Badge variant={item.status === 'Entregado' ? 'success' : item.status === 'Pagado' ? 'success' : 'oro'}>
          {item.status}
        </Badge>
      )
    }
  ];

  const actions = (item: UnifiedHistoryItem) => (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => setSelectedItem(item)}
        className="p-2 hover:bg-mm-gbg rounded-xl transition-colors text-mm-oro"
        title="Ver detalle"
      >
        <Eye className="w-5 h-5" />
      </button>
      {/*
      <button 
        onClick={() => shareOnWhatsApp(item)}
        className="p-2 hover:bg-green-50 rounded-xl transition-colors text-[#25D366]"
        title="Compartir por WhatsApp"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
      */}
    </div>
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <h1 className="text-4xl font-fraunces text-mm-g mb-2">Historial de Ventas</h1>
            <p className="text-mm-txs">Consulta y gestiona todos los registros de ventas directas e indirectas.</p>
          </div>
          {stores.length > 1 && (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Tienda Activa</label>
              <select
                value={storeId || ''}
                onChange={(e) => selectStore(e.target.value)}
                className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-mm-crd shadow-sm">
          <History className="w-5 h-5 text-mm-g" />
          <div className="text-right">
             <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Total Histórico</p>
             <p className="text-lg font-bold text-mm-g leading-none">{fmt(totalHistoricalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Main Card with Table */}
      <div className="bg-white rounded-[40px] border border-mm-crd shadow-sm overflow-hidden">
        <div className="p-8 border-b border-mm-crd flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center text-mm-g">
               <History className="w-5 h-5" />
             </div>
             <h3 className="text-xl font-fraunces text-mm-g">Registros Consolidados</h3>
          </div>
          <Badge variant="default" className="text-xs px-4 py-1.5 uppercase tracking-tighter shadow-inner">
            {unifiedHistory.length} transacciones
          </Badge>
        </div>

        <Table 
          data={unifiedHistory}
          columns={columns}
          actions={actions}
          emptyMessage="No se encontraron registros de ventas o pedidos."
        />
      </div>

      {/* MODAL COMPARTIDO: Recibo Detallado */}
      <Modal 
        isOpen={selectedItem !== null} 
        onClose={() => setSelectedItem(null)} 
        title={selectedItem ? `Comprobante de Venta` : ''}
      >
        {selectedItem && (
          <div className="flex flex-col">
            <div className="p-8 border-b border-mm-crd flex items-center justify-between bg-mm-gbg/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-mm-oro/10 flex items-center justify-center text-mm-oro">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-fraunces text-mm-g">{selectedItem.id}</h2>
                  <p className="text-xs text-mm-txw font-bold uppercase tracking-widest">
                    {new Date(selectedItem.date).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6">
              <div className="space-y-4">
                 <div className="flex items-center gap-2 text-mm-txw">
                   <Package className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Productos</span>
                 </div>
                 <div className="space-y-3">
                   {selectedItem.items.map((item, idx) => (
                     <div key={idx} className="flex items-center gap-4 p-4 bg-mm-gbg/30 rounded-2xl border border-mm-crd/50">
                       <div className="w-12 h-12 rounded-xl bg-white border border-mm-crd flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                         {item.image ? (
                           <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                         ) : (
                           item.emoji
                         )}
                       </div>
                       <div className="flex-grow">
                         <p className="font-bold text-mm-g">{item.name}</p>
                         <p className="text-xs text-mm-txw">{fmt(item.price)} / {item.unit}</p>
                       </div>
                       <div className="text-right">
                         <p className="text-lg font-bold text-mm-g">
                           {item.unit === 'kg' && item.qty < 1 ? `${Math.round(item.qty * 1000)} g` : `${item.qty.toLocaleString()} ${item.unit}`}
                         </p>
                         <p className="text-[10px] font-bold text-blue uppercase tabular-nums">{fmt(item.price * item.qty)}</p>
                       </div>
                     </div>
                   ))}
                 </div>
              </div>

              <div className="pt-6 border-t border-mm-crd/50">
                <div className="flex items-center gap-2 text-mm-txw mb-4">
                   <User2 className="w-4 h-4" />
                   <span className="text-[10px] font-black uppercase tracking-widest">Información del Cliente</span>
                 </div>
                 <div className="bg-mm-gbg/20 p-5 rounded-3xl space-y-3">
                    <div className="flex justify-between">
                       <span className="text-xs text-mm-txw">Nombre:</span>
                       <span className="text-xs font-bold text-mm-g">{selectedItem.customerName}</span>
                    </div>
                    {selectedItem.customerID && (
                      <div className="flex justify-between">
                        <span className="text-xs text-mm-txw">Cédula/NIT:</span>
                        <span className="text-xs font-bold text-mm-g">{selectedItem.customerID}</span>
                      </div>
                    )}
                    {selectedItem.customerEmail && (
                      <div className="flex justify-between">
                        <span className="text-xs text-mm-txw">Email:</span>
                        <span className="text-xs font-bold text-mm-g">{selectedItem.customerEmail}</span>
                      </div>
                    )}
                    {selectedItem.address && (
                      <div className="flex justify-between">
                        <span className="text-xs text-mm-txw">Dirección de Entrega:</span>
                        <span className="text-xs font-bold text-mm-g text-right max-w-xs">{selectedItem.address}</span>
                      </div>
                    )}
                 </div>
              </div>
            </div>

            <div className="p-8 bg-mm-gbg/10 border-t border-mm-crd space-y-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-lg font-bold text-mm-txw">Total Facturado</span>
                <span className="text-3xl font-fraunces text-mm-g">{fmt(selectedItem.total)}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => shareOnWhatsApp(selectedItem)}
                  variant="primary"
                  className="py-4 bg-[#25D366] hover:bg-[#128C7E] border-none shadow-lg shadow-green-500/20"
                >
                  <MessageSquare className="w-5 h-5 mr-2" /> WhatsApp
                </Button>
                <Button 
                  onClick={() => setSelectedItem(null)}
                  variant="outline"
                  className="py-4 border-mm-crd text-mm-txw"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
