import { siigoFetch } from "../client";
import { SiigoPaymentType } from "../types";

/**
 * Obtiene los tipos de métodos de pago de Siigo.
 * Si se especifica el parámetro `documentType` (por ejemplo, 'FV' para Factura de Venta), se filtrará por ese tipo.
 */
export async function getPaymentTypes(documentType?: string): Promise<SiigoPaymentType[]> {
  try {
    let endpoint = "/v1/payment-types";
    if (documentType) {
      endpoint += `?document_type=${encodeURIComponent(documentType)}`;
    }

    return await siigoFetch<SiigoPaymentType[]>(endpoint, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("Error al obtener métodos de pago de Siigo:", error);
    throw new Error(`No se pudieron obtener los métodos de pago de Siigo: ${error.message}`);
  }
}
