'use client';

import { useEffect, useState } from 'react';
import type { AccountingOptions } from '@/lib/accounting/types';
import { fetchAccountingOptions } from '../services/accounting.service';

/** Tiendas y plazas para los selectores de los filtros. */
export function useAccountingOptions() {
  const [options, setOptions] = useState<AccountingOptions>({ stores: [], marketplaces: [] });

  useEffect(() => {
    fetchAccountingOptions()
      .then(setOptions)
      .catch(() => {
        // Sin opciones los selectores quedan vacíos; el resto de la pantalla sigue.
      });
  }, []);

  return options;
}
