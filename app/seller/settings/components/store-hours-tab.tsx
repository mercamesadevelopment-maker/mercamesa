'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useStoreHours } from '../hooks/use-store-hours';
import { WeeklyHoursEditor } from '@/components/ui/business-hours/business-hours-editor';
import { Button } from '@/src/components/Shared';

interface StoreHoursTabProps {
  storeId: string | null;
}

export function StoreHoursTab({ storeId }: StoreHoursTabProps) {
  const { businessHours, setBusinessHours, loading, saving, error, fetchHours, saveHours } =
    useStoreHours(storeId);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (storeId) fetchHours();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const handleSave = async () => {
    setSaved(false);
    try {
      await saveHours();
      setSaved(true);
    } catch {
      // el error ya se muestra en el banner
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>
      )}

      {saved && !error && (
        <div className="bg-okl text-ok text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Horario guardado.
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
        </div>
      ) : (
        <>
          <WeeklyHoursEditor value={businessHours} onChange={(hours) => { setBusinessHours(hours); setSaved(false); }} />

          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Guardar horario
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
