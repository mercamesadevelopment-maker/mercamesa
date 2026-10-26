import { NextResponse } from 'next/server';
import { accountingAuth, serverError } from '@/lib/accounting/route-helpers';
import { listBalanceReports, saveBalanceReport } from '@/lib/accounting/test-balance';
import { parseBalanceRequest } from '@/lib/siigo/balance-params';
import { safeHttpsUrl } from '@/lib/siigo/safe-url';
import {
  generateTestBalance,
  generateTestBalanceByThirdParty,
  isSiigoConfigured,
} from '@/lib/siigo/services/balance.service';

/** El historial de balances de prueba generados. */
export async function GET() {
  try {
    const auth = await accountingAuth();
    if ('error' in auth) return auth.error;
    return NextResponse.json({ data: await listBalanceReports(auth.service) });
  } catch (error) {
    return serverError('admin/accounting/test-balance GET', error);
  }
}

/**
 * Pide a Siigo un balance de prueba, general o por tercero, y lo guarda en el
 * historial. En Siigo solo se lee: no crea ni cambia nada.
 */
export async function POST(request: Request) {
  const auth = await accountingAuth();
  if ('error' in auth) return auth.error;

  const parsed = parseBalanceRequest(await request.json().catch(() => ({})));
  // `'message' in`: con `strict: false` el `ok` no estrecha la unión.
  if ('message' in parsed) return NextResponse.json({ error: parsed.message }, { status: 400 });

  if (!isSiigoConfigured()) {
    return NextResponse.json(
      {
        error: 'El balance se genera en Siigo, que solo está conectado en producción. Aquí no se puede generar.',
        code: 'siigo_not_configured',
      },
      { status: 503 }
    );
  }

  let result;
  try {
    result =
      parsed.kind === 'third_party'
        ? await generateTestBalanceByThirdParty(parsed.payload)
        : await generateTestBalance(parsed.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('admin/accounting/test-balance POST (Siigo):', message);
    // Siigo rechazó los datos (una cuenta o un tercero que no existe): se le
    // muestra lo que dijo. Lo demás es una falla de Siigo o de la red.
    const rechazo = message.match(/Error en API Siigo \((4\d\d)\): ([\s\S]*)/);
    if (rechazo) {
      return NextResponse.json(
        { error: `Siigo no pudo generar el balance: ${siigoMessage(rechazo[2])}` },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: 'Siigo no respondió. Vuelve a intentarlo en unos minutos.' },
      { status: 502 }
    );
  }

  const fileUrl = safeHttpsUrl(result?.file_url);
  if (!fileUrl || !result?.file_id) {
    console.error('admin/accounting/test-balance POST: respuesta inesperada de Siigo', result);
    return NextResponse.json({ error: 'Siigo respondió sin el enlace al reporte.' }, { status: 502 });
  }

  try {
    const report = await saveBalanceReport(auth.service, parsed, { file_id: result.file_id, file_url: fileUrl }, auth.userId);
    return NextResponse.json({ data: report }, { status: 201 });
  } catch (error) {
    return serverError('admin/accounting/test-balance POST (historial)', error);
  }
}

/** El texto de un error de Siigo: su `Message` si viene en JSON, o el cuerpo recortado. */
function siigoMessage(body: string): string {
  try {
    const json = JSON.parse(body);
    const errores = json?.Errors ?? json?.errors;
    if (Array.isArray(errores) && errores.length) {
      return errores.map((e: any) => e?.Message ?? e?.message ?? '').filter(Boolean).join(' ') || body.slice(0, 200);
    }
    return json?.Message ?? json?.message ?? body.slice(0, 200);
  } catch {
    return body.slice(0, 200);
  }
}
