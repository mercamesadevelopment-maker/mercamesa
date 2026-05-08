import { useState, useMemo } from 'react';

interface UseTableProps<T> {
  initialData: T[];
  initialRowsPerPage?: number;
}

export function useTable<T>({ initialData, initialRowsPerPage = 10 }: UseTableProps<T>) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return initialData;

    return [...initialData].sort((a, b) => {
      const aValue = (a as any)[sortKey];
      const bValue = (b as any)[sortKey];

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [initialData, sortKey, sortOrder]);

  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const totalPages = Math.ceil(initialData.length / rowsPerPage);

  return {
    page,
    setPage,
    rowsPerPage,
    setRowsPerPage,
    sortKey,
    sortOrder,
    handleSort,
    paginatedData,
    totalPages,
    totalItems: initialData.length
  };
}
