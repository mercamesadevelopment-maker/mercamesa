'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lon: number) => void;
  /** Centro inicial cuando todavía no hay coordenadas. Por defecto, Medellín. */
  fallbackCenter?: { lat: number; lon: number };
  label?: string;
  helpText?: string;
}

const DEFAULT_CENTER = { lat: 6.2442, lon: -75.5812 }; // Medellín

/**
 * Selector de ubicación sobre OpenStreetMap.
 *
 * Usa Leaflet directamente (sin react-leaflet) para evitar problemas de
 * compatibilidad con React 19, y carga la librería dinámicamente porque
 * necesita `window`.
 */
export function MapPicker({
  latitude,
  longitude,
  onChange,
  fallbackCenter = DEFAULT_CENTER,
  label = 'Ubicación exacta en el mapa',
  helpText = 'Toca el mapa para marcar el punto exacto. El mensajero lo usa para encontrarte.',
}: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Mantiene el callback fresco sin re-crear el mapa en cada render
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const center: [number, number] =
        latitude !== null && longitude !== null
          ? [latitude, longitude]
          : [fallbackCenter.lat, fallbackCenter.lon];

      const map = L.map(containerRef.current).setView(center, latitude !== null ? 16 : 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // divIcon en vez del icono por defecto: el default de Leaflet apunta a
      // imágenes que los bundlers rompen.
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#1B4332;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      if (latitude !== null && longitude !== null) {
        markerRef.current = L.marker([latitude, longitude], { icon }).addTo(map);
      }

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }
        onChangeRef.current(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
      });

      mapRef.current = map;

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

  // Refleja en el mapa las coordenadas que lleguen desde afuera
  useEffect(() => {
    if (!mapRef.current || latitude === null || longitude === null) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], 16);
    }
  }, [latitude, longitude]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no permite compartir la ubicación.');
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lon = Number(position.coords.longitude.toFixed(6));

        const L = (await import('leaflet')).default;
        if (mapRef.current) {
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
          } else {
            const icon = L.divIcon({
              className: '',
              html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:#1B4332;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
              iconSize: [28, 28],
              iconAnchor: [14, 28],
            });
            markerRef.current = L.marker([lat, lon], { icon }).addTo(mapRef.current);
          }
          mapRef.current.setView([lat, lon], 17);
        }

        onChangeRef.current(lat, lon);
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

      <div
        ref={containerRef}
        className="w-full h-56 rounded-2xl border border-mm-crd overflow-hidden z-0"
      />

      {geoError && <p className="text-xs text-r font-medium ml-1">{geoError}</p>}

      <p className="text-[11px] text-mm-txw ml-1 flex items-center gap-1.5">
        <MapPin className="w-3 h-3 shrink-0" />
        {hasCoords
          ? `Ubicación marcada: ${latitude}, ${longitude}`
          : helpText}
      </p>
    </div>
  );
}
