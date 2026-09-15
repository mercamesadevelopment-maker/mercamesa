import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/components/Shared';
import { useMediaQuery } from '@/src/features/layout/hooks/use-media-query';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const ELLIPSIS = '...' as const;

function getPageWindow(current: number, total: number, siblingCount = 1): (number | typeof ELLIPSIS)[] {
  const totalNumbers = siblingCount * 2 + 5; // primera + última + actual + vecinos + 2 elipsis

  if (total <= totalNumbers) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);

  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, ELLIPSIS, total];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, i) => total - rightCount + i + 1);
    return [1, ELLIPSIS, ...rightRange];
  }

  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, ELLIPSIS, ...middleRange, ELLIPSIS, total];
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  // Con un vecino por lado la ventana llega a 7 casillas: 7×40px + flechas ≈ 416px,
  // más ancho que un celular. Sin vecinos son 5 (1 … actual … última) y caben.
  // Es un conteo de elementos, no un estilo, por eso no se resuelve con CSS.
  const isWide = useMediaQuery('(min-width: 640px)');

  if (totalPages <= 1) return null;

  const pageWindow = getPageWindow(currentPage, totalPages, isWide ? 1 : 0);

  return (
    <div className="flex justify-center items-center gap-1.5 sm:gap-2 mt-6 sm:mt-10">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        aria-label="Página anterior"
        className="p-2 rounded-xl bg-white border border-mm-crd text-mm-g disabled:opacity-30 disabled:cursor-not-allowed hover:bg-mm-gbg transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex gap-1.5 sm:gap-2">
        {pageWindow.map((page, i) =>
          page === ELLIPSIS ? (
            <span
              key={`ellipsis-${i}`}
              className="w-6 sm:w-10 h-10 flex items-center justify-center text-sm text-mm-txw select-none"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              aria-current={currentPage === page ? 'page' : undefined}
              className={cn(
                "w-10 h-10 rounded-xl font-bold text-sm transition-all",
                currentPage === page
                  ? "bg-mm-g text-white shadow-md"
                  : "bg-white border border-mm-crd text-mm-txs hover:bg-mm-gbg"
              )}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        aria-label="Página siguiente"
        className="p-2 rounded-xl bg-white border border-mm-crd text-mm-g disabled:opacity-30 disabled:cursor-not-allowed hover:bg-mm-gbg transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
