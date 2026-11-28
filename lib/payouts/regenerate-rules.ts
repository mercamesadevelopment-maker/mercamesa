/**
 * Qué cuenta usa cada tienda al regenerar el archivo de una liquidación.
 *
 * Función pura. Cada tienda de la liquidación pasa a su cuenta verificada
 * vigente; si no tiene una, no se regenera nada: un archivo a medias es peor que
 * el que ya existe.
 */

export interface ItemDeLiquidacion {
  storeId: string;
  storeName: string;
  bankAccountId: string;
}

export interface CuentaVigente {
  storeId: string;
  id: string;
}

export interface CambioDeCuenta {
  storeId: string;
  storeName: string;
  from: string;
  to: string;
}

export type PlanDeCuentas =
  | { ok: true; cambios: CambioDeCuenta[] }
  | { ok: false; error: string };

export function planearCuentas(items: ItemDeLiquidacion[], vigentes: CuentaVigente[]): PlanDeCuentas {
  const vigentePorTienda = new Map(vigentes.map((c) => [c.storeId, c.id]));
  const tiendas = new Map<string, ItemDeLiquidacion>();
  for (const item of items) if (!tiendas.has(item.storeId)) tiendas.set(item.storeId, item);

  const sinCuenta = [...tiendas.values()].filter((t) => !vigentePorTienda.has(t.storeId));
  if (sinCuenta.length > 0) {
    const nombres = sinCuenta.map((t) => t.storeName).join(', ');
    return {
      ok: false,
      error: `${nombres} no ${sinCuenta.length === 1 ? 'tiene' : 'tienen'} una cuenta verificada vigente. Verifícala y vuelve a intentarlo.`,
    };
  }

  // Una tienda puede tener pedidos con cuentas distintas (cambió de cuenta entre
  // pedidos): cada cuenta vieja es un cambio.
  const vistos = new Set<string>();
  const cambios: CambioDeCuenta[] = [];
  for (const item of items) {
    const to = vigentePorTienda.get(item.storeId)!;
    const clave = `${item.storeId}:${item.bankAccountId}`;
    if (item.bankAccountId === to || vistos.has(clave)) continue;
    vistos.add(clave);
    cambios.push({ storeId: item.storeId, storeName: item.storeName, from: item.bankAccountId, to });
  }
  return { ok: true, cambios };
}
