import { siigoFetch } from "../../client";
import { SiigoProductQueryParams, SiigoProductsResponse } from "../../types";

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
