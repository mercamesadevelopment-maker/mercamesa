import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';
import { createProduct, getProducts } from '@/lib/siigo/services/products/product.service';
import { loadPricingSettings, PricingConfigError } from '@/lib/pricing/settings';

/**
 * Crea (o verifica) en Siigo los dos productos de servicio con los que se
 * facturan el domicilio y la comisión de plataforma.
 *
 * Es idempotente: `createProduct` devuelve `alreadyExists` en vez de fallar si el
 * código ya está, así que se puede volver a ejecutar sin riesgo cada vez que se
 * cambien los códigos en la parametrización.
 *
 * Sin IVA a propósito: según el tributarista del cliente la factura no lleva
 * impuesto discriminado, se paga al momento de la dispersión de fondos.
 */

/** Grupo contable "Servicios". GET /v1/account-groups */
const SERVICE_ACCOUNT_GROUP_ID = Number.parseInt(
  process.env.SIIGO_SERVICE_ACCOUNT_GROUP_ID || '1304',
  10
);

interface EnsureResult {
  code: string;
  name: string;
  status: 'created' | 'already_exists' | 'error';
  error?: string;
}

async function ensureProduct(code: string, name: string): Promise<EnsureResult> {
  try {
    // Se consulta primero para poder distinguir "ya existía desde antes" de "lo
    // acabo de crear", que es lo que el administrador necesita ver.
    const existing = await getProducts({ code, page_size: 1 });
    if ((existing.results ?? []).some((p) => p.code === code)) {
      return { code, name, status: 'already_exists' };
    }

    const result = await createProduct({
      code,
      name,
      account_group: SERVICE_ACCOUNT_GROUP_ID,
      type: 'Service',
      stock_control: false,
      active: true,
      unit_label: 'Unidad',
    });

    return { code, name, status: result.alreadyExists ? 'already_exists' : 'created' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error asegurando el producto "${code}" en Siigo:`, message);
    return { code, name, status: 'error', error: message.slice(0, 500) };
  }
}

export async function POST() {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'system-settings',
      'create',
      'No tienes permisos para crear productos en Siigo'
    );
    if (denied) return denied;

    const settings = await loadPricingSettings(supabase);

    const results = [
      await ensureProduct(settings.siigoDeliveryProductCode, 'Domicilio'),
      await ensureProduct(settings.siigoPlatformProductCode, 'Servicio MercaMesa'),
    ];

    const failed = results.filter((r) => r.status === 'error');

    return NextResponse.json(
      { data: { results, ok: failed.length === 0 } },
      { status: failed.length === 0 ? 200 : 502 }
    );
  } catch (error: unknown) {
    if (error instanceof PricingConfigError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
