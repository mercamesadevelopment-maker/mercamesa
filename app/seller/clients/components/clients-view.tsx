import React, { useState } from 'react';
import { 
  Users, Search, DollarSign, ShoppingBag, User2, Eye, Mail, Phone, 
  CreditCard, Calendar, ChevronDown, ChevronUp, Clock, Receipt, Package 
} from 'lucide-react';
import { useClients, ClientWithMetrics, ClientOrder } from '../hooks/use-clients';
import { Table } from '@/components/ui/table/components/Table';
import { Modal } from '@/components/ui/modal/modal';
import { Badge, Button, cn } from '@/src/components/Shared';
import { fmt } from '@/src/constants';

export function ClientsView() {
  const {
    clients,
    loading,
    searchTerm,
    setSearchTerm,
    selectedClient,
    setSelectedClient,
    stats,
    storeName,
    stores,
    storeId,
    selectStore,
  } = useClients();

  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrder = (orderId: string) => {
    setExpandedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Cliente',
      render: (item: ClientWithMetrics) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-mm-gbg flex items-center justify-center text-mm-g font-bold font-fraunces border border-mm-crd shrink-0">
            {item.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-mm-g leading-tight">{item.full_name}</p>
            <p className="text-[10px] text-mm-txw mt-0.5">ID: {item.document_number}</p>
          </div>
        </div>
      )
    },
    {
      key: 'contact',
      label: 'Contacto',
      render: (item: ClientWithMetrics) => (
        <div className="flex flex-col gap-1 text-xs">
          {item.phone && (
            <span className="flex items-center gap-1.5 text-mm-txs">
              <Phone className="w-3.5 h-3.5 text-mm-txw" /> {item.phone}
            </span>
          )}
          {item.email && (
            <span className="flex items-center gap-1.5 text-mm-txs">
              <Mail className="w-3.5 h-3.5 text-mm-txw" /> {item.email}
            </span>
          )}
          {!item.phone && !item.email && <span className="text-mm-txw italic">Sin datos de contacto</span>}
        </div>
      )
    },
    {
      key: 'totalOrders',
      label: 'Compras',
      render: (item: ClientWithMetrics) => (
        <Badge variant={item.totalOrders > 0 ? 'success' : 'default'} className="px-3 py-1 font-bold">
          {item.totalOrders} {item.totalOrders === 1 ? 'pedido' : 'pedidos'}
        </Badge>
      )
    },
    {
      key: 'totalSpent',
      label: 'Total Facturado',
      render: (item: ClientWithMetrics) => (
        <span className="font-mono font-bold text-mm-g text-sm tabular-nums">
          {fmt(item.totalSpent)}
        </span>
      )
    },
    {
      key: 'lastOrderDate',
      label: 'Última Compra',
      render: (item: ClientWithMetrics) => (
        <div>
          {item.lastOrderDate ? (
            <>
              <p className="text-xs text-mm-g font-bold">{new Date(item.lastOrderDate).toLocaleDateString()}</p>
              <p className="text-[9px] text-mm-txw font-bold uppercase tracking-wider opacity-65">
                {new Date(item.lastOrderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          ) : (
            <span className="text-xs text-mm-txw italic">Ninguna</span>
          )}
        </div>
      )
    }
  ];

  const actions = (item: ClientWithMetrics) => (
    <button 
      onClick={() => {
        setSelectedClient(item);
        setExpandedOrders({});
      }}
      className="flex items-center gap-1 px-3.5 py-2 hover:bg-mm-gbg rounded-xl transition-colors text-mm-oro text-xs font-bold border border-mm-crd/50 shadow-sm"
      title="Ver historial de pedidos"
    >
      <Eye className="w-4 h-4" /> Historial
    </button>
  );

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div>
            <h1 className="text-4xl font-fraunces text-mm-g mb-2">Clientes</h1>
            <p className="text-mm-txs">Consulta y administra la base de clientes y sus historiales de compra.</p>
          </div>
          {stores.length > 1 && (
            <div className="flex flex-col gap-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-widest text-mm-txw">Tienda Activa</label>
              <select
                value={storeId || ''}
                onChange={(e) => selectStore(e.target.value)}
                className="bg-white text-mm-g font-semibold text-sm border border-mm-crd rounded-xl px-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-mm-g/20 cursor-pointer"
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
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Customers */}
        <div className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-g">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Clientes Registrados</p>
            <p className="text-2xl font-bold text-mm-g leading-tight">{stats.totalClients}</p>
          </div>
        </div>

        {/* Active Customers */}
        <div className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-g">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Clientes Activos</p>
            <p className="text-2xl font-bold text-mm-g leading-tight">
              {stats.activeClientsCount} <span className="text-xs font-normal text-mm-txw">({stats.totalClients > 0 ? Math.round((stats.activeClientsCount / stats.totalClients) * 100) : 0}%)</span>
            </p>
          </div>
        </div>

        {/* Store Revenue */}
        <div className="bg-white p-6 rounded-[32px] border border-mm-crd shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-oro">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-mm-txw tracking-widest leading-none mb-1">Facturación Clientes</p>
            <p className="text-2xl font-bold text-mm-g leading-tight">{fmt(stats.totalSpentInStore)}</p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md bg-white rounded-2xl border border-mm-crd shadow-sm flex items-center">
        <Search className="w-4.5 h-4.5 text-mm-txw absolute left-4 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar cliente por nombre, documento, correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white focus:outline-none text-sm text-mm-g placeholder:text-mm-txw font-medium"
        />
      </div>

      {/* Clients Table Card */}
      <div className="bg-white rounded-[40px] border border-mm-crd shadow-sm overflow-hidden">
        <div className="p-8 border-b border-mm-crd flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-mm-gbg rounded-xl flex items-center justify-center text-mm-g">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-fraunces text-mm-g">Cartera de Clientes</h3>
          </div>
          <Badge variant="default" className="text-xs px-4 py-1.5 uppercase tracking-tighter shadow-inner">
            {clients.length} registros
          </Badge>
        </div>

        <Table 
          data={clients}
          columns={columns}
          actions={actions}
          emptyMessage="No se encontraron clientes registrados."
        />
      </div>

      {/* Modal: Client Order History */}
      <Modal
        isOpen={selectedClient !== null}
        onClose={() => {
          setSelectedClient(null);
          setExpandedOrders({});
        }}
        title="Historial del Cliente"
      >
        {selectedClient && (
          <div className="flex flex-col max-h-[85vh]">
            {/* Header info */}
            <div className="p-8 border-b border-mm-crd bg-mm-gbg/15">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-mm-g text-white flex items-center justify-center font-bold font-fraunces text-2xl shadow-sm border border-mm-crd">
                  {selectedClient.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-fraunces text-mm-g leading-tight">{selectedClient.full_name}</h2>
                  <p className="text-xs text-mm-txw mt-1 font-bold">
                    Cédula/NIT: <span className="font-mono text-mm-g">{selectedClient.document_number}</span>
                  </p>
                </div>
              </div>

              {/* Grid de contacto en modal */}
              <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-white/70 rounded-2xl border border-mm-crd/55 text-xs text-mm-g">
                <div className="space-y-1.5">
                  <p className="text-[9px] font-black uppercase text-mm-txw tracking-widest">Contacto</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-mm-txw" /> {selectedClient.phone || 'Sin teléfono'}
                  </p>
                  <p className="font-semibold flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-mm-txw" /> {selectedClient.email || 'Sin correo'}
                  </p>
                </div>
                <div className="space-y-1.5 border-l border-mm-crd pl-4">
                  <p className="text-[9px] font-black uppercase text-mm-txw tracking-widest">Estadísticas</p>
                  <p className="font-semibold">
                    Total Compras: <span className="font-bold text-mm-g">{selectedClient.totalOrders}</span>
                  </p>
                  <p className="font-semibold">
                    Total Gastado: <span className="font-bold text-mm-oro">{fmt(selectedClient.totalSpent)}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* List of orders */}
            <div className="p-8 overflow-y-auto space-y-4 flex-grow max-h-[50vh] scrollbar-thin">
              <div className="flex items-center gap-2 text-mm-txw mb-1">
                <Receipt className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Órdenes Realizadas ({selectedClient.orders.length})</span>
              </div>

              {selectedClient.orders.length === 0 ? (
                <div className="text-center py-10 bg-mm-gbg/10 rounded-2xl border border-dashed border-mm-crd">
                  <p className="text-sm text-mm-txw italic">Este cliente no registra compras en esta tienda.</p>
                </div>
              ) : (
                selectedClient.orders.map((order: ClientOrder) => {
                  const isExpanded = expandedOrders[order.rawId] || false;
                  return (
                    <div 
                      key={order.rawId} 
                      className={cn(
                        "bg-white rounded-2xl border transition-all p-5",
                        isExpanded ? "border-mm-g/40 shadow-md shadow-mm-g/5" : "border-mm-crd hover:border-mm-g/20 shadow-sm"
                      )}
                    >
                      {/* Cabecera del pedido */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            order.type === 'online' ? "bg-blue/5 border-blue/20 text-blue" : "bg-mm-g/5 border-mm-g/20 text-mm-g"
                          )}>
                            <Package className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-mono font-bold text-sm text-mm-g">{order.id}</p>
                            <span className="text-[9px] font-bold text-mm-txw uppercase tracking-widest flex items-center gap-1 mt-0.5">
                              <Calendar className="w-3 h-3" /> {new Date(order.date).toLocaleDateString()} {new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5">
                          <p className="font-mono font-bold text-mm-g">{fmt(order.total)}</p>
                          <div className="flex gap-1.5">
                            <Badge variant={
                              order.status === 'Entregado' ? 'success' : 
                              order.status === 'Pendiente' ? 'default' : 
                              order.status === 'Cancelado' ? 'error' : 'oro'
                            } className="text-[8px] py-0 px-2 leading-tight">
                              {order.status}
                            </Badge>
                            <Badge variant={order.paymentStatus === 'Pagado' ? 'success' : 'default'} className="text-[8px] py-0 px-2 leading-tight">
                              {order.paymentStatus}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Botón ver detalles */}
                      <div className="mt-4 pt-4 border-t border-mm-crd/50 flex justify-between items-center">
                        <span className="text-[10px] text-mm-txw font-bold uppercase tracking-wider">{order.items.length} {order.items.length === 1 ? 'producto' : 'productos'}</span>
                        <button
                          onClick={() => toggleOrder(order.rawId)}
                          className="flex items-center gap-1 text-[11px] text-mm-oro font-bold hover:opacity-80 transition-opacity"
                        >
                          {isExpanded ? (
                            <>Ocultar productos <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>Ver productos <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </div>

                      {/* Lista de productos expandible */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-dashed border-mm-crd/60 space-y-3 animate-fade-down">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-mm-gbg/20 rounded-xl border border-mm-crd/45">
                              <div className="flex items-center gap-3">
                                <span className="text-xl shrink-0">{item.emoji}</span>
                                <div>
                                  <p className="text-xs font-bold text-mm-g leading-tight">{item.name}</p>
                                  <p className="text-[9px] text-mm-txw mt-0.5 font-semibold">{fmt(item.price)} / {item.unit}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-mm-g">
                                  {item.unit === 'kg' && item.qty < 1 ? `${Math.round(item.qty * 1000)} g` : `${item.qty.toLocaleString()} ${item.unit}`}
                                </p>
                                <p className="text-[9px] text-blue font-bold tracking-tight">{fmt(item.price * item.qty)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-8 border-t border-mm-crd bg-mm-gbg/10 flex justify-end">
              <Button
                onClick={() => {
                  setSelectedClient(null);
                  setExpandedOrders({});
                }}
                variant="outline"
                className="px-6 py-3 border-mm-crd text-mm-txw"
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
