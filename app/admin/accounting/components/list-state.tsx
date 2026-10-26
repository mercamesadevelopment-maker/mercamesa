import { Loader2 } from 'lucide-react';

/** Cargando o con error en lugar del listado. */
export function ListState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  if (error) return <div className="rounded-2xl bg-rl px-4 py-3 text-sm font-medium text-r">{error}</div>;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-mm-txw" />
      </div>
    );
  }
  return <>{children}</>;
}
