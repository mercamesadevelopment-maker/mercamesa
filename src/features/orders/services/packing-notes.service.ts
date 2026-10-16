/** Guarda cómo va empacada la parte de la tienda. Devuelve la nota guardada. */
export async function savePackingNotes(storeOrderId: string, packingNotes: string): Promise<string | null> {
  const res = await fetch(`/api/store-orders/${storeOrderId}/packing-notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packingNotes }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? 'No pudimos guardar las notas de empaque.');
  return json.data?.packingNotes ?? null;
}
