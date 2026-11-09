'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Images, X } from 'lucide-react';
import { PHOTO_MAX_BYTES, PHOTO_TYPES } from '@/lib/storage/photo-rules';
import { useMediaQuery } from '@/features/layout/hooks/use-media-query';

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** Cuántas fotos caben. */
  max: number;
  required?: boolean;
  /** El título encima de las fotos. */
  label?: string;
}

const ACCEPT = Object.keys(PHOTO_TYPES).join(',');

const BOTON =
  'w-20 h-20 rounded-xl border-1.5 border-dashed border-mm-crd text-mm-txw hover:border-mm-g hover:text-mm-g transition-colors flex flex-col items-center justify-center gap-1 text-[11px] font-medium';

/**
 * Elegir fotos con su vista previa (PQRS, recepción en la bahía).
 *
 * En una pantalla táctil hay dos botones: «Tomar foto» abre la cámara
 * (`capture`) y «Galería» las fotos guardadas. Antes había uno solo, sin
 * `capture` y con los tipos sueltos en `accept`, y en varios Android abría el
 * explorador de archivos sin ofrecer la cámara. En el escritorio `capture` no
 * hace nada, así que queda solo «Galería».
 *
 * No sube nada: las fotos se suben al enviar. Así, cerrar el formulario sin
 * enviar no deja archivos sueltos.
 */
export function PhotoPicker({ files, onChange, max, required, label = 'Fotos' }: PhotoPickerProps) {
  const galeriaRef = useRef<HTMLInputElement>(null);
  const camaraRef = useRef<HTMLInputElement>(null);
  const tactil = useMediaQuery('(pointer: coarse)');
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidas = Array.from(e.target.files ?? []);
    // Para poder volver a elegir la misma foto después de quitarla.
    e.target.value = '';

    const validas = elegidas.filter(
      (f) => PHOTO_TYPES[f.type] && f.size <= PHOTO_MAX_BYTES
    );
    const cabe = max - files.length;

    if (validas.length < elegidas.length) {
      setError('Algunas fotos no se agregaron: deben ser JPG, PNG o WebP de hasta 8 MB.');
    } else if (validas.length > cabe) {
      setError(`Puedes adjuntar hasta ${max} fotos.`);
    } else {
      setError(null);
    }

    onChange([...files, ...validas.slice(0, Math.max(0, cabe))]);
  };

  return (
    <div>
      <p className="text-sm font-medium text-mm-txs ml-1 mb-1.5">
        {label} {required ? <span className="text-r">(obligatoria)</span> : <span className="text-mm-txw">(opcional)</span>}
      </p>

      <div className="flex flex-wrap gap-2">
        {previews.map((url, i) => (
          <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-mm-crd">
            <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(files.filter((_, idx) => idx !== i))}
              aria-label={`Quitar la foto ${i + 1}`}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {files.length < max && (
          <>
            {tactil && (
              <button type="button" onClick={() => camaraRef.current?.click()} className={BOTON}>
                <Camera className="w-5 h-5" />
                Tomar foto
              </button>
            )}
            <button type="button" onClick={() => galeriaRef.current?.click()} className={BOTON}>
              <Images className="w-5 h-5" />
              {tactil ? 'Galería' : 'Agregar'}
            </button>
          </>
        )}
      </div>

      {/* `image/*` y no la lista de tipos: con la lista, algunos Android no
          ofrecen la cámara. La validación de abajo descarta lo que no sea
          JPG, PNG o WebP; la cámara entrega JPEG. */}
      <input ref={camaraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFiles} />
      <input ref={galeriaRef} type="file" accept={ACCEPT} multiple hidden onChange={handleFiles} />

      {error && <p className="text-xs text-r ml-1 mt-1.5">{error}</p>}
    </div>
  );
}
