'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, X, Users, Store } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, Input } from '@/src/components/Shared';
import { Table } from '@/components/ui/table/components/Table';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { useStoreGroups, type StoreGroupRow } from '../hooks/use-store-groups';

/**
 * Grupos de tiendas: quién es dueño de qué parte del catálogo maestro.
 *
 * Un producto marcado como exclusivo de un grupo solo lo pueden publicar las
 * tiendas de ese grupo. Sirve para que quien aporta productos con sus propias
 * fotos no vea a otras tiendas reutilizarlas, y para que un mismo comerciante
 * con tiendas en varios sectores las comparta entre ellas.
 */
export function StoreGroupsTab() {
  const { groups, stores, loading, error, saveGroup, setGroupStores, deleteGroup } = useStoreGroups();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StoreGroupRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [formData, setFormData] = useState({ name: '', description: '' });
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const filteredGroups = useMemo(
    () =>
      groups.filter((group) =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [groups, searchTerm]
  );

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: filteredGroups });

  // Una tienda pertenece a un solo grupo: las que ya están en otro se ofrecen
  // deshabilitadas, para que se vea por qué no se pueden elegir.
  const groupIdByStoreId = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      for (const store of group.stores ?? []) map.set(store.id, group.id);
    }
    return map;
  }, [groups]);

  const handleOpenAdd = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '' });
    setSelectedStoreIds([]);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (group: StoreGroupRow) => {
    setEditingGroup(group);
    setFormData({ name: group.name, description: group.description || '' });
    setSelectedStoreIds((group.stores ?? []).map((store) => store.id));
    setFormError(null);
    setIsModalOpen(true);
  };

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);

      const payload = { name: formData.name, description: formData.description || null };

      // El grupo tiene que existir antes de poder asignarle tiendas, así que al
      // crearlo se usa el id que devuelve el guardado.
      const saved = await saveGroup(editingGroup?.id ?? null, payload);

      if (editingGroup || selectedStoreIds.length > 0) {
        await setGroupStores(saved.id, selectedStoreIds);
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Grupo',
      sortable: true,
      render: (item: StoreGroupRow) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-mm-gbg rounded-lg flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-mm-g" />
          </div>
          <div>
            <span className="font-bold text-mm-g block">{item.name}</span>
            {item.description && (
              <span className="text-[11px] text-mm-txs">{item.description}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'stores',
      label: 'Tiendas',
      render: (item: StoreGroupRow) => {
        const list = item.stores ?? [];
        if (list.length === 0) {
          return <span className="text-mm-txw italic text-sm">Sin tiendas</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {list.map((store) => (
              <Badge key={store.id} variant="oro">{store.name}</Badge>
            ))}
          </div>
        );
      },
    },
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando grupos de tiendas...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full sm:w-auto max-w-md">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar grupo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo Grupo
        </Button>
      </div>

      <Table
        data={paginatedData}
        columns={columns}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={handleSort}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={setRowsPerPage}
        actions={(item: StoreGroupRow) => (
          <div className="flex gap-2">
            <button
              onClick={() => handleOpenEdit(item)}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
              title="Editar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => deleteGroup(item.id)}
              className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-lg w-full p-8 z-10 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-fraunces text-mm-g mb-2">
                {editingGroup ? 'Editar Grupo de Tiendas' : 'Nuevo Grupo de Tiendas'}
              </h3>
              <p className="text-xs text-mm-txs mb-6">
                Las tiendas de un grupo comparten los productos del catálogo marcados como
                exclusivos de ese grupo, con sus imágenes.
              </p>

              {formError && (
                <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nombre del grupo"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: La Kelly"
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional..."
                    className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g min-h-[70px]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">Tiendas del grupo</label>
                  <div className="border border-mm-crd rounded-xl divide-y divide-mm-crd/50 max-h-64 overflow-y-auto">
                    {stores.map((store) => {
                      const ownerId = groupIdByStoreId.get(store.id);
                      const inAnotherGroup = ownerId !== undefined && ownerId !== editingGroup?.id;
                      const checked = selectedStoreIds.includes(store.id);

                      return (
                        <label
                          key={store.id}
                          className={`flex items-center gap-3 px-4 py-2.5 ${
                            inAnotherGroup ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-mm-gbg/40'
                          }`}
                          title={inAnotherGroup ? 'Ya pertenece a otro grupo' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={inAnotherGroup}
                            onChange={() => toggleStore(store.id)}
                            className="w-4 h-4 accent-mm-g rounded"
                          />
                          <Store className="w-4 h-4 text-mm-txw shrink-0" />
                          <span className="text-sm text-mm-g">{store.name}</span>
                          {inAnotherGroup && (
                            <span className="text-[10px] text-mm-txw ml-auto">en otro grupo</span>
                          )}
                        </label>
                      );
                    })}
                    {stores.length === 0 && (
                      <p className="px-4 py-3 text-sm text-mm-txw italic">No hay tiendas.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
