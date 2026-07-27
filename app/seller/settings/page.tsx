'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Store } from 'lucide-react';
import { useSellerStore } from '@/app/hooks/use-seller-store';
import { useStoreHours } from './hooks/use-store-hours';
import { WeeklyHoursEditor } from '@/components/ui/business-hours/business-hours-editor';
import { Button } from '@/src/components/Shared';

export default function SellerSettingsPage() {
  const { storeId, storeName, loading: loadingStore } = useSellerStore();
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

  if (loadingStore) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-mm-txw" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-mm-gbg flex items-center justify-center text-mm-g">
          <Store className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-fraunces text-mm-g">Mi Tienda</h1>
          <p className="text-sm text-mm-txs">{storeName}</p>
        </div>
      </div>

      {error && (
        <div className="bg-rl text-r text-sm font-medium px-4 py-3 rounded-2xl">{error}</div>
      )}

      {saved && !error && (
        <div className="bg-okl text-ok text-sm font-medium px-4 py-3 rounded-2xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Horario guardado.
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-mm-crd shadow-sm space-y-6">
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
    </div>
  );
}
