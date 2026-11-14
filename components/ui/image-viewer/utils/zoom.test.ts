import { describe, expect, it } from 'vitest';
import { originFromPoint, panOrigin } from './zoom';

const box = { left: 100, top: 50, width: 400, height: 200 };

describe('originFromPoint', () => {
  it('da el punto tocado en porcentaje de la foto', () => {
    expect(originFromPoint(box, 200, 100)).toEqual({ x: 25, y: 25 });
  });

  it('no se sale de la foto', () => {
    expect(originFromPoint(box, 0, 1000)).toEqual({ x: 0, y: 100 });
  });

  it('una foto sin tamaño todavía queda centrada', () => {
    expect(originFromPoint({ ...box, width: 0 }, 200, 100)).toEqual({ x: 50, y: 50 });
  });
});

describe('panOrigin', () => {
  it('arrastrar a la derecha corre el origen a la izquierda', () => {
    // 60 px de 400 son 15 %; con 2,5× se reparte entre 1,5: 10 %.
    expect(panOrigin({ x: 50, y: 50 }, box, 60, 0, 2.5)).toEqual({ x: 40, y: 50 });
  });

  it('se detiene en el borde', () => {
    expect(panOrigin({ x: 5, y: 95 }, box, 400, -400, 2.5)).toEqual({ x: 0, y: 100 });
  });

  it('sin zoom no se mueve', () => {
    expect(panOrigin({ x: 30, y: 30 }, box, 60, 60, 1)).toEqual({ x: 30, y: 30 });
  });
});
