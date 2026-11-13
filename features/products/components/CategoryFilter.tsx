'use client';

import React from 'react';
import { CategoryScroller } from '@/components/ui/category-scroller';
import type { VitrinaCategoria } from '@/lib/store-products/category-tree';

const TODAS = 'Todas';

interface CategoryFilterProps {
  categories: VitrinaCategoria[];
  /** Vacío es «Todas». */
  category: string;
  subcategory: string;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
}

/**
 * Las categorías de la vitrina en dos filas: primero la categoría y, al
 * elegirla, sus subcategorías. Con «Todas» arriba no se muestra la segunda fila.
 */
export function CategoryFilter({
  categories,
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
}: CategoryFilterProps) {
  const elegida = categories.find((c) => c.name === category);
  const subcategorias = elegida?.subcategories ?? [];
  const todasEnLaCategoria = `${TODAS} en ${category}`;

  return (
    <div className="space-y-1">
      <CategoryScroller
        ariaLabel="Categorías"
        categories={[TODAS, ...categories.map((c) => c.name)]}
        activeCategory={category || TODAS}
        onSelect={(c) => onCategoryChange(c === TODAS ? '' : c)}
      />

      {/* Una sola subcategoría no aporta: sería lo mismo que la categoría. */}
      {subcategorias.length > 1 && (
        <CategoryScroller
          size="sm"
          ariaLabel={`Subcategorías de ${category}`}
          categories={[todasEnLaCategoria, ...subcategorias.map((s) => s.name)]}
          activeCategory={subcategory || todasEnLaCategoria}
          onSelect={(s) => onSubcategoryChange(s === todasEnLaCategoria ? '' : s)}
        />
      )}
    </div>
  );
}
