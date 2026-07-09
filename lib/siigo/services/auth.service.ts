import { SiigoAuthResponse } from "../types";

let cachedToken: string | null = null;
let tokenExpirationTime: number = 0;

/**
 * Obtiene el token de acceso JWT para la API de Siigo.
 * Implementa caché en memoria para evitar llamadas innecesarias durante la vigencia del token (24h).
 */
export async function getSiigoToken(): Promise<string> {
  const username = process.env.SIIGO_USERNAME;
  const accessKey = process.env.SIIGO_ACCESS_KEY;
  const partnerId = process.env.SIIGO_PARTNER_ID;
  const baseUrl = process.env.SIIGO_API_URL || "https://api.siigo.com";

  if (!username || !accessKey) {
    throw new Error(
      "Faltan las variables de entorno de autenticación de Siigo (SIIGO_USERNAME o SIIGO_ACCESS_KEY)."
    );
  }

  // Retornar token en caché si sigue vigente (con un margen de seguridad de 1 minuto)
  if (cachedToken && Date.now() < tokenExpirationTime - 60000) {
    return cachedToken;
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (partnerId) {
      headers["Partner-Id"] = partnerId;
    }

    const authUrl = `${baseUrl.replace(/\/$/, "")}/auth`;

    const response = await fetch(authUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        username,
        access_key: accessKey,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en autenticación Siigo (${response.status}): ${errorText}`);
    }

    const data: SiigoAuthResponse = await response.json();

    cachedToken = data.access_token;
    tokenExpirationTime = Date.now() + data.expires_in * 1000;

    return cachedToken;
  } catch (error: any) {
    console.error("Error al obtener token de Siigo:", error);
    throw new Error(`No se pudo obtener el token de autenticación de Siigo: ${error.message}`);
  }
}
