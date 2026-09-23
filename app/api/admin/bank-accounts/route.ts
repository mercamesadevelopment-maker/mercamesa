import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { requirePermission } from '@/lib/auth/require-permission';
import { fetchAllRows } from '@/lib/supabase/fetch-all';

/**
 * Las cuentas bancarias vigentes de todas las tiendas, para la bandeja de
 * verificación.
 *
 * Trae también las tiendas activas que TODAVÍA no han registrado ninguna: son
 * las que van a quedar fuera de la próxima dispersión, y si no aparecen acá
 * nadie se entera hasta que el tendero reclame.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(supabase, 'payouts', 'read');
    if (denied) return denied;

    const service = createSupabaseServiceClient();

    const cuentas = await fetchAllRows<any>((from, to) =>
      service
        .from('store_bank_accounts')
        .select(
          `id, store_id, bank_code, account_kind, account_number, bbva_office_code,
           holder_document_type, holder_document_number, holder_document_dv,
           holder_name, holder_address, holder_email,
           status, rejection_reason, verified_at, created_at,
           stores!inner ( name ),
           banks ( name ),
           verificador:profiles!store_bank_accounts_verified_by_fkey ( full_name )`
        )
        .eq('is_current', true)
        .range(from, to)
    );

    const conCuenta = new Set(cuentas.map((c) => c.store_id));

    const tiendas = await fetchAllRows<any>((from, to) =>
      service.from('stores').select('id, name').eq('is_active', true).range(from, to)
    );

    return NextResponse.json(
      {
        data: {
          accounts: cuentas.map((c) => ({
            id: c.id,
            storeId: c.store_id,
            storeName: c.stores?.name ?? 'Tienda',
            bankCode: c.bank_code,
            bankName: c.banks?.name ?? c.bank_code,
            accountKind: c.account_kind,
            accountNumber: c.account_number,
            bbvaOfficeCode: c.bbva_office_code,
            holderDocumentType: c.holder_document_type,
            holderDocumentNumber: c.holder_document_number,
            holderDocumentDv: c.holder_document_dv,
            holderName: c.holder_name,
            holderAddress: c.holder_address,
            holderEmail: c.holder_email,
            status: c.status,
            rejectionReason: c.rejection_reason,
            verifiedAt: c.verified_at,
            verifiedByName: c.verificador?.full_name ?? null,
            createdAt: c.created_at,
          })),
          storesWithoutAccount: tiendas
            .filter((t) => !conCuenta.has(t.id))
            .map((t) => ({ id: t.id, name: t.name })),
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
