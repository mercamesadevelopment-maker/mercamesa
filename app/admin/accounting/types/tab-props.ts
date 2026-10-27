/** Lo que recibe cada pestaña de listado: los filtros para la API y la paginación de la tabla. */
export interface AccountingTabProps {
  query: string;
  pagination: {
    page: number;
    onPageChange: (page: number) => void;
    rowsPerPage: number;
    onRowsPerPageChange: (rows: number) => void;
    rowsPerPageOptions: number[];
  };
}

export function totalPages(data: { total: number; pageSize: number } | null): number {
  return data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
}
