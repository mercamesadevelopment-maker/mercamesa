'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, X, FolderTree } from 'lucide-react';
import { useCategories } from '../hooks/use-categories';
import { CategoryRow } from '../types/settings.types';
import { Table } from '@/components/ui/table/components/Table';
import { useTable } from '@/components/ui/table/hooks/useTable';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useDeleteConfirm } from '@/components/ui/confirm-modal/hooks/use-delete-confirm';
import { Button, Badge, Input } from '@/src/components/Shared';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Motivo por el que una categoría no se puede borrar, o `null` si sí se puede.
 *
 * El listado ya trae los conteos, así que esto se sabe antes de ofrecer el
 * borrado: el servidor responde lo mismo, pero llegar hasta allá significaba
 * confirmar para que le dijeran que no.
 */
function motivoBloqueo(item: CategoryRow): string | null {
  const productos = item.product_count ?? 0;
  const hijas = item.child_count ?? 0;

  if (productos > 0 && hijas > 0) {
    return `Tiene ${productos} producto(s) y ${hijas} subcategoría(s) asociados.`;
  }
  if (productos > 0) return `Tiene ${productos} producto(s) asociado(s).`;
  if (hijas > 0) return `Tiene ${hijas} subcategoría(s) asociada(s).`;
  return null;
}

export function CategoriesTab() {
  const { categories, loading, error, saveCategory, deleteCategory } = useCategories();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Confirmación y aviso de borrado con el modal de la aplicación, en vez de
  // `confirm()`/`alert()` del navegador.
  const borrado = useDeleteConfirm<CategoryRow>((item) => deleteCategory(item.id));

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    parent_id: '',
    sort_order: 0,
    is_active: true,
  });

  const filteredCategories = useMemo(() => {
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cat.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const {
    page, setPage, rowsPerPage, setRowsPerPage, sortKey, sortOrder, handleSort, paginatedData, totalPages
  } = useTable({ initialData: filteredCategories });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent_id: '',
      sort_order: 0,
      is_active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: CategoryRow) => {
    setEditingCategory(item);
    setFormData({
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      parent_id: item.parent_id || '',
      sort_order: item.sort_order ?? 0,
      is_active: item.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const autoSlug = val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: editingCategory ? prev.slug : autoSlug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setFormError(null);
      await saveCategory(editingCategory ? editingCategory.id : null, {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        parent_id: formData.parent_id || null,
        sort_order: Number(formData.sort_order),
        is_active: formData.is_active,
      });
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * El slug es único en la base. La lista completa ya está en memoria, así que
   * el choque se avisa junto al campo mientras se escribe, sin esperar al
   * servidor —que lo valida igual, porque otro administrador puede haberlo
   * usado entre que se cargó esta pantalla y se guarda.
   */
  const slugEnUso = useMemo(
    () =>
      formData.slug.trim() !== '' &&
      categories.some(
        (c) => c.slug === formData.slug.trim() && c.id !== editingCategory?.id
      ),
    [categories, formData.slug, editingCategory]
  );

  const columns = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (item: CategoryRow) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-mm-gbg rounded-lg flex items-center justify-center text-mm-g font-bold shrink-0">
            <FolderTree className="w-5 h-5 text-mm-g" />
          </div>
          <div>
            <span className="font-bold text-mm-g block">{item.name}</span>
            <span className="text-[10px] text-mm-txw uppercase font-mono">{item.slug}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'parent',
      label: 'Categoría Padre',
      sortable: false,
      render: (item: CategoryRow) => (
        <span className="text-sm text-mm-txs">
          {item.parent?.name ? (
            <Badge variant="oro">{item.parent.name}</Badge>
          ) : (
            <span className="text-mm-txw italic">Raíz</span>
          )}
        </span>
      ),
    },
    {
      key: 'product_count',
      label: 'En uso',
      sortable: true,
      render: (item: CategoryRow) => {
        const productos = item.product_count ?? 0;
        const hijas = item.child_count ?? 0;

        if (productos === 0 && hijas === 0) {
          return <span className="text-xs text-mm-txw italic">Sin usar</span>;
        }

        return (
          <div className="flex flex-col gap-0.5 text-xs text-mm-txs">
            {productos > 0 && <span>{productos} producto(s)</span>}
            {hijas > 0 && <span>{hijas} subcategoría(s)</span>}
          </div>
        );
      },
    },
    {
      key: 'sort_order',
      label: 'Orden',
      sortable: true,
      render: (item: CategoryRow) => <span className="text-sm text-mm-g font-mono">{item.sort_order}</span>,
    },
    {
      key: 'is_active',
      label: 'Estado',
      sortable: true,
      render: (item: CategoryRow) => (
        <Badge variant={item.is_active ? 'success' : 'warning'}>
          {item.is_active ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ];

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando categorías...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative flex-1 w-full sm:w-auto max-w-md">
          <Search className="w-4 h-4 text-mm-txw absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g placeholder:text-mm-txw"
          />
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus className="w-4 h-4 mr-2" /> Nueva Categoría
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
        actions={(item: CategoryRow) => {
          const bloqueo = motivoBloqueo(item);

          return (
            <div className="flex gap-2">
              <button
                onClick={() => handleOpenEdit(item)}
                className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
                title="Editar"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              {/* Deshabilitado con el motivo a la vista: el servidor lo iba a
                  rechazar igual, y así el clic no se pierde. */}
              <button
                onClick={() => borrado.ask(item)}
                disabled={!!bloqueo}
                title={bloqueo ? `No se puede eliminar. ${bloqueo} Puedes desactivarla.` : 'Eliminar'}
                className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-mm-txw"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        }}
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
              className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden max-w-lg w-full p-8 z-10"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-fraunces text-mm-g mb-6">
                {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
              </h3>

              {formError && (
                <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Nombre de la categoría"
                  value={formData.name}
                  onChange={handleNameChange}
                  placeholder="Ej: Frutas y Verduras"
                  required
                />

                <Input
                  label="Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="ej: frutas-y-verduras"
                  required
                  error={slugEnUso ? 'Ya existe otra categoría con este slug.' : undefined}
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Categoría Padre (opcional)</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g"
                  >
                    <option value="">Ninguna (Categoría raíz)</option>
                    {categories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-mm-txs ml-1">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción opcional de la categoría..."
                    className="px-4 py-2.5 rounded-xl border border-mm-crd bg-white focus:border-mm-g outline-none text-sm text-mm-g min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Orden de clasificación"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                  />

                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 cursor-pointer py-3">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 accent-mm-g rounded cursor-pointer"
                      />
                      <span className="text-sm font-bold text-mm-g">Categoría Activa</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting || slugEnUso}>
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!borrado.target}
        onClose={borrado.cancel}
        onConfirm={borrado.confirm}
        title="Eliminar categoría"
        message={
          <>
            ¿Eliminar <span className="font-bold text-mm-g">{borrado.target?.name}</span>? Esta acción
            no se puede deshacer. Si más adelante la vas a necesitar, desactívala en vez de borrarla.
          </>
        }
        variant="danger"
        confirmText="Eliminar"
        isLoading={borrado.isDeleting}
      />

      <ConfirmModal
        isOpen={!!borrado.error}
        onClose={borrado.dismissError}
        onConfirm={borrado.dismissError}
        title="No se puede eliminar"
        message={borrado.error || ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </div>
  );
}
