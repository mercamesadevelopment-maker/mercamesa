import { describe, expect, it } from 'vitest';
import { buyerOrderProgress } from './buyer-progress';

const pagable = { payable: true };
const vencido = { payable: false };
const driver = { name: 'Álvaro', phone: '+573001112233', plates: 'ABC12D' };

describe('buyerOrderProgress', () => {
  it('sin pagar: pide pagar o dice que venció, sin barra', () => {
    expect(buyerOrderProgress('pending', null, pagable)).toMatchObject({ title: 'Falta pagar tu pedido', step: null, tone: 'action' });
    expect(buyerOrderProgress('pending', null, vencido)).toMatchObject({ title: 'Este pedido no se pagó a tiempo', step: null, tone: 'closed' });
  });

  it('confirmado y pagado: primer paso', () => {
    expect(buyerOrderProgress('confirmed', null, vencido)).toMatchObject({ title: 'Tu pedido está confirmado', step: 0 });
    expect(buyerOrderProgress('paid', null, vencido)).toMatchObject({ step: 0 });
  });

  it('empacando: la tienda lo prepara', () => {
    expect(buyerOrderProgress('packing', null, vencido)).toMatchObject({ title: 'La tienda está preparando tu pedido', step: 1 });
  });

  it('listo para recoger: depende del domicilio', () => {
    expect(buyerOrderProgress('at_collection', null, vencido)).toMatchObject({ title: 'Tu pedido está listo', step: 1 });
    expect(buyerOrderProgress('at_collection', { stage: 'searching', driver: null }, vencido)).toMatchObject({
      detail: 'Estamos buscando un domiciliario.',
      step: 1,
    });
    expect(buyerOrderProgress('at_collection', { stage: 'assigned', driver }, vencido)).toEqual({
      title: 'El domiciliario va por tu pedido',
      detail: 'Álvaro · placa ABC12D',
      step: 2,
      tone: 'active',
    });
    expect(buyerOrderProgress('at_collection', { stage: 'on_the_way', driver }, vencido)).toMatchObject({
      title: 'Tu pedido va en camino',
      step: 2,
    });
  });

  it('despachado: en camino, con quien lo lleva si ya se sabe', () => {
    expect(buyerOrderProgress('dispatched', { stage: 'on_the_way', driver }, vencido)).toMatchObject({
      title: 'Tu pedido va en camino',
      detail: 'Álvaro · placa ABC12D',
      step: 2,
    });
    expect(buyerOrderProgress('dispatched', null, vencido)).toMatchObject({ detail: null, step: 2 });
  });

  it('entregado: último paso', () => {
    expect(buyerOrderProgress('delivered', null, vencido)).toMatchObject({ title: 'Tu pedido fue entregado', step: 3, tone: 'done' });
  });

  it('cancelado y devuelto: sin barra', () => {
    expect(buyerOrderProgress('cancelled', null, vencido)).toMatchObject({ title: 'Este pedido se canceló', step: null, tone: 'closed' });
    expect(buyerOrderProgress('returned', null, vencido)).toMatchObject({ title: 'Este pedido fue devuelto', step: null, tone: 'closed' });
  });

  it('un estado que no se conoce no rompe la pantalla', () => {
    expect(buyerOrderProgress(null, null, vencido)).toMatchObject({ title: 'Estado desconocido', step: null });
    expect(buyerOrderProgress('otro' as never, null, vencido)).toMatchObject({ step: null });
  });
});
