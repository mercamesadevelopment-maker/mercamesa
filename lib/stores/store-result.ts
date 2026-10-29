/** Lo que responde una ruta de tiendas: el estado HTTP y el cuerpo. */
export interface StoreResult {
  status: number;
  body: Record<string, unknown>;
}

export const storeError = (status: number, error: string): StoreResult => ({ status, body: { error } });
