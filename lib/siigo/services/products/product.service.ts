import { siigoFetch } from "../../client";
import { SiigoProductPayload, SiigoProductQueryParams, SiigoProductsResponse } from "../../types";

/**
 * Obtiene el listado de productos de Siigo aplicando filtros y paginación.
 */
export async function getProducts(
  params: SiigoProductQueryParams = {}
): Promise<SiigoProductsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.code) searchParams.append("code", params.code);
    if (params.created_start) searchParams.append("created_start", params.created_start);
    if (params.created_end) searchParams.append("created_end", params.created_end);
    if (params.updated_start) searchParams.append("updated_start", params.updated_start);
    if (params.updated_end) searchParams.append("updated_end", params.updated_end);
    if (params.ids) searchParams.append("ids", params.ids);
    if (params.page !== undefined) searchParams.append("page", String(params.page));
    if (params.page_size !== undefined) searchParams.append("page_size", String(params.page_size));

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/v1/products?${queryString}` : "/v1/products";

    return await siigoFetch<SiigoProductsResponse>(endpoint, {
      method: "GET",
    });
  } catch (error: any) {
    console.error("Error al obtener productos de Siigo:", error);
    throw new Error(`No se pudieron obtener los productos de Siigo: ${error.message}`);
  }
}

/**
 * Crea un producto en Siigo.
 *
 * `already_exists` se trata como éxito: los 506 productos que ya estaban en
 * Siigo antes de esta integración deben reconciliarse sin duplicarse ni romper
 * la sincronización.
 */
export async function createProduct(
  payload: SiigoProductPayload
): Promise<{ created: boolean; alreadyExists: boolean }> {
  try {
    await siigoFetch("/v1/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return { created: true, alreadyExists: false };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("already_exists") || message.includes("already exists")) {
      return { created: false, alreadyExists: true };
    }

    throw error;
  }
}
