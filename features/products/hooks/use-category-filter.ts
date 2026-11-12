'use client';

import { useCallback, useState } from 'react';

/**
 * El filtro de categorías de la vitrina, en dos niveles.
 *
 * Vacío es «Todas». Cambiar de categoría limpia la subcategoría: la que estaba
 * elegida es de otra categoría y dejaría la vitrina vacía.
 */
export function useCategoryFilter() {
  const [category, setCategoryState] = useState('');
  const [subcategory, setSubcategory] = useState('');

  const setCategory = useCallback((next: string) => {
    setCategoryState(next);
    setSubcategory('');
  }, []);

  return { category, subcategory, setCategory, setSubcategory };
}
