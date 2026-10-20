import type { SaleClient } from '@/lib/stores/sale-clients';

export type ClientData = SaleClient;

/**
 * Busca al cliente por documento o correo exactos (`/api/seller/clients`). Si no
 * es un cliente registrado pero sí un comprador con cuenta, vuelve con sus
 * datos y su `profile_id`.
 */
export async function searchClientByDocumentOrEmail(query: string): Promise<ClientData | null> {
  if (!query) return null;
  const response = await fetch(`/api/seller/clients?q=${encodeURIComponent(query)}`);
  if (!response.ok) return null;
  const result = await response.json().catch(() => ({}));
  return (result?.data as ClientData | null) ?? null;
}

/** Registra al cliente, o devuelve el que ya existe con ese documento. */
export async function saveClient(clientData: Omit<ClientData, 'id'>): Promise<ClientData | null> {
  const response = await fetch('/api/seller/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clientData),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Error saving client:', result?.error);
    return null;
  }
  return result.data as ClientData;
}
