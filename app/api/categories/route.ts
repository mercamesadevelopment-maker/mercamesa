import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listActiveCategories } from '@/lib/categories/active';

/** Las categorías que se pueden elegir en el formulario de producto: solo las activas. */
export async function GET() {
  const supabase = await createClient();
  try {
    const data = await listActiveCategories(supabase);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
