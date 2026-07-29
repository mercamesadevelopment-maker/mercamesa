import { useState, useCallback, useEffect } from 'react';
import { MeasurementUnitRow, MeasurementUnitInsert, MeasurementUnitUpdate } from '../types/settings.types';
import { getMeasurementUnitsService, saveMeasurementUnitService, deleteMeasurementUnitService } from '../services/settings.service';

export function useMeasurementUnits() {
  const [units, setUnits] = useState<MeasurementUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnits = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMeasurementUnitsService();
      setUnits(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar unidades de medida');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const saveUnit = async (id: string | null, payload: MeasurementUnitInsert | MeasurementUnitUpdate) => {
    try {
      await saveMeasurementUnitService(id, payload);
      await fetchUnits();
    } catch (err: unknown) {
      throw new Error(err instanceof Error ? err.message : 'Error al guardar unidad de medida');
    }
  };

  const deleteUnit = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta unidad de medida?')) return;
    try {
      await deleteMeasurementUnitService(id);
      await fetchUnits();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar unidad de medida');
    }
  };

  return {
    units,
    loading,
    error,
    fetchUnits,
    saveUnit,
    deleteUnit,
  };
}
