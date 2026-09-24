import { toCoordinate, validateColombiaCoordinates } from '@/lib/geocoding/mapbox';

/**
 * La dirección de recogida de la tienda, validada antes de guardarla.
 *
 * Es el punto donde el mensajero recoge cuando la tienda no despacha desde su
 * plaza. Si se deja vacía se sigue usando la dirección de la plaza, que es lo
 * que hace hoy la mayoría de las tiendas.
 *
 * Se valida acá, en el servidor, y no solo en el formulario: las rutas de plazas
 * confían en la validación del cliente y eso deja la puerta abierta a que una
 * coordenada mala entre por una llamada directa a la API. Un punto equivocado no
 * falla —Pibox cotiza igual— y el mensajero aparece donde no es.
 */

export const PICKUP_TEXT_FIELDS = ['address', 'city', 'department'] as const;

interface Resultado {
  /** Columnas listas para el `update`/`insert`. Vacío si el body no trae nada. */
  fields: Record<string, unknown>;
  error?: undefined;
}

interface Fallo {
  fields?: undefined;
  error: string;
}

/**
 * Lee del body los campos de recogida y los devuelve listos para guardar.
 *
 * Reglas:
 * - Si el body no menciona ninguno, no se toca nada (`fields` vacío).
 * - Dirección y coordenadas van SIEMPRE juntas. Una dirección sin punto en el
 *   mapa obliga a Pibox a geocodificar el texto contra el `city_code` del
 *   DESTINO, y así es como un paquete termina recogiéndose en otra ciudad.
 * - Vaciar la dirección limpia también las coordenadas: media dirección es peor
 *   que ninguna, porque parece cargada.
 */
export function parsePickupAddress(body: Record<string, unknown>): Resultado | Fallo {
  const mencionado =
    PICKUP_TEXT_FIELDS.some((f) => body[f] !== undefined) ||
    body.latitude !== undefined ||
    body.longitude !== undefined;

  if (!mencionado) return { fields: {} };

  const texto = (valor: unknown): string | null => {
    if (valor === null || valor === undefined) return null;
    const limpio = String(valor).trim();
    return limpio === '' ? null : limpio;
  };

  const address = texto(body.address);
  const latitude = toCoordinate(body.latitude);
  const longitude = toCoordinate(body.longitude);

  if (!address) {
    // Vaciar la dirección Y el punto es quitar la dirección de recogida: es una
    // operación legítima y se limpia todo el bloque.
    if (latitude === null && longitude === null) {
      return {
        fields: {
          address: null,
          latitude: null,
          longitude: null,
          city: texto(body.city),
          department: texto(body.department),
        },
      };
    }

    // Pero un punto SIN dirección no se descarta en silencio. Antes caía en la
    // rama de arriba y borraba las coordenadas que el usuario acababa de marcar,
    // devolviendo 200: el formulario decía "guardado" y el dato se perdía.
    return {
      error:
        'Marcaste un punto en el mapa pero falta la dirección. Escríbela o búscala para poder guardar.',
    };
  }

  const coordError = validateColombiaCoordinates(latitude, longitude);
  if (coordError) {
    return { error: coordError };
  }

  return {
    fields: {
      address,
      // `numeric(10,7)`: más decimales los rechaza la base.
      latitude: latitude!.toFixed(7),
      longitude: longitude!.toFixed(7),
      city: texto(body.city),
      department: texto(body.department),
    },
  };
}
