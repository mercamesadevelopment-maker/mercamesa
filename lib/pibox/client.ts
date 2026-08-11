const DEFAULT_BASE_URL = 'https://turing.thetrancon.com/api/third';

/** El kill-switch permite mergear la integración inerte hasta activarla. */
export function isPiboxEnabled(): boolean {
  return process.env.PIBOX_ENABLED === 'true';
}

export function getPiboxServiceTypeId(): string {
  // Mensajería en moto por defecto (ver "Servicios de carga" en docs/picap.MD)
  return process.env.PIBOX_SERVICE_TYPE_ID || '5c71b03a58b9ba10fa6393cf';
}

export function getPiboxDefaultPackageSizeCd(): number {
  const parsed = Number(process.env.PIBOX_DEFAULT_PACKAGE_SIZE_CD);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3 ? parsed : 2;
}

/**
 * Realiza una petición a la API de Pibox.
 *
 * A diferencia de Siigo, Pibox NO usa un header Authorization: el token viaja
 * como query param `?t=`, así que se inyecta en la URL.
 */
export async function piboxFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = process.env.PIBOX_API_TOKEN;
  const baseUrl = process.env.PIBOX_API_URL || DEFAULT_BASE_URL;

  if (!token) {
    throw new Error('Falta la variable de entorno PIBOX_API_TOKEN.');
  }

  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = new URL(`${baseUrl.replace(/\/$/, '')}${formattedEndpoint}`);
  url.searchParams.set('t', token);

  const response = await fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers as Record<string, string>),
    },
    cache: 'no-store',
  });

  const rawBody = await response.text();

  if (!response.ok) {
    // Pibox responde los errores como 422 con { "mssg": "..." }
    let message = rawBody;
    try {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed.mssg === 'string') message = parsed.mssg;
    } catch {
      // El cuerpo no era JSON: se deja el texto crudo
    }
    throw new Error(`Error en API Pibox (${response.status}): ${message}`);
  }

  if (!rawBody) return undefined as T;
  return JSON.parse(rawBody) as T;
}
