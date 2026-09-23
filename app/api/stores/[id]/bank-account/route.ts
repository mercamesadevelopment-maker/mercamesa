import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * La cuenta bancaria de una tienda: la propone el tendero.
 *
 * Todo pasa por RLS y por el disparador `guard_store_bank_account`, no por
 * comprobaciones acá: la política deja escribir a los miembros de la tienda, y
 * el disparador obliga a que la cuenta nazca en `pending` y a que nadie edite en
 * sitio los datos de una ya registrada. Así la regla vale también si alguien
 * escribe contra la base directamente.
 */

/** Códigos de identificación del ARCHIVO del banco, no los de la plataforma. */
const TIPOS_DOCUMENTO = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Sin filtro por permiso: la política de `store_bank_accounts` ya limita las
    // filas a las tiendas de las que es miembro.
    const { data, error } = await supabase
      .from('store_bank_accounts')
      .select(
        `id, bank_code, account_kind, account_number, bbva_office_code,
         holder_document_type, holder_document_number, holder_document_dv,
         holder_name, holder_address, holder_email,
         status, rejection_reason, verified_at, created_at,
         banks ( name )`
      )
      .eq('store_id', id)
      .eq('is_current', true)
      .maybeSingle();

    if (error) {
      console.error('bank-account: no se pudo leer', error);
      return NextResponse.json({ error: 'No se pudo cargar la cuenta.' }, { status: 500 });
    }

    return NextResponse.json({ data: data ? aCamello(data) : null }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json().catch(() => ({}));

    const bankCode = String(body.bankCode ?? '').trim();
    const accountKind = String(body.accountKind ?? '');
    const accountNumber = String(body.accountNumber ?? '').replace(/\D/g, '');
    const bbvaOfficeCode = String(body.bbvaOfficeCode ?? '').trim();
    const documentType = String(body.holderDocumentType ?? '').trim();
    const documentNumber = String(body.holderDocumentNumber ?? '').replace(/\D/g, '');
    const documentDv = String(body.holderDocumentDv ?? '0').trim();
    const holderName = String(body.holderName ?? '').trim();

    if (!/^\d{4}$/.test(bankCode)) {
      return NextResponse.json({ error: 'Selecciona el banco.' }, { status: 400 });
    }

    if (!['checking', 'savings'].includes(accountKind)) {
      return NextResponse.json(
        { error: 'Indica si la cuenta es corriente o de ahorros.' },
        { status: 400 }
      );
    }

    if (!accountNumber) {
      return NextResponse.json({ error: 'Escribe el número de la cuenta.' }, { status: 400 });
    }

    // Una cuenta BBVA se escribe en el archivo como oficina + tipo + los ocho
    // dígitos finales. Sin la oficina el registro queda incompleto y no hay de
    // dónde deducirla.
    if (bankCode === '0013' && !/^\d{4}$/.test(bbvaOfficeCode)) {
      return NextResponse.json(
        { error: 'Para una cuenta BBVA hace falta el código de oficina, de 4 dígitos.' },
        { status: 400 }
      );
    }

    if (!TIPOS_DOCUMENTO.includes(documentType)) {
      return NextResponse.json(
        { error: 'Selecciona el tipo de documento del titular.' },
        { status: 400 }
      );
    }

    if (!documentNumber) {
      return NextResponse.json(
        { error: 'Escribe el documento del titular de la cuenta.' },
        { status: 400 }
      );
    }

    // El dígito de verificación solo lo tiene el NIT ('03'). El banco lo compara,
    // así que uno equivocado rechaza el pago de esa tienda.
    if (!/^\d$/.test(documentDv)) {
      return NextResponse.json(
        { error: 'El dígito de verificación es un solo número.' },
        { status: 400 }
      );
    }

    if (!holderName) {
      return NextResponse.json(
        { error: 'Escribe el nombre del titular, tal como figura en el banco.' },
        { status: 400 }
      );
    }

    // La anterior se baja primero. Si el insert fallara después, la tienda se
    // quedaría sin cuenta vigente y la siguiente dispersión la dejaría fuera —
    // molesto, pero visible y con arreglo; al revés quedarían dos vigentes y el
    // índice único lo rechazaría de todos modos.
    const { error: bajaError } = await supabase
      .from('store_bank_accounts')
      .update({ is_current: false })
      .eq('store_id', id)
      .eq('is_current', true);

    if (bajaError) {
      console.error('bank-account: no se pudo bajar la anterior', bajaError);
      return NextResponse.json({ error: 'No se pudo registrar la cuenta.' }, { status: 500 });
    }

    // `status`, `verified_*` y `created_by` los fija el disparador: mandarlos
    // desde acá no serviría de nada, y por eso ni se leen del cuerpo.
    const { data, error } = await supabase
      .from('store_bank_accounts')
      .insert({
        store_id: id,
        bank_code: bankCode,
        account_kind: accountKind,
        account_number: accountNumber,
        bbva_office_code: bankCode === '0013' ? bbvaOfficeCode : null,
        holder_document_type: documentType,
        holder_document_number: documentNumber,
        holder_document_dv: documentType === '03' ? documentDv : '0',
        holder_name: holderName,
        holder_address: body.holderAddress ? String(body.holderAddress).trim() : null,
        holder_email: body.holderEmail ? String(body.holderEmail).trim() : null,
      })
      .select(
        `id, bank_code, account_kind, account_number, bbva_office_code,
         holder_document_type, holder_document_number, holder_document_dv,
         holder_name, holder_address, holder_email,
         status, rejection_reason, verified_at, created_at,
         banks ( name )`
      )
      .single();

    if (error) {
      console.error('bank-account: no se pudo crear', error);
      return NextResponse.json(
        { error: 'No se pudo registrar la cuenta. Revisa los datos e intenta de nuevo.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: aCamello(data) }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function aCamello(row: any) {
  return {
    id: row.id,
    bankCode: row.bank_code,
    bankName: row.banks?.name ?? null,
    accountKind: row.account_kind,
    accountNumber: row.account_number,
    bbvaOfficeCode: row.bbva_office_code,
    holderDocumentType: row.holder_document_type,
    holderDocumentNumber: row.holder_document_number,
    holderDocumentDv: row.holder_document_dv,
    holderName: row.holder_name,
    holderAddress: row.holder_address,
    holderEmail: row.holder_email,
    status: row.status,
    rejectionReason: row.rejection_reason,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}
