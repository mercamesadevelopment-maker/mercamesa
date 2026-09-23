import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAllRows } from '@/lib/supabase/fetch-all';
import {
  construirArchivo,
  nombreDeArchivo,
  type Beneficiario,
} from './bbva-flat-file';
import { loadPayoutSettings } from './settings';

/** Bucket privado: son números de cuenta y montos de terceros. */
export const PAYOUTS_BUCKET = 'payouts';

/**
 * Convierte una liquidación aprobada en el archivo que se sube al portal del
 * banco.
 *
 * El archivo agrupa POR TIENDA: un juego de registros 210/220/230/240 por
 * beneficiario, con la suma de sus pedidos. Los `payout_items` siguen siendo uno
 * por pedido, que es lo que permite responder después "¿en qué liquidación me
 * pagaron este pedido?".
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
  // los vigentes: si alguien cambió la cuenta de la plataforma entre el martes y
  // el jueves, este archivo tiene que seguir saliendo de donde decía.
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

  const consecutivo = payout.consecutive + settings.fileConsecutiveOffset;

  // Se ordena por nombre de tienda para que dos generaciones del mismo borrador
  // den el mismo archivo, y para que la referencia de cada una sea estable.
  const tiendas = Array.from(porTienda.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  );

  const beneficiarios: Beneficiario[] = tiendas.map((t, i) => ({
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
    // Referencia de conciliación (campo obligatorio del 210). Identifica el pago
    // dentro del archivo, no un pedido: un pago agrupa varios.
    reference: `P${String(consecutivo).padStart(5, '0')}-${String(i + 1).padStart(3, '0')}`,
  }));

  // La fecha de proceso la fija el borrador; la de creación es hoy. En el
  // ejemplo del banco coinciden porque el archivo se sube el mismo día.
  const content = construirArchivo({
    ordenante: {
      documentType: settings.ordererDocumentType,
      documentNumber: settings.ordererDocumentNumber,
      dv: settings.ordererDv,
      suffix: settings.ordererSuffix,
      name: settings.ordererName,
      address: settings.ordererAddress,
      city: settings.ordererCity,
      bbvaOfficeCode: settings.bbvaOfficeCode,
      bbvaAccountNumber: settings.bbvaAccountNumber,
      emitterKey: settings.emitterKey,
      paymentConcept: settings.paymentConcept,
    },
    beneficiarios,
    createdAt: new Date(),
    processAt: fechaLocal(payout.scheduled_for),
    consecutive: consecutivo,
  });

  const fileName = nombreDeArchivo(consecutivo);
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

/**
 * Una fecha `AAAA-MM-DD` de Postgres como fecha local.
 *
 * `new Date('2026-09-25')` la interpreta en UTC y en Colombia eso es el día
 * anterior a las 7 p. m., así que el archivo saldría con la fecha corrida.
 */
function fechaLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

async function cargarPorId(service: SupabaseClient<any>, id: string) {
  const { data } = await service
    .from('payout_settings_history')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (!data) return loadPayoutSettings(service);

  return {
    id: data.id,
    ordererDocumentType: data.orderer_document_type,
    ordererDocumentNumber: data.orderer_document_number,
    ordererDv: data.orderer_dv,
    ordererSuffix: data.orderer_suffix,
    ordererName: data.orderer_name,
    ordererAddress: data.orderer_address,
    ordererCity: data.orderer_city,
    bbvaOfficeCode: data.bbva_office_code,
    bbvaAccountNumber: data.bbva_account_number,
    emitterKey: data.emitter_key,
    paymentConcept: data.payment_concept,
    fileConsecutiveOffset: data.file_consecutive_offset,
    holdDays: data.hold_days,
  };
}
