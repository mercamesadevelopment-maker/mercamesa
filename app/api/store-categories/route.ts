import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  // Solo las activas: esta ruta alimenta los desplegables con los que se elige
  // categoría, y una categoría retirada del catálogo no debería poder elegirse.
  // Antes devolvía todas, así que desactivar una en Parametrización no hacía
  // nada visible.
  const { data, error } = await supabase
    .from('store_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 200 });
}
