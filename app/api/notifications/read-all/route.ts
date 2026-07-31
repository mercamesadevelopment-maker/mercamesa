import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function PUT() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
      .from('notification_recipients')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ message: 'All marked as read' }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server error' }, { status: 500 });
  }
}
