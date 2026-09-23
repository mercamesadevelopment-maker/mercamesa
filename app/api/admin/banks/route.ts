import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * El catálogo de bancos del archivo de dispersión.
 *
 * Solo viene sembrado BBVA (`0013`), que es el único código que la norma
 * confirma. Los demás salen del "anexo 1" que entrega el banco y los carga el
 * superadmin: inventarlos sería mandar la plata de un tendero al banco
 * equivocado, y el archivo se procesaría sin quejarse.
 *
 * Lo lee cualquier autenticado porque el tendero necesita la lista para escoger
 * el suyo al registrar su cuenta.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { data, error } = await supabase
      .from('banks')
      .select('code, name, is_active')
      .order('name');

    if (error) {
      console.error('banks: no se pudo leer', error);
      return NextResponse.json({ error: 'No se pudieron cargar los bancos.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        data: (data ?? []).map((b) => ({
          code: b.code,
          name: b.name,
          isActive: b.is_active,
        })),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const denied = await requirePermission(
      supabase,
      'payouts',
      'create',
      'No tienes permisos para administrar el catálogo de bancos'
    );
    if (denied) return denied;

    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? '').trim();
    const name = String(body.name ?? '').trim();

    // Cuatro dígitos exactos: el campo del archivo mide 4 y se rellena con ceros
    // a la izquierda, así que '13' y '0013' son el mismo banco escrito de dos
    // formas. Se exige la forma canónica para que no quede duplicado.
    if (!/^\d{4}$/.test(code)) {
      return NextResponse.json(
        { error: 'El código del banco son exactamente 4 dígitos, como aparece en el anexo del banco (ej. 0013).' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json({ error: 'Escribe el nombre del banco.' }, { status: 400 });
    }

    const { error } = await supabase.from('banks').insert({ code, name });

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ese código de banco ya está registrado.' }, { status: 400 });
      }
      console.error('banks: no se pudo crear', error);
      return NextResponse.json({ error: 'No se pudo registrar el banco.' }, { status: 500 });
    }

    return NextResponse.json({ created: true, code, name }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
