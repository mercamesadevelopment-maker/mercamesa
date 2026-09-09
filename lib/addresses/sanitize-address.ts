import { toCoordinate, validateColombiaCoordinates } from '@/lib/geocoding/mapbox';

/**
 * Convierte el cuerpo que manda el navegador en algo seguro de escribir.
 *
 * Antes las rutas hacían `insert({ ...body })` y `update(body)` con el objeto
 * crudo. Eso permitía dos cosas concretas:
 *
 * 1. Escribir cualquier columna de la tabla. En el `PUT` incluía `buyer_id`: el
 *    filtro de propiedad corre sobre la fila vieja, así que un comprador podía
 *    **pasarle una dirección suya a otra cuenta**.
 * 2. Guardar `latitude: ''`. Pibox compara `=== null` estricto, así que una
 *    cadena vacía no se detecta como "sin coordenadas" y se envía
 *    `Number('') === 0`: el mensajero saldría hacia el punto (0,0), en el golfo
 *    de Guinea, sin ningún error visible.
 *
 * Por eso la lista de campos es explícita y las coordenadas pasan por
 * `toCoordinate`, que trata la cadena vacía como `null`.
 */

export interface SanitizedAddress {
  label: string | null;
  address_line: string;
  neighborhood: string | null;
  municipality: string;
  department: string;
  is_default: boolean;
  latitude: number;
  longitude: number;
}

export interface SanitizeResult {
  data?: SanitizedAddress;
  error?: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown): string | null {
  const v = text(value);
  return v === '' ? null : v;
}

export function sanitizeAddress(body: unknown): SanitizeResult {
  if (!body || typeof body !== 'object') {
    return { error: 'Cuerpo de la petición inválido.' };
  }

  const b = body as Record<string, unknown>;

  const addressLine = text(b.address_line);
  const municipality = text(b.municipality);
  const department = text(b.department);

  if (!addressLine) return { error: 'La dirección es obligatoria.' };
  if (!municipality) return { error: 'El municipio es obligatorio.' };
  if (!department) return { error: 'El departamento es obligatorio.' };

  const latitude = toCoordinate(b.latitude);
  const longitude = toCoordinate(b.longitude);

  const coordError = validateColombiaCoordinates(latitude, longitude);
  if (coordError) return { error: coordError };

  return {
    data: {
      label: optionalText(b.label),
      address_line: addressLine,
      neighborhood: optionalText(b.neighborhood),
      municipality,
      department,
      is_default: b.is_default === true,
      // El validador ya descartó null; el `!` es solo para el compilador.
      latitude: latitude!,
      longitude: longitude!,
    },
  };
}
