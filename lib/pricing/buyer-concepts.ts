/**
 * Los dos conceptos que el comprador ve en la canasta y en el detalle del
 * pedido, los mismos de la factura electrónica:
 *
 * - **Productos de terceros**: lo del tendero, los productos.
 * - **Domicilio**: todo lo de MercaMesa, el domicilio, los gastos
 *   administrativos y los gastos operativos (mensajes).
 *
 * No se habla de «servicio»: un servicio lleva IVA.
 */
export function buyerInvoiceConcepts(productsSubtotal: number, total: number) {
  const thirdPartyProducts = Math.max(0, productsSubtotal);
  return { thirdPartyProducts, delivery: Math.max(0, total - thirdPartyProducts) };
}
