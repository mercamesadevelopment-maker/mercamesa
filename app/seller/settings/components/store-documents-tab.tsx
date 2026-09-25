'use client';

import { useCallback, useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { StoreDocumentsPanel } from '@/src/features/stores/components/StoreDocumentsPanel';

/**
 * La documentación de la tienda, para el tendero.
 *
 * Hasta ahora solo podía verla desde /seller/onboarding y únicamente mientras
 * estuviera incompleta: el botón que abre el modal se reemplaza por «Ir a mi
 * Panel» en cuanto todo queda aprobado. Desde ese momento no tenía dónde
 * consultarla, ver el histórico ni reemplazar un documento vencido.
 *
 * El contenido es el mismo `StoreDocumentsPanel` que usa el administrador, con
 * `canReview` en falso: la tienda sube y consulta, el estado lo decide el
 * administrador. El servidor lo impone igual.
 */

interface StoreDocumentsTabProps {
  storeId: string | null;
}

interface EstadoDocumentos {
  requeridos: number;
  aprobados: number;
}

export function StoreDocumentsTab({ storeId }: StoreDocumentsTabProps) {
  const [estado, setEstado] = useState<EstadoDocumentos | null>(null);

  /**
   * Cuántos documentos obligatorios faltan por aprobar.
   *
   * Es la misma regla que aplica /seller/onboarding para decidir si una tienda
   * está verificada: todos los tipos `is_required` con documento `approved`. Se
   * calcula sobre los documentos que el panel ya cargó, no con una consulta
   * aparte: dos respuestas del mismo endpoint podrían contradecirse justo
   * después de guardar.
   */
  const resumir = useCallback((docs: { is_required: boolean; status: string }[]) => {
    const requeridos = docs.filter((d) => d.is_required);
    setEstado({
      requeridos: requeridos.length,
      aprobados: requeridos.filter((d) => d.status === 'approved').length,
    });
  }, []);

  if (!storeId) return null;

  // Sin documentos obligatorios configurados no hay nada que verificar, y decir
  // "verificada" sería inventarse una aprobación que nadie dio.
  const verificada = !!estado && estado.requeridos > 0 && estado.aprobados === estado.requeridos;

  return (
    <div className="space-y-6">
      {estado && estado.requeridos > 0 && (
        <div
          className={`flex items-start gap-3 rounded-2xl border p-4 ${
            verificada ? 'border-mm-g/30 bg-mm-gbg/40' : 'border-amber-200 bg-amber-50'
          }`}
        >
          {verificada ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mm-g" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          )}
          <div className={`text-xs leading-relaxed ${verificada ? 'text-mm-g' : 'text-amber-900'}`}>
            <p className="mb-0.5 font-bold">
              {verificada ? 'Tu tienda está verificada' : 'Tu tienda está pendiente de verificación'}
            </p>
            <p>
              {estado.aprobados} de {estado.requeridos} documentos obligatorios aprobados.
            </p>
          </div>
        </div>
      )}

      <StoreDocumentsPanel storeId={storeId} onDocumentsLoaded={resumir} />
    </div>
  );
}
