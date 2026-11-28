import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import { generarArchivo, type ArchivoGenerado } from './generate-file';
import { planearCuentas, type CambioDeCuenta } from './regenerate-rules';

/**
 * Vuelve a armar el archivo de una liquidación aprobada.
 *
 * Para cuando el banco rechazó el archivo, o no se alcanzó a subir, por un dato
 * malo de la cuenta de una tienda (un tipo de documento, por ejemplo): la tienda
 * registra la cuenta corregida, se verifica, y el archivo sale de nuevo con la
 * cuenta verificada vigente de cada tienda. Mismos pedidos, mismos montos y mismo
 * nombre de archivo; reemplaza al anterior.
 *
 * Solo sirve si el banco no pagó nada de ese archivo: lo advierte la pantalla.
 */

export class RegenerarError extends Error {}

export interface ArchivoRegenerado extends ArchivoGenerado {
  /** Las tiendas a las que se les cambió la cuenta. */
  cuentasCambiadas: string[];
}

export async function regenerarArchivo(
  service: SupabaseClient<any>,
  payoutId: string,
  userId: string
): Promise<ArchivoRegenerado> {
  const { data: payout } = await service.from('payouts').select('id, status').eq('id', payoutId).maybeSingle();
  if (!payout) throw new RegenerarError('La liquidación no existe.');
  if (payout.status !== 'approved') {
    throw new RegenerarError('Solo se regenera el archivo de una liquidación aprobada.');
  }

  const items = await fetchAllRows<any>((from, to) =>
    service
      .from('payout_items')
      .select('store_id, bank_account_id, stores!inner ( name )')
      .eq('payout_id', payoutId)
      .range(from, to)
  );
  if (items.length === 0) throw new RegenerarError('La liquidación no tiene pedidos.');

  const storeIds = [...new Set(items.map((i) => i.store_id as string))];
  const { data: vigentes, error: vigentesError } = await service
    .from('store_bank_accounts')
    .select('id, store_id')
    .in('store_id', storeIds)
    .eq('is_current', true)
    .eq('status', 'verified');
  if (vigentesError) throw new Error('No se pudieron leer las cuentas de las tiendas.');

  const plan = planearCuentas(
    items.map((i) => ({ storeId: i.store_id, storeName: i.stores?.name ?? 'Tienda', bankAccountId: i.bank_account_id })),
    (vigentes ?? []).map((c) => ({ storeId: c.store_id, id: c.id }))
  );
  if ('error' in plan) throw new RegenerarError(plan.error);

  await moverCuentas(service, payoutId, plan.cambios, 'to');

  let archivo: ArchivoGenerado;
  try {
    archivo = await generarArchivo(service, payoutId);
  } catch (e) {
    // Sin archivo nuevo, la liquidación vuelve a apuntar a las cuentas con las
    // que salió el archivo que sigue guardado.
    await moverCuentas(service, payoutId, plan.cambios, 'from');
    throw e;
  }

  const { error: updateError } = await service
    .from('payouts')
    .update({
      file_name: archivo.fileName,
      file_path: archivo.filePath,
      file_regenerated_at: new Date().toISOString(),
      file_regenerated_by: userId,
    })
    .eq('id', payoutId);
  if (updateError) console.error('payouts/regenerate: no se pudo registrar quién regeneró', updateError);

  return { ...archivo, cuentasCambiadas: [...new Set(plan.cambios.map((c) => c.storeName))] };
}

async function moverCuentas(
  service: SupabaseClient<any>,
  payoutId: string,
  cambios: CambioDeCuenta[],
  hacia: 'to' | 'from'
) {
  for (const c of cambios) {
    const [desde, hasta] = hacia === 'to' ? [c.from, c.to] : [c.to, c.from];
    const { error } = await service
      .from('payout_items')
      .update({ bank_account_id: hasta })
      .eq('payout_id', payoutId)
      .eq('store_id', c.storeId)
      .eq('bank_account_id', desde);
    if (error) throw new Error(`No se pudo actualizar la cuenta de ${c.storeName}.`);
  }
}
