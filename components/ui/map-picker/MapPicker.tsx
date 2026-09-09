'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin, Search, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import type { GeocodeResult } from '@/lib/geocoding/mapbox';

/**
 * Lo que el mapa devuelve hacia arriba.
 *
 * Cuando el punto viene de una búsqueda trae además municipio y departamento ya
 * normalizados por Mapbox; cuando el comprador marca a mano, solo las
 * coordenadas.
 */
export interface MapPickerChange {
  latitude: number;
  longitude: number;
  addressLine?: string;
  neighborhood?: string;
  municipality?: string;
  department?: string;
}

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (change: MapPickerChange) => void;
  /** Centro inicial cuando todavía no hay coordenadas. Por defecto, Medellín. */
  fallbackCenter?: { lat: number; lon: number };
  label?: string;
  helpText?: string;
  /** Texto de arranque del buscador, para reusar lo que ya escribió el usuario. */
  initialQuery?: string;
}

const DEFAULT_CENTER = { lat: 6.2442, lon: -75.5812 }; // Medellín
const MIN_QUERY_LENGTH = 4;
const DEBOUNCE_MS = 400;

const MARKER_HTML =
  '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#1B4332;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>';

/**
 * Selector de ubicación sobre teselas de Mapbox.
 *
 * Usa Leaflet directamente (sin react-leaflet) para evitar problemas de
 * compatibilidad con React 19, y carga la librería dinámicamente porque
 * necesita `window`.
 *
 * El pin es la fuente de verdad, no el geocodificador: se puede arrastrar.
 * Buscar una dirección solo lo acerca; quien confirma el punto exacto —el
 * portón, la unidad— es el comprador.
 */
export function MapPicker({
  latitude,
  longitude,
  onChange,
  fallbackCenter = DEFAULT_CENTER,
  label = 'Ubicación exacta en el mapa',
  helpText = 'Busca tu dirección o toca el mapa para marcar el punto exacto. El mensajero lo usa para encontrarte.',
  initialQuery = '',
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [approximate, setApproximate] = useState(false);
  /** Evita que el efecto de búsqueda se dispare por el texto que él mismo puso. */
  const suppressSearchRef = useRef(false);

  // Mantiene el callback fresco sin re-crear el mapa en cada render
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /** Coloca o mueve el pin, creándolo si hace falta. */
  const placeMarker = useCallback((lat: number, lon: number, zoom?: number) => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    } else {
      const icon = L.divIcon({
        className: '',
        html: MARKER_HTML,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([lat, lon], { icon, draggable: true }).addTo(map);

      // Arrastrar el pin es lo que corrige un geocodificado impreciso, así que
      // el resultado deja de ser "aproximado" en cuanto el usuario lo mueve.
      marker.on('dragend', () => {
        const { lat: dLat, lng: dLng } = marker.getLatLng();
        setApproximate(false);
        onChangeRef.current({
          latitude: Number(dLat.toFixed(6)),
          longitude: Number(dLng.toFixed(6)),
        });
      });

      markerRef.current = marker;
    }

    if (zoom !== undefined) map.setView([lat, lon], zoom);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      leafletRef.current = L;

      const center: [number, number] =
        latitude !== null && longitude !== null
          ? [latitude, longitude]
          : [fallbackCenter.lat, fallbackCenter.lon];

      const map = L.map(containerRef.current).setView(center, latitude !== null ? 16 : 12);
      mapRef.current = map;

      // Teselas de Mapbox. Son de 512 px, así que sin `zoomOffset: -1` el mapa
      // queda con un nivel de zoom corrido. La atribución es obligatoria por
      // licencia y no se puede quitar.
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}?access_token=${token}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }
      ).addTo(map);

      if (latitude !== null && longitude !== null) {
        placeMarker(latitude, longitude);
      }

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        placeMarker(lat, lng);
        setApproximate(false);
        onChangeRef.current({
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
        });
      });

      // El contenedor suele montarse dentro de un modal que aún se está
      // animando; sin esto Leaflet calcula mal el tamaño y quedan tiles grises.
      setTimeout(() => map.invalidateSize(), 250);
    }

    initMap();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // Solo se inicializa una vez: los cambios de coordenadas se reflejan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refleja en el mapa las coordenadas que lleguen desde afuera.
  //
  // Antes esto solo actuaba si ya había marcador, así que una dirección que
  // arrancaba sin coordenadas y las recibía después no pintaba nada. Con
  // "Completar ubicación" desde el carrito ese es justo el caso habitual.
  useEffect(() => {
    if (!mapRef.current || latitude === null || longitude === null) return;
    placeMarker(latitude, longitude, 16);
  }, [latitude, longitude, placeMarker]);

  // Búsqueda con rebote. Va en modo temporal (gratis): estas consultas solo
  // mueven el mapa, no se guardan.
  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }

    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setShowResults(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setSearchError(null);
        const res = await fetch(`/api/geocoding/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error);
        setResults(json.data || []);
        setShowResults(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setSearchError(e instanceof Error ? e.message : 'No pudimos buscar la dirección.');
          setResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  /**
   * El comprador escogió una sugerencia.
   *
   * Acá —y solo acá— se pide el modo permanente, que es la única llamada que
   * cuesta dinero: una por dirección, nunca por tecla.
   */
  const handleSelect = async (result: GeocodeResult) => {
    setShowResults(false);
    suppressSearchRef.current = true;
    setQuery(result.label);
    setApproximate(result.precision === 'approximate');

    let confirmed = result;
    try {
      const res = await fetch(
        `/api/geocoding/search?q=${encodeURIComponent(result.label)}&confirm=1`
      );
      const json = await res.json();
      if (res.ok && json.data?.[0]) confirmed = json.data[0];
    } catch {
      // Si la confirmación falla, se usa el resultado que ya se tenía en
      // pantalla: el comprador ve el pin igual y puede arrastrarlo.
    }

    placeMarker(confirmed.latitude, confirmed.longitude, 17);
    onChangeRef.current({
      latitude: confirmed.latitude,
      longitude: confirmed.longitude,
      addressLine: confirmed.addressLine,
      neighborhood: confirmed.neighborhood,
      municipality: confirmed.municipality,
      department: confirmed.department,
    });
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no permite compartir la ubicación.');
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lon = Number(position.coords.longitude.toFixed(6));

        placeMarker(lat, lon, 17);
        setApproximate(false);
        onChangeRef.current({ latitude: lat, longitude: lon });
        setLocating(false);
      },
      () => {
        setGeoError('No pudimos obtener tu ubicación. Marca el punto en el mapa.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const hasCoords = latitude !== null && longitude !== null;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-medium text-mm-txs ml-1">{label}</label>
        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={locating}
          className="flex items-center gap-1.5 text-xs font-bold text-mm-g hover:text-mm-oro transition-colors disabled:opacity-50"
        >
          {locating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5" />
          )}
          Usar mi ubicación
        </button>
      </div>

      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mm-txw" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Busca tu dirección: Calle 78 sur 40-211, Sabaneta"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-mm-crd bg-white text-sm outline-none transition-all focus:border-mm-g"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-mm-txw" />
          )}
        </div>

        {showResults && results.length > 0 && (
          <ul className="absolute z-[400] mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-mm-crd bg-white shadow-lg">
            {results.map((r, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-mm-gbg"
                >
                  <span className="block text-mm-g">{r.label}</span>
                  {r.precision === 'approximate' && (
                    <span className="block text-[11px] text-amber-700">
                      Ubicación aproximada
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showResults && results.length === 0 && !searching && !searchError && (
          <p className="mt-1 ml-1 text-[11px] text-mm-txw">
            No encontramos esa dirección. Marca el punto en el mapa.
          </p>
        )}
      </div>

      {searchError && <p className="text-xs text-r font-medium ml-1">{searchError}</p>}

      <div
        ref={containerRef}
        className="w-full h-56 rounded-2xl border border-mm-crd overflow-hidden z-0"
      />

      {/* Un centroide de ciudad se ve igual de convincente que una dirección
          exacta, y es la trampa: el mensajero terminaría en el centro. */}
      {approximate && (
        <p className="ml-1 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Esta ubicación es aproximada, no la dirección exacta. Arrastra el pin hasta tu
          puerta para que el mensajero llegue bien.
        </p>
      )}

      {geoError && <p className="text-xs text-r font-medium ml-1">{geoError}</p>}

      <p className="text-[11px] text-mm-txw ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3 shrink-0" />
        {hasCoords
          ? `Ubicación marcada: ${latitude}, ${longitude} · puedes arrastrar el pin para ajustarla`
          : helpText}
      </p>
    </div>
  );
}
