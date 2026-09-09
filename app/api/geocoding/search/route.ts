import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  searchAddresses,
  reverseGeocode,
  GeocodingError,
  GEOCODING_UNAVAILABLE_MESSAGE,
  toCoordinate,
} from '@/lib/geocoding/mapbox';

const MIN_QUERY_LENGTH = 4;

/**
 * Proxy de geocodificación.
 *
 * Existe por dos razones, y ninguna es de comodidad:
 *
 * 1. El token de geocoding no puede viajar al navegador. `permanent=true` es la
 *    única línea de Mapbox que cuesta dinero; un token expuesto se copia y se
 *    gasta.
 * 2. `permanent=true` solo se decide acá. El cliente no puede pedirlo: manda
 *    `confirm=1` y es el servidor quien traduce eso a una petición permanente,
 *    una sola vez, cuando el comprador ya escogió la dirección que va a guardar.
 *
 * Modos:
 *   ?q=<texto>            sugerencias (temporal, gratis)
 *   ?q=<texto>&confirm=1  la dirección elegida (permanente, almacenable)
 *   ?lat=&lon=            inversa, para cuando se arrastra el pin
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').trim();
    const confirm = searchParams.get('confirm') === '1';
    const lat = toCoordinate(searchParams.get('lat'));
    const lon = toCoordinate(searchParams.get('lon'));

    if (lat !== null && lon !== null) {
      // La inversa se dispara al soltar el pin, así que también puede terminar
      // guardándose: si viene con confirm, va permanente.
      const result = await reverseGeocode(lat, lon, { permanent: confirm });
      return NextResponse.json({ data: result ? [result] : [] }, { status: 200 });
    }

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ data: [] }, { status: 200 });
    }

    const results = await searchAddresses(query, {
      permanent: confirm,
      // Al confirmar solo interesa la que el comprador escogió.
      limit: confirm ? 1 : 5,
    });

    return NextResponse.json({ data: results }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof GeocodingError) {
      // El detalle (incluido el estado que devolvió Mapbox) queda en el log; al
      // comprador se le dice qué hacer, que es marcar el punto a mano.
      console.error('geocoding/search:', error.code, error.message, error.cause ?? '');

      // `code` acompaña al mensaje para poder diagnosticar sin leer los logs del
      // servidor. No revela nada: solo distingue "falta la variable" de "el token
      // fue rechazado", que desde fuera se ven igual y se arreglan distinto.
      return NextResponse.json(
        { error: GEOCODING_UNAVAILABLE_MESSAGE, code: error.code },
        { status: 503 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
