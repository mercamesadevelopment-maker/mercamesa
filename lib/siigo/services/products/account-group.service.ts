import { siigoFetch } from "../../client";
import { SiigoAccountGroup } from "../../types";

/**
 * Obtiene el listado de grupos contables (account groups) de Siigo.
 */
export async function getAccountGroups(): Promise<SiigoAccountGroup[]> {
  try {
    return await siigoFetch<SiigoAccountGroup[]>("/v1/account-groups", {
      method: "GET",
    });
  } catch (error: any) {
    console.error("Error al obtener grupos contables de Siigo:", error);
    throw new Error(`No se pudieron obtener los grupos contables de Siigo: ${error.message}`);
  }
}
