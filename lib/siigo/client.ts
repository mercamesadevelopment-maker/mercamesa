import { getSiigoToken } from "./services/auth.service";

/**
 * Realiza una petición HTTP a la API de Siigo agregando automáticamente
 * la autenticación por Token de Portador y el Partner-Id de ser necesario.
 */
export async function siigoFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getSiigoToken();
  const partnerId = process.env.SIIGO_PARTNER_ID;
  const baseUrl = process.env.SIIGO_API_URL || "https://api.siigo.com";

  // Asegura que el endpoint empiece con / si es relativo
  const formattedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${baseUrl.replace(/\/$/, "")}${formattedEndpoint}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers as Record<string, string>),
  };

  if (partnerId) {
    headers["Partner-Id"] = partnerId;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error en API Siigo (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}
