/**
 * Geocodificación con Mapbox.
 *
 * Todo lo que sabe de la forma de Mapbox vive acá: el resto del código habla en
 * `GeocodeResult`, así que cambiar de proveedor después es un solo archivo.
 *
 * Sobre el modo permanente y el costo, que es lo que hay que tener presente al
 * tocar esto:
 *
 * - `permanent=false` (temporal) es gratis hasta 100.000 consultas al mes, pero
 *   los términos de Mapbox **prohíben almacenar la respuesta**. Sirve para las
 *   sugerencias que solo mueven el mapa.
 * - `permanent=true` es la única forma legal de guardar la coordenada en la base
 *   de forma indefinida. No tiene capa gratuita en esta cuenta: cuesta US$5 por
 *   cada 1.000, o sea medio centavo por dirección guardada.
 *
 * Por eso se llama **una sola vez por dirección**, cuando el comprador confirma
 * una sugerencia, y nunca en el rebote del buscador. Mandarla por tecla sería el
 * error más caro posible.
 */

/**
 * Qué tan fino es el punto que devolvió el geocodificador.
 *
 * Importa más de lo que parece: al buscar un punto de interés —"Universidad
 * CES", "Plaza Minorista"— Mapbox no falla, devuelve **el centro de la ciudad**.
 * El comprador ve un pin en el mapa, lo da por bueno, y el mensajero termina en
 * el centro de Medellín. Verificado con las direcciones reales de la base.
 *
 * Por eso el resultado viaja etiquetado y la interfaz avisa cuando es
 * `approximate`, en vez de tratar todos los puntos como iguales.
 */
export type GeocodePrecision = 'exact' | 'street' | 'approximate';

/** Forma normalizada, independiente del proveedor. */
export interface GeocodeResult {
  /** Texto completo para mostrar en la lista de sugerencias. */
  label: string;
  addressLine: string;
  neighborhood: string;
  municipality: string;
  department: string;
  latitude: number;
  longitude: number;
  precision: GeocodePrecision;
}

/**
 * Por qué falló la geocodificación.
 *
 * El comprador siempre ve el mismo mensaje, pero la causa viaja aparte porque
 * desde fuera son indistinguibles y llevan a arreglos opuestos: falta una
 * variable de entorno, el token no sirve, o Mapbox se cayó.
 */
export type GeocodingErrorCode =
  /** No hay `MAPBOX_SERVER_TOKEN`. En Vercel, agregarla exige redesplegar. */
  | 'not_configured'
  /** Mapbox rechazó el token: valor incorrecto, o creado CON restricción de URL. */
  | 'token_rejected'
  /** Mapbox respondió mal por otra razón, o no respondió. */
  | 'upstream';

export class GeocodingError extends Error {
  constructor(
    message: string,
    readonly code: GeocodingErrorCode = 'upstream',
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'GeocodingError';
  }
}

/** Mensaje único hacia el comprador cuando Mapbox no responde. */
export const GEOCODING_UNAVAILABLE_MESSAGE =
  'No pudimos buscar la dirección en este momento. Puedes marcar el punto directamente en el mapa.';

const MAPBOX_BASE = 'https://api.mapbox.com/search/geocode/v6';

/**
 * Sesga la búsqueda al Valle de Aburrá para que "Calle 45" resuelva primero
 * acá y no en Bogotá.
 */
const PROXIMITY = '-75.5812,6.2442'; // Medellín

/**
 * Límites de Colombia continental e insular.
 *
 * Un punto fuera de este recuadro casi siempre significa latitud y longitud
 * invertidas, que es el error clásico al copiar coordenadas a mano.
 */
const COLOMBIA_BOUNDS = {
  minLat: -4.3,
  maxLat: 13.5,
  minLon: -82,
  maxLon: -66.8,
};

/**
 * Convierte a número lo que venga del cliente.
 *
 * Devuelve `null` para la cadena vacía a propósito. `Number('')` es 0, y un 0
 * que se cuela hasta Pibox no falla: manda al mensajero al punto (0,0), en el
 * golfo de Guinea, sin un solo error visible.
 */
export function toCoordinate(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Devuelve el motivo del rechazo, o `null` si el punto es válido. */
export function validateColombiaCoordinates(
  latitude: number | null,
  longitude: number | null
): string | null {
  if (latitude === null || longitude === null) {
    return 'La dirección necesita un punto marcado en el mapa para poder despacharla.';
  }

  if (
    latitude < COLOMBIA_BOUNDS.minLat ||
    latitude > COLOMBIA_BOUNDS.maxLat ||
    longitude < COLOMBIA_BOUNDS.minLon ||
    longitude > COLOMBIA_BOUNDS.maxLon
  ) {
    return 'El punto marcado no está en Colombia. Verifica la ubicación en el mapa.';
  }

  return null;
}

function getToken(): string {
  // Token distinto del público, y no es opcional: Mapbox lo obliga.
  //
  // El token del navegador va restringido por URL, que es su única protección
  // real. Pero esa restricción se comprueba con la cabecera `Referer`, y una
  // petición desde el servidor no la manda: **un token con restricción de URL
  // responde 403 desde el backend**. Así que un solo token no puede hacer los
  // dos trabajos.
  //
  // Ojo: no hay un scope de geocoding. Cualquier token puede geocodificar, así
  // que este no necesita ningún permiso especial — necesita NO tener restricción
  // de URL, y no salir nunca del servidor.
  const serverToken = process.env.MAPBOX_SERVER_TOKEN;
  if (serverToken) return serverToken;

  // En desarrollo se cae al token público para no bloquear las pruebas mientras
  // se crea el de servidor. En producción NO: un despiste ahí significaría dejar
  // el token de geocoding permanente expuesto en el navegador, así que preferimos
  // que la búsqueda falle a que funcione de forma insegura.
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) {
    console.warn(
      '[geocoding] Usando NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN porque falta MAPBOX_SERVER_TOKEN. ' +
        'Solo para desarrollo: en producción esto es un error.'
    );
    return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  }

  throw new GeocodingError(
    'Falta configurar MAPBOX_SERVER_TOKEN en el servidor.',
    'not_configured'
  );
}

/** Extrae una propiedad del contexto de Mapbox v6, que viene como objeto. */
function contextName(context: Record<string, any> | undefined, key: string): string {
  return context?.[key]?.name ?? '';
}

function toPrecision(featureType: string | undefined): GeocodePrecision {
  if (featureType === 'address') return 'exact';
  if (featureType === 'street') return 'street';
  // 'place', 'locality', 'region', 'postcode', 'district'… todos son centroides.
  return 'approximate';
}

function toResult(feature: any): GeocodeResult | null {
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const longitude = Number(coords[0]);
  const latitude = Number(coords[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const props = feature.properties ?? {};
  const context = props.context ?? {};

  // `place` es el municipio y `region` el departamento. De acá sale la
  // normalización que acaba con los "Antiqouia" y los "sabaneta" en minúscula.
  const municipality =
    contextName(context, 'place') || contextName(context, 'locality') || '';
  const department = contextName(context, 'region');
  const neighborhood =
    contextName(context, 'neighborhood') || contextName(context, 'locality') || '';

  const addressLine = props.name_preferred || props.name || props.full_address || '';

  return {
    label: props.full_address || props.name || addressLine,
    addressLine,
    neighborhood,
    municipality,
    department,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    precision: toPrecision(props.feature_type),
  };
}

async function callMapbox(url: URL): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url.toString(), { cache: 'no-store' });
  } catch (err) {
    throw new GeocodingError('No se pudo contactar a Mapbox.', 'upstream', err);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    // 401/403 es el token, no el servicio. El 403 es el caso que hay que poder
    // reconocer de un vistazo: pasa cuando el token se creó CON restricción de
    // URL, que desde el servidor —sin cabecera `Referer`— Mapbox rechaza.
    const code =
      response.status === 401 || response.status === 403 ? 'token_rejected' : 'upstream';

    throw new GeocodingError(
      `Mapbox respondió ${response.status}: ${detail.slice(0, 200)}`,
      code
    );
  }

  return response.json();
}

/**
 * Busca direcciones por texto.
 *
 * `permanent` en `false` salvo que el comprador esté confirmando la que va a
 * guardar. Ver la nota de costos arriba.
 */
export async function searchAddresses(
  query: string,
  options: { permanent?: boolean; limit?: number } = {}
): Promise<GeocodeResult[]> {
  const { permanent = false, limit = 5 } = options;

  const url = new URL(`${MAPBOX_BASE}/forward`);
  url.searchParams.set('q', query);
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('country', 'co');
  url.searchParams.set('language', 'es');
  url.searchParams.set('proximity', PROXIMITY);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('permanent', String(permanent));

  const json = await callMapbox(url);

  return ((json?.features ?? []) as any[])
    .map(toResult)
    .filter((r): r is GeocodeResult => r !== null);
}

/**
 * Geocodificación inversa: de un punto a su dirección.
 *
 * Se usa cuando el comprador arrastra el pin, para rellenar municipio y
 * departamento con el valor normalizado del punto donde lo dejó.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { permanent?: boolean } = {}
): Promise<GeocodeResult | null> {
  const { permanent = false } = options;

  const url = new URL(`${MAPBOX_BASE}/reverse`);
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('access_token', getToken());
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '1');
  url.searchParams.set('permanent', String(permanent));

  const json = await callMapbox(url);
  const feature = (json?.features ?? [])[0];

  return feature ? toResult(feature) : null;
}
