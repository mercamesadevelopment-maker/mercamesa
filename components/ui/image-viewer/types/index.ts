/** El punto desde el que se acerca la foto, en porcentaje de su ancho y alto. */
export interface ZoomOrigin {
  x: number;
  y: number;
}

export interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  /** La foto en su mejor resolución. */
  src: string;
  /**
   * Una versión pequeña que ya está en caché (la de la tarjeta). Se ve de una vez
   * mientras baja `src`, y se queda si `src` no carga.
   */
  placeholderSrc?: string | null;
  alt: string;
  /** Texto bajo la foto; si falta, no se muestra nada. */
  caption?: string;
}
