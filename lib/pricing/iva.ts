/**
 * IVA de los productos del catálogo.
 *
 * La tarifa va en cada producto (`catalog_products.iva_rate`) y no en Tarifas y
 * Comisiones: una reforma tributaria mueve bienes puntuales entre tarifas, no
 * todo el catálogo. El pedido la copia al comprar (`order_items.iva_rate`).
 *
 * El precio que pone el tendero YA incluye el IVA: no se suma al total, se
 * muestra qué parte del total es impuesto. Hoy todos los productos están en 0 %.
 *
 * Sin dependencias: lo usan el navegador (formularios, detalle del pedido), las
 * rutas y la carga masiva.
 */

/** Las tarifas que existen. La base tiene el mismo `check`. */
export const IVA_RATES = [0, 0.05, 0.19] as const;
export type IvaRate = (typeof IVA_RATES)[number];

/** Lo que se responde cuando llega una tarifa que no existe. */
export const IVA_INVALIDO = 'El IVA solo puede ser 0 %, 5 % o 19 %.';

/** «0 %», «5 %», «19 %». */
export function ivaLabel(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

/**
 * Lee una tarifa como la escribe una persona: «19 %», «19%», «19», «0,19» o
 * «0.19». Vacío es 0 %. Devuelve `null` si no es una de las tarifas que existen.
 */
export function parseIvaRate(valor: unknown): IvaRate | null {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === 'number') return toRate(valor);

  const texto = String(valor).trim().replace('%', '').trim().replace(',', '.');
  if (texto === '') return 0;
  if (!/^\d+(\.\d+)?$/.test(texto)) return null;

  return toRate(Number(texto));
}

/** 19 y 0.19 son lo mismo: más de 1 se lee como porcentaje. */
function toRate(numero: number): IvaRate | null {
  if (!Number.isFinite(numero) || numero < 0) return null;
  const rate = numero > 1 ? numero / 100 : numero;
  return IVA_RATES.find((r) => Math.abs(r - rate) < 1e-9) ?? null;
}

/**
 * Cuánto de un valor con IVA incluido es impuesto. El mismo cálculo que la vista
 * `orders_detail_view` (`order_iva_total`): 19 % de 11.900 es 1.900.
 */
export function includedIva(totalConIva: number, rate: number): number {
  if (!rate) return 0;
  return Math.round((totalConIva * rate) / (1 + rate));
}
