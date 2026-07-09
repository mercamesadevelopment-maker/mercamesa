import { siigoFetch } from "../client";
import { SiigoDocumentType } from "../types";

/**
 * Obtiene los tipos de documentos de Siigo.
 * Si se especifica el parámetro `type` (por ejemplo, 'FV' para Factura de Venta), se filtrará por ese tipo.
 */
export async function getDocumentTypes(type?: string): Promise<SiigoDocumentType[]> {
  try {
    let endpoint = "/v1/document-types";
    if (type) {
      endpoint += `?type=${encodeURIComponent(type)}`;
    }

    return await siigoFetch<SiigoDocumentType[]>(endpoint, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("Error al obtener tipos de documentos de Siigo:", error);
    throw new Error(`No se pudieron obtener los tipos de documentos de Siigo: ${error.message}`);
  }
}
