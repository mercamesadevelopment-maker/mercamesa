import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { processInactiveAccounts } from '@/lib/accounts/process-inactive';

/**
 * El cierre de cuentas por inactividad, una vez al día.
 *
 * Lo llama pg_cron (`inactive_accounts`, 14:00 UTC = 9:00 a. m. de Colombia) a
 * través de `call_app_cron`, que lee la URL y el secreto de Vault. Avisa a
 * quien cumplió un año sin usar la cuenta y cierra la de quien, avisado hace dos
 * semanas, no volvió. La política está en `lib/accounts/`.
 */
export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resumen = await processInactiveAccounts(createSupabaseServiceClient());
    return NextResponse.json({ data: resumen }, { status: 200 });
  } catch (error: unknown) {
    console.error('cron/inactive-accounts:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
