import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/src/components/Shared';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex justify-center items-center gap-2 mt-10">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="p-2 rounded-xl bg-white border border-mm-crd text-mm-g disabled:opacity-30 disabled:cursor-not-allowed hover:bg-mm-gbg transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "w-10 h-10 rounded-xl font-bold text-sm transition-all",
              currentPage === page
                ? "bg-mm-g text-white shadow-md"
                : "bg-white border border-mm-crd text-mm-txs hover:bg-mm-gbg"
            )}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="p-2 rounded-xl bg-white border border-mm-crd text-mm-g disabled:opacity-30 disabled:cursor-not-allowed hover:bg-mm-gbg transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
