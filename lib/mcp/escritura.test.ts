import { describe, expect, it } from 'vitest';
import { chatOrderKey } from '@/lib/orders/chat-order';

describe('crear_orden', () => {
  it('la llave del pedido lleva al comprador: la de una persona nunca encuentra el pedido de otra', () => {
    expect(chatOrderKey('comprador-a', 'llave-1')).toBe('mcp:comprador-a:llave-1');
    expect(chatOrderKey('comprador-a', 'llave-1')).not.toBe(chatOrderKey('comprador-b', 'llave-1'));
  });
});
