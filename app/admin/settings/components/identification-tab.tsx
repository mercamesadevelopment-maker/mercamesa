'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Users, IdCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button, Badge, Input } from '@/src/components/Shared';
import { ConfirmModal } from '@/components/ui/confirm-modal/ConfirmModal';
import { useIdentification } from '../hooks/use-identification';
import type { PersonTypeRow, IdentificationTypeRow } from '../types/settings.types';

/**
 * Tipos de persona e identificación.
 *
 * Antes eran dos listas fijas y duplicadas en el código, e independientes entre
 * sí: nada impedía registrar una persona Natural con NIT. Acá se define qué
 * identificación aplica a qué tipo de persona, y esa es la regla que valida el
 * servidor al registrar y al editar el perfil.
 */
export function IdentificationTab() {
  const {
    personTypes,
    identificationTypes,
    loading,
    error,
    savePersonType,
    saveIdentificationType,
    deletePersonType,
    deleteIdentificationType,
  } = useIdentification();

  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonTypeRow | null>(null);
  const [personForm, setPersonForm] = useState({
    name: '',
    requires_business_name: false,
    sort_order: 0,
    is_active: true,
  });

  const [isIdModalOpen, setIsIdModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<IdentificationTypeRow | null>(null);
  const [idForm, setIdForm] = useState({
    name: '',
    code: '',
    sort_order: 0,
    is_active: true,
    person_type_ids: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    { kind: 'person' | 'identification'; id: string; name: string } | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const personNameById = new Map(personTypes.map((p) => [p.id, p.name]));

  const openPersonAdd = () => {
    setEditingPerson(null);
    setPersonForm({ name: '', requires_business_name: false, sort_order: 0, is_active: true });
    setFormError(null);
    setIsPersonModalOpen(true);
  };

  const openPersonEdit = (item: PersonTypeRow) => {
    setEditingPerson(item);
    setPersonForm({
      name: item.name,
      requires_business_name: item.requires_business_name,
      sort_order: item.sort_order,
      is_active: item.is_active,
    });
    setFormError(null);
    setIsPersonModalOpen(true);
  };

  const openIdAdd = () => {
    setEditingId(null);
    setIdForm({ name: '', code: '', sort_order: 0, is_active: true, person_type_ids: [] });
    setFormError(null);
    setIsIdModalOpen(true);
  };

  const openIdEdit = (item: IdentificationTypeRow) => {
    setEditingId(item);
    setIdForm({
      name: item.name,
      code: item.code,
      sort_order: item.sort_order,
      is_active: item.is_active,
      person_type_ids: item.person_type_ids ?? [],
    });
    setFormError(null);
    setIsIdModalOpen(true);
  };

  const submitPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await savePersonType(editingPerson?.id ?? null, personForm);
      setIsPersonModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitId = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    try {
      await saveIdentificationType(editingId?.id ?? null, idForm);
      setIsIdModalOpen(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      if (deleteTarget.kind === 'person') {
        await deletePersonType(deleteTarget.id);
      } else {
        await deleteIdentificationType(deleteTarget.id);
      }
      setDeleteTarget(null);
    } catch (err: unknown) {
      setDeleteTarget(null);
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePersonType = (personTypeId: string) => {
    setIdForm((prev) => ({
      ...prev,
      person_type_ids: prev.person_type_ids.includes(personTypeId)
        ? prev.person_type_ids.filter((id) => id !== personTypeId)
        : [...prev.person_type_ids, personTypeId],
    }));
  };

  if (loading) return <div className="p-8 text-center text-mm-txs">Cargando tipos...</div>;
  if (error) return <div className="p-8 text-center text-r">Error: {error}</div>;

  const rowActions = (onEdit: () => void, onDelete: () => void) => (
    <div className="flex gap-1">
      <button
        onClick={onEdit}
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-mm-g transition-colors"
        title="Editar"
      >
        <Edit2 className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className="p-2 hover:bg-mm-gbg rounded-full text-mm-txw hover:text-r transition-colors"
        title="Eliminar"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="space-y-10">
      {/* ── Tipos de persona ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-mm-g" />
            <div>
              <h3 className="font-bold text-mm-g">Tipos de persona</h3>
              <p className="text-xs text-mm-txs">
                Quien pide razón social lleva también nombre de contacto en vez de nombre completo.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openPersonAdd}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        </div>

        <div className="border border-mm-crd rounded-2xl divide-y divide-mm-crd/50 overflow-hidden">
          {personTypes.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <span className="font-bold text-mm-g flex-1">{item.name}</span>
              {item.requires_business_name && <Badge variant="oro">Razón social</Badge>}
              <Badge variant={item.is_active ? 'success' : 'warning'}>
                {item.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
              {rowActions(
                () => openPersonEdit(item),
                () => setDeleteTarget({ kind: 'person', id: item.id, name: item.name })
              )}
            </div>
          ))}
          {personTypes.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-mm-txw italic">
              No hay tipos de persona.
            </p>
          )}
        </div>
      </section>

      {/* ── Tipos de identificación ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <IdCard className="w-5 h-5 text-mm-g" />
            <div>
              <h3 className="font-bold text-mm-g">Tipos de identificación</h3>
              <p className="text-xs text-mm-txs">
                Cada uno aplica a los tipos de persona que marques. Es lo que filtra el formulario
                de registro y lo que valida el servidor.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openIdAdd}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo
          </Button>
        </div>

        <div className="border border-mm-crd rounded-2xl divide-y divide-mm-crd/50 overflow-hidden">
          {identificationTypes.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-mono text-xs font-bold text-mm-g bg-mm-gbg rounded-lg px-2 py-1">
                {item.code}
              </span>
              <span className="font-bold text-mm-g">{item.name}</span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {(item.person_type_ids ?? []).length === 0 ? (
                  <span className="text-xs text-r italic">
                    Sin tipos de persona: no aparecerá en ningún formulario
                  </span>
                ) : (
                  (item.person_type_ids ?? []).map((id) => (
                    <Badge key={id} variant="default">{personNameById.get(id) || '—'}</Badge>
                  ))
                )}
              </div>
              <Badge variant={item.is_active ? 'success' : 'warning'}>
                {item.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
              {rowActions(
                () => openIdEdit(item),
                () => setDeleteTarget({ kind: 'identification', id: item.id, name: item.name })
              )}
            </div>
          ))}
          {identificationTypes.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-mm-txw italic">
              No hay tipos de identificación.
            </p>
          )}
        </div>
      </section>

      {/* ── Modal: tipo de persona ── */}
      <AnimatePresence>
        {isPersonModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPersonModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-8 z-10"
            >
              <button
                onClick={() => setIsPersonModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-fraunces text-mm-g mb-6">
                {editingPerson ? 'Editar Tipo de Persona' : 'Nuevo Tipo de Persona'}
              </h3>

              {formError && (
                <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={submitPerson} className="space-y-4">
                <Input
                  label="Nombre"
                  value={personForm.name}
                  onChange={(e) => setPersonForm({ ...personForm, name: e.target.value })}
                  placeholder="Ej: Establecimiento de comercio"
                  required
                />

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={personForm.requires_business_name}
                    onChange={(e) =>
                      setPersonForm({ ...personForm, requires_business_name: e.target.checked })
                    }
                    className="w-4 h-4 accent-mm-g rounded mt-0.5"
                  />
                  <span className="text-sm text-mm-txs">
                    <span className="font-bold text-mm-g">Pide razón social</span>
                    <br />
                    El registro pedirá razón social y nombre de contacto en vez de nombre completo.
                  </span>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Orden"
                    type="number"
                    value={personForm.sort_order}
                    onChange={(e) =>
                      setPersonForm({ ...personForm, sort_order: Number(e.target.value) })
                    }
                  />
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 cursor-pointer py-3">
                      <input
                        type="checkbox"
                        checked={personForm.is_active}
                        onChange={(e) =>
                          setPersonForm({ ...personForm, is_active: e.target.checked })
                        }
                        className="w-4 h-4 accent-mm-g rounded"
                      />
                      <span className="text-sm font-bold text-mm-g">Activo</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsPersonModalOpen(false)}
                  >
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

      {/* ── Modal: tipo de identificación ── */}
      <AnimatePresence>
        {isIdModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsIdModalOpen(false)}
              className="absolute inset-0 bg-mm-g/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-[32px] shadow-2xl max-w-lg w-full p-8 z-10 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsIdModalOpen(false)}
                className="absolute top-6 right-6 p-2 hover:bg-mm-gbg rounded-full transition-colors text-mm-txs"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-2xl font-fraunces text-mm-g mb-6">
                {editingId ? 'Editar Tipo de Identificación' : 'Nuevo Tipo de Identificación'}
              </h3>

              {formError && (
                <div className="p-3 mb-4 text-xs bg-rl/20 text-r border border-r/20 rounded-xl font-bold">
                  {formError}
                </div>
              )}

              <form onSubmit={submitId} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    label="Código"
                    value={idForm.code}
                    onChange={(e) => setIdForm({ ...idForm, code: e.target.value })}
                    placeholder="CC"
                    required
                  />
                  <Input
                    label="Nombre"
                    className="col-span-2"
                    value={idForm.name}
                    onChange={(e) => setIdForm({ ...idForm, name: e.target.value })}
                    placeholder="Cédula de ciudadanía"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-mm-txs ml-1">
                    Aplica a estos tipos de persona
                  </label>
                  <div className="border border-mm-crd rounded-xl divide-y divide-mm-crd/50">
                    {personTypes.map((person) => (
                      <label
                        key={person.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-mm-gbg/40"
                      >
                        <input
                          type="checkbox"
                          checked={idForm.person_type_ids.includes(person.id)}
                          onChange={() => togglePersonType(person.id)}
                          className="w-4 h-4 accent-mm-g rounded"
                        />
                        <span className="text-sm text-mm-g">{person.name}</span>
                      </label>
                    ))}
                    {personTypes.length === 0 && (
                      <p className="px-4 py-3 text-sm text-mm-txw italic">
                        Crea primero un tipo de persona.
                      </p>
                    )}
                  </div>
                  {idForm.person_type_ids.length === 0 && (
                    <p className="text-xs text-r ml-1">
                      Sin ningún tipo marcado, esta identificación no aparecerá en el registro.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Orden"
                    type="number"
                    value={idForm.sort_order}
                    onChange={(e) => setIdForm({ ...idForm, sort_order: Number(e.target.value) })}
                  />
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 cursor-pointer py-3">
                      <input
                        type="checkbox"
                        checked={idForm.is_active}
                        onChange={(e) => setIdForm({ ...idForm, is_active: e.target.checked })}
                        className="w-4 h-4 accent-mm-g rounded"
                      />
                      <span className="text-sm font-bold text-mm-g">Activo</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsIdModalOpen(false)}
                  >
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

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Eliminar"
        message={`¿Eliminar "${deleteTarget?.name}"? Si está en uso no se podrá borrar; en ese caso desactívalo.`}
        variant="danger"
        confirmText="Eliminar"
        isLoading={isDeleting}
      />

      <ConfirmModal
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        onConfirm={() => setDeleteError(null)}
        title="No se puede eliminar"
        message={deleteError || ''}
        variant="warning"
        confirmText="Entendido"
        hideCancel
      />
    </div>
  );
}
