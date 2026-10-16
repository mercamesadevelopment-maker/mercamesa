/**
 * Reglas de las notas de empaque que comparten el formulario y el servidor.
 * Puras: este archivo llega al navegador.
 */

/** El mismo tope que el check de `store_orders.packing_notes`. */
export const PACKING_NOTES_MAX = 500;

/** Estados en los que la parte sigue en el local y se puede corregir la nota. */
const EDITABLE = ['confirmed', 'paid', 'packing', 'at_collection'];

/**
 * Se puede editar mientras la parte no haya salido de la tienda: ni el
 * patinador la recogió ni logística la recibió.
 */
export function packingNotesEditable(part: {
  status: string;
  collectedAt: string | null | undefined;
  bayReceivedAt: string | null | undefined;
}): boolean {
  return EDITABLE.includes(part.status) && !part.collectedAt && !part.bayReceivedAt;
}
