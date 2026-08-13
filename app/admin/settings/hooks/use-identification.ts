import { useState, useCallback, useEffect } from 'react';
import {
  PersonTypeRow,
  PersonTypeInsert,
  PersonTypeUpdate,
  IdentificationTypeRow,
  IdentificationTypeInsert,
  IdentificationTypeUpdate,
} from '../types/settings.types';
import {
  getPersonTypesService,
  savePersonTypeService,
  deletePersonTypeService,
  getIdentificationTypesService,
  saveIdentificationTypeService,
  deleteIdentificationTypeService,
} from '../services/settings.service';

/**
 * Los dos catálogos van en un solo hook porque están acoplados: la pantalla
 * muestra a qué tipos de persona aplica cada identificación, así que al guardar
 * o borrar cualquiera de los dos hay que recargar ambos.
 */
export function useIdentification() {
  const [personTypes, setPersonTypes] = useState<PersonTypeRow[]>([]);
  const [identificationTypes, setIdentificationTypes] = useState<IdentificationTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [persons, identifications] = await Promise.all([
        getPersonTypesService(),
        getIdentificationTypesService(),
      ]);
      setPersonTypes(persons);
      setIdentificationTypes(identifications);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar los tipos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const savePersonType = async (id: string | null, payload: PersonTypeInsert | PersonTypeUpdate) => {
    try {
      await savePersonTypeService(id, payload);
      await fetchAll();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar el tipo de persona');
    }
  };

  const saveIdentificationType = async (
    id: string | null,
    payload: IdentificationTypeInsert | IdentificationTypeUpdate
  ) => {
    try {
      await saveIdentificationTypeService(id, payload);
      await fetchAll();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar el tipo de identificación');
    }
  };

  const deletePersonType = async (id: string) => {
    await deletePersonTypeService(id);
    await fetchAll();
  };

  const deleteIdentificationType = async (id: string) => {
    await deleteIdentificationTypeService(id);
    await fetchAll();
  };

  return {
    personTypes,
    identificationTypes,
    loading,
    error,
    fetchAll,
    savePersonType,
    saveIdentificationType,
    deletePersonType,
    deleteIdentificationType,
  };
}
