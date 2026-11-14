'use client';

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ZoomOrigin } from '../types';
import { TAP_TOLERANCE, ZOOM_SCALE, originFromPoint, panOrigin } from '../utils/zoom';

const CENTER: ZoomOrigin = { x: 50, y: 50 };

/**
 * El zoom de la foto, como en Mercado Libre.
 *
 * - Un toque o clic acerca la foto en ese punto; otro la deja como estaba.
 * - Con el mouse, acercada, la foto sigue al cursor.
 * - Con el dedo, acercada, se arrastra. Un arrastre no cuenta como toque, así
 *   que soltar después de mover no la aleja.
 */
export function useImageZoom() {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState<ZoomOrigin>(CENTER);
  // Dónde empezó el toque y desde dónde se arrastra; en un ref porque cambia en
  // cada movimiento y no tiene que pintar nada por sí mismo.
  const drag = useRef<{ startX: number; startY: number; lastX: number; lastY: number; moved: boolean } | null>(null);

  const reset = useCallback(() => {
    setZoomed(false);
    setOrigin(CENTER);
    drag.current = null;
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    drag.current = { startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!zoomed) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.pointerType === 'mouse') {
      setOrigin(originFromPoint(box, e.clientX, e.clientY));
      return;
    }
    const d = drag.current;
    if (!d) return;
    if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_TOLERANCE) d.moved = true;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    setOrigin((o) => panOrigin(o, box, dx, dy));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    if (zoomed) {
      setZoomed(false);
      return;
    }
    setOrigin(originFromPoint(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY));
    setZoomed(true);
  };

  return {
    zoomed,
    reset,
    imageStyle: {
      transform: zoomed ? `scale(${ZOOM_SCALE})` : 'scale(1)',
      transformOrigin: `${origin.x}% ${origin.y}%`,
    },
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => (drag.current = null) },
  };
}
