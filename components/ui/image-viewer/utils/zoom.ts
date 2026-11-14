import type { ZoomOrigin } from '../types';

/** Cuánto se acerca la foto al tocarla. */
export const ZOOM_SCALE = 2.5;

/** Movimiento, en px, por debajo del cual un toque cuenta como toque y no como arrastre. */
export const TAP_TOLERANCE = 6;

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * El punto de la foto bajo el cursor o el dedo, en porcentaje. Es el
 * `transform-origin`: al escalar desde ahí, ese punto no se mueve y es lo que
 * queda en primer plano.
 */
export function originFromPoint(box: Box, clientX: number, clientY: number): ZoomOrigin {
  if (box.width <= 0 || box.height <= 0) return { x: 50, y: 50 };
  return {
    x: clamp(((clientX - box.left) / box.width) * 100),
    y: clamp(((clientY - box.top) / box.height) * 100),
  };
}

/**
 * Arrastrar la foto acercada: si el dedo va a la derecha, la foto va a la
 * derecha. Con el origen en `o`, la foto escalada se corre `(escala - 1) · o`,
 * así que mover la foto `dx` es mover el origen `-dx / (escala - 1)`.
 */
export function panOrigin(origin: ZoomOrigin, box: Box, dx: number, dy: number, scale = ZOOM_SCALE): ZoomOrigin {
  if (box.width <= 0 || box.height <= 0 || scale <= 1) return origin;
  return {
    x: clamp(origin.x - (dx / box.width) * 100 / (scale - 1)),
    y: clamp(origin.y - (dy / box.height) * 100 / (scale - 1)),
  };
}
