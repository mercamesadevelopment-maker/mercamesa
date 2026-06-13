import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ authenticated: false, hasInvite: false }, { status: 200 });
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invite } = await serviceSupabase
      .from('invitations')
      .select('id, store_id, stores(name)')
      .eq('email', user.email)
      .eq('invitation_type', 'store_member')
      .maybeSingle();

    return NextResponse.json({
      authenticated: true,
      email: user.email,
      hasInvite: !!invite,
      storeName: (invite as any)?.stores?.name || 'su tienda asignada'
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verify user session (Supabase automatically logs in the user when they click the invite link)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado o la sesión de invitación ha expirado.' }, { status: 401 });
    }

    const { password, fullName, phone } = await request.json();

    if (!password || !fullName) {
      return NextResponse.json({ error: 'El nombre completo y la contraseña son campos obligatorios.' }, { status: 400 });
    }

    // 2. Fetch the invitation details using the secure service role client
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invite, error: inviteError } = await serviceSupabase
      .from('invitations')
      .select('*')
      .eq('email', user.email)
      .eq('invitation_type', 'store_member')
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: 'No se encontró una invitación activa para este correo electrónico.' }, { status: 404 });
    }

    // 3. Set the user's password in auth.users
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      return NextResponse.json({ error: `Error de contraseña: ${passwordError.message}` }, { status: 400 });
    }

    // 4. Create the profile record in profiles
    const roleId = invite.role || '8c87f324-1ed6-4d75-914f-cb66d9f12a45'; // fallback to seller / Tendero
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        full_name: fullName,
        phone: phone || null,
        role_id: roleId,
        language: 'es',
        is_active: true
      });

    if (profileError) {
      return NextResponse.json({ error: `Error al crear perfil: ${profileError.message}` }, { status: 400 });
    }

    // 5. Link user to store_members
    const { error: memberError } = await supabase
      .from('store_members')
      .insert({
        store_id: invite.store_id!,
        user_id: user.id,
        role_id: roleId,
        invited_by: invite.invited_by
      });

    if (memberError) {
      console.error('Error assigning member to store:', memberError);
      return NextResponse.json({ error: `Error al asociar a la tienda: ${memberError.message}` }, { status: 400 });
    }

    // 6. Delete invitation as it has been completed
    await serviceSupabase.from('invitations').delete().eq('id', invite.id);

    return NextResponse.json({ success: true, redirectUrl: '/seller' }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
