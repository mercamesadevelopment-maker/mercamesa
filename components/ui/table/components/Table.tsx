import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { TableProps } from '../types';
import { cn } from '@/src/components/Shared';

export function Table<T>({
  data,
  columns,
  sortKey,
  sortOrder,
  onSort,
  page,
  totalPages,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 20, 50],
  emptyMessage = 'No hay datos disponibles',
  actions
}: TableProps<T>) {
  return (
    <div className="bg-white rounded-3xl border border-mm-crd shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-mm-gbg/50 border-b border-mm-crd">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest",
                    col.sortable && "cursor-pointer hover:bg-mm-gbg/80 transition-colors"
                  )}
                  onClick={() => col.sortable && onSort?.(col.key)}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
              {actions && (
                <th className="px-6 py-4 text-xs font-bold text-mm-txw uppercase tracking-widest">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-mm-crd">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-8 text-center text-mm-txw text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr key={index} className="hover:bg-mm-gbg/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      {col.render ? col.render(item) : (item as any)[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-6 py-4">
                      {actions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(page !== undefined && totalPages !== undefined) && (
        <div className="border-t border-mm-crd bg-mm-gbg/30 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-mm-txs">
            <span>Mostrar</span>
            <select
              value={rowsPerPage}
              onChange={(e) => onRowsPerPageChange?.(Number(e.target.value))}
              className="bg-white border border-mm-crd rounded px-2 py-1 outline-none focus:ring-2 focus:ring-mm-g/20"
            >
              {rowsPerPageOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span>por página</span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-mm-txs">
              Página <span className="font-bold text-mm-g">{page}</span> de <span className="font-bold text-mm-g">{totalPages || 1}</span>
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onPageChange?.(page - 1)}
                disabled={page <= 1}
                className="p-1 rounded hover:bg-mm-gbg text-mm-txw hover:text-mm-g disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => onPageChange?.(page + 1)}
                disabled={page >= totalPages}
                className="p-1 rounded hover:bg-mm-gbg text-mm-txw hover:text-mm-g disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
