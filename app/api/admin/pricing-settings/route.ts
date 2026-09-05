import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Tarifas y comisiones de la plataforma.
 *
 * Append-only, igual que el precio mínimo de orden: cada ajuste es una fila
 * nueva y la más reciente es la que aplica. Los pedidos guardan a qué fila
 * corresponden, así que cambiar una tarifa nunca reescribe lo ya cobrado.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('pricing_settings_history')
      .select('*, profiles ( full_name )')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Se hace en línea en vez de con `requirePermission` porque también hace
    // falta `user.id` para la columna `changed_by`. Mismo caso que
    // app/api/admin/order-min-price/route.ts.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: canCreate } = await supabase.rpc('has_permission', {
      module_key: 'system-settings',
      action_name: 'create',
    });

    if (!canCreate) {
      return NextResponse.json(
        { error: 'No tienes permisos para ajustar las tarifas y comisiones' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      service_commission_rate,
      message_unit_price,
      messages_per_order,
      platform_commission_rate,
      siigo_delivery_product_code,
      siigo_platform_product_code,
      notes,
    } = body;

    // Las tarifas se guardan como fracción (0.0299), no como porcentaje. Un 2,99
    // escrito por error multiplicaría el precio por 3, así que se rechaza.
    const rates: [string, unknown][] = [
      ['La comisión de servicio', service_commission_rate],
      ['La comisión de plataforma', platform_commission_rate],
    ];
    for (const [label, value] of rates) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
        return NextResponse.json(
          { error: `${label} debe ser un valor entre 0 y 1 (por ejemplo 0,0299 para 2,99%).` },
          { status: 400 }
        );
      }
    }

    if (!Number.isFinite(Number(message_unit_price)) || Number(message_unit_price) < 0) {
      return NextResponse.json(
        { error: 'El valor por mensaje debe ser mayor o igual a cero' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(Number(messages_per_order)) || Number(messages_per_order) < 0) {
      return NextResponse.json(
        { error: 'La cantidad de mensajes por pedido debe ser un número entero mayor o igual a cero' },
        { status: 400 }
      );
    }

    // Sin estos códigos no se puede emitir ninguna factura: el mapper de Siigo
    // se detiene antes que emitir una descuadrada.
    if (!siigo_delivery_product_code?.trim() || !siigo_platform_product_code?.trim()) {
      return NextResponse.json(
        { error: 'Los códigos de Siigo del domicilio y del servicio MercaMesa son obligatorios' },
        { status: 400 }
      );
    }

    if (!notes?.trim()) {
      return NextResponse.json({ error: 'La observación del ajuste es requerida' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('pricing_settings_history')
      .insert({
        service_commission_rate: Number(service_commission_rate),
        message_unit_price: Number(message_unit_price),
        messages_per_order: Number(messages_per_order),
        platform_commission_rate: Number(platform_commission_rate),
        siigo_delivery_product_code: siigo_delivery_product_code.trim(),
        siigo_platform_product_code: siigo_platform_product_code.trim(),
        notes: notes.trim(),
        changed_by: user.id,
      })
      .select('*, profiles ( full_name )')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
