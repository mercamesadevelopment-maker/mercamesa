import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Verifica o rechaza la cuenta bancaria de una tienda.
 *
 * Es el control que impide que quien entre a la cuenta de un tendero cambie el
 * número y desvíe el siguiente pago: la cuenta nueva nace en `pending` y no
 * entra a ninguna dispersión hasta que alguien la coteje contra el certificado
 * bancario que la tienda ya subió a `store_documents`.
 *
 * Va con el cliente de sesión a propósito, no con la llave de servicio: así
 * `verified_by` y `verified_at` los pone el disparador desde `auth.uid()` y no
 * dependen de que la ruta se acuerde de mandarlos.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'payouts',
      'update',
      'No tienes permisos para verificar cuentas bancarias'
    );
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const aprobar = body.approve !== false;
    const motivo = String(body.reason ?? '').trim();

    // Rechazar sin decir por qué deja al tendero adivinando qué corregir, y la
    // cuenta rebotando entre los dos.
    if (!aprobar && !motivo) {
      return NextResponse.json(
        { error: 'Escribe por qué se rechaza, para que la tienda sepa qué corregir.' },
        { status: 400 }
      );
    }

    const { data: cuenta } = await supabase
      .from('store_bank_accounts')
      .select('id, status, is_current')
      .eq('id', id)
      .maybeSingle();

    if (!cuenta) {
      return NextResponse.json({ error: 'La cuenta no existe.' }, { status: 404 });
    }

    // Verificar una cuenta que la tienda ya reemplazó no sirve de nada: la
    // dispersión solo mira la vigente.
    if (!cuenta.is_current) {
      return NextResponse.json(
        { error: 'Esta cuenta ya no es la vigente de la tienda.' },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('store_bank_accounts')
      .update({
        status: aprobar ? 'verified' : 'rejected',
        rejection_reason: aprobar ? null : motivo,
      })
      .eq('id', id);

    if (error) {
      console.error('bank-accounts/verify: no se pudo actualizar', error);
      return NextResponse.json(
        { error: 'No se pudo actualizar el estado de la cuenta.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: aprobar ? 'verified' : 'rejected' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
