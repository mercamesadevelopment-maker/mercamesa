import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import {
  construirArchivo,
  nombreDeArchivo,
  type Beneficiario,
} from './bbva-flat-file';
import { aParametros, loadPayoutSettings } from './settings';

/** Bucket privado: son números de cuenta y montos de terceros. */
export const PAYOUTS_BUCKET = 'payouts';

/**
 * Convierte una liquidación aprobada en el archivo que se sube al portal del
 * banco.
 *
 * El archivo agrupa POR TIENDA: una línea por beneficiario, con la suma de sus
 * pedidos. Los `payout_items` siguen siendo uno por pedido, que es lo que
 * permite responder después "¿en qué liquidación me pagaron este pedido?".
 *
 * Todo lo de cada línea sale de la cuenta verificada de la tienda —titular,
 * documento, dirección, correo, y la cuenta o la llave Bre-B—. A mano solo se
 * pone el concepto de pago, en Parámetros.
 */

export interface ArchivoGenerado {
  fileName: string;
  filePath: string;
  content: string;
  storesCount: number;
  totalAmount: number;
}

export async function generarArchivo(
  service: SupabaseClient<any>,
  payoutId: string
): Promise<ArchivoGenerado> {
  const { data: payout, error: payoutError } = await service
    .from('payouts')
    .select('id, consecutive, status, scheduled_for, settings_id')
    .eq('id', payoutId)
    .maybeSingle();

  if (payoutError || !payout) {
    throw new Error('La liquidación no existe.');
  }

  // Se generan contra los parámetros con los que se armó el borrador, no contra
  // los vigentes: si alguien cambió el concepto entre el martes y el jueves, este
  // archivo tiene que seguir saliendo como se revisó.
  const settings = payout.settings_id
    ? await cargarPorId(service, payout.settings_id)
    : await loadPayoutSettings(service);

  const items = await fetchAllRows<any>((from, to) =>
    service
      .from('payout_items')
      .select(
        `store_id, amount,
         stores!inner ( name ),
         store_bank_accounts!inner (
           payment_method, breb_key,
           bank_code, account_kind, account_number, bbva_office_code,
           holder_document_type, holder_document_number, holder_document_dv,
           holder_name, holder_address, holder_email
         )`
      )
      .eq('payout_id', payoutId)
      .range(from, to)
  );

  if (items.length === 0) {
    throw new Error('La liquidación no tiene pedidos.');
  }

  // Un beneficiario por tienda, con la suma de sus pedidos.
  const porTienda = new Map<string, { cuenta: any; nombre: string; monto: number }>();
  for (const item of items) {
    const actual = porTienda.get(item.store_id);
    if (actual) {
      actual.monto += Number(item.amount);
    } else {
      porTienda.set(item.store_id, {
        cuenta: item.store_bank_accounts,
        nombre: item.stores?.name ?? 'Tienda',
        monto: Number(item.amount),
      });
    }
  }

  // Se ordena por nombre de tienda para que dos generaciones del mismo borrador
  // den el mismo archivo.
  // Las líneas negativas son descuentos por devoluciones y ya vienen sumadas.
  // Una tienda cuyo neto quedó en cero no va al archivo: el banco no acepta un
  // pago de $0, y sus pedidos igual quedan liquidados.
  const tiendas = Array.from(porTienda.values())
    .filter((t) => t.monto > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (tiendas.length === 0) {
    throw new Error('La liquidación no tiene nada que pagar: los descuentos compensan los pedidos.');
  }

  const beneficiarios: Beneficiario[] = tiendas.map((t) => ({
    paymentMethod: t.cuenta.payment_method,
    brebKey: t.cuenta.breb_key,
    bankCode: t.cuenta.bank_code,
    accountKind: t.cuenta.account_kind,
    accountNumber: t.cuenta.account_number,
    bbvaOfficeCode: t.cuenta.bbva_office_code,
    documentType: t.cuenta.holder_document_type,
    documentNumber: t.cuenta.holder_document_number,
    documentDv: t.cuenta.holder_document_dv,
    // El nombre del titular de la cuenta, no el de la tienda: es el que el banco
    // coteja contra el documento.
    name: t.cuenta.holder_name,
    address: t.cuenta.holder_address,
    email: t.cuenta.holder_email,
    amount: t.monto,
  }));

  const content = construirArchivo({
    beneficiarios,
    paymentConcept: settings.paymentConcept,
  });

  const fileName = nombreDeArchivo(payout.consecutive);
  const filePath = `${payout.scheduled_for}/${payout.id}/${fileName}`;

  const { error: uploadError } = await service.storage
    .from(PAYOUTS_BUCKET)
    .upload(filePath, content, { contentType: 'text/plain', upsert: true });

  if (uploadError) {
    throw new Error(`No se pudo guardar el archivo: ${uploadError.message}`);
  }

  return {
    fileName,
    filePath,
    content,
    storesCount: beneficiarios.length,
    totalAmount: beneficiarios.reduce((s, b) => s + b.amount, 0),
  };
}

async function cargarPorId(service: SupabaseClient<any>, id: string) {
  const { data } = await service
    .from('payout_settings_history')
    .select('id, payment_concept, hold_days')
    .eq('id', id)
    .maybeSingle();

  return data ? aParametros(data) : loadPayoutSettings(service);
}
