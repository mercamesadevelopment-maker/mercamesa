import { NextResponse } from 'next/server';
import { createClient } from '../../../../../lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: members, error } = await supabase
      .from('store_members')
      .select(`
        id,
        user_id,
        role_id,
        created_at,
        profiles!user_id (
          id,
          full_name,
          email,
          phone
        ),
        roles (
          id,
          name,
          label
        )
      `)
      .eq('store_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Also fetch pending invitations for this store
    const { data: invitations } = await supabase
      .from('invitations')
      .select(`
        id,
        email,
        role,
        created_at,
        expires_at
      `)
      .eq('store_id', id)
      .eq('invitation_type', 'store_member');

    // Fetch the role definitions to map roles in invitations
    const { data: roles } = await supabase.from('roles').select('id, name, label');
    const rolesMap = (roles || []).reduce((acc: Record<string, any>, role) => {
      acc[role.id] = role;
      return acc;
    }, {});

    const mappedInvitations = (invitations || []).map(invite => ({
      id: invite.id,
      email: invite.email,
      role_id: invite.role,
      roles: rolesMap[invite.role] || { name: 'unknown', label: 'Invitado' },
      is_pending: true,
      created_at: invite.created_at
    }));

    return NextResponse.json({ 
      data: {
        members: members || [],
        invitations: mappedInvitations
      }
    }, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email, role_id } = await request.json();

    if (!email || !role_id) {
      return NextResponse.json({ error: 'Email y Rol son requeridos.' }, { status: 400 });
    }

    // 1. Check if user exists in profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (profile) {
      // 1.1 Existing user: check if already a member
      const { data: existingMember } = await supabase
        .from('store_members')
        .select('id')
        .eq('store_id', id)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: 'El usuario ya es miembro de esta tienda.' }, { status: 400 });
      }

      // 1.2 Insert into store_members
      const { error: insertError } = await supabase
        .from('store_members')
        .insert({
          store_id: id,
          user_id: profile.id,
          role_id: role_id,
          invited_by: user.id
        });

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 400 });
      }

      // 1.3 Call notify Edge Function
      try {
        const origin = request.headers.get('origin') || '';
        const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-store-assignment`;
        
        // Get details
        const { data: roleData } = await supabase.from('roles').select('label').eq('id', role_id).single();
        const { data: storeData } = await supabase.from('stores').select('name').eq('id', id).single();
        
        await fetch(edgeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            fullName: profile.full_name,
            storeName: storeData?.name || 'Tienda',
            roleLabel: roleData?.label || 'Miembro',
            loginUrl: `${origin}`
          })
        });
      } catch (efErr) {
        console.error('Error calling notify-store-assignment edge function:', efErr);
      }

      return NextResponse.json({ success: true, memberAdded: true }, { status: 201 });
    } else {
      // 2. New user: check if already invited to this store
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('store_id', id)
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingInvite) {
        return NextResponse.json({ error: 'Ya existe una invitación pendiente para este correo en esta tienda.' }, { status: 400 });
      }

      // 2.1 Call inviteUserByEmail with service role Supabase client
      const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
      const serviceSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const origin = request.headers.get('origin') || '';
      const { error: inviteError } = await serviceSupabase.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/accept-invite`
      });

      if (inviteError) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }

      // 2.2 Record invitation in database
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);

      const { error: inviteDbError } = await supabase
        .from('invitations')
        .insert({
          email: email.trim().toLowerCase(),
          store_id: id,
          role: role_id, // Store role UUID as string in role
          invitation_type: 'store_member',
          invited_by: user.id,
          token: crypto.randomUUID(),
          expires_at: expires.toISOString()
        });

      if (inviteDbError) {
        return NextResponse.json({ error: inviteDbError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, invited: true }, { status: 201 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const inviteId = searchParams.get('inviteId');

    if (memberId) {
      // Delete existing member relation
      const { error } = await supabase
        .from('store_members')
        .delete()
        .eq('id', memberId)
        .eq('store_id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Miembro eliminado correctamente' }, { status: 200 });
    } else if (inviteId) {
      // Delete pending invitation
      const { error } = await supabase
        .from('invitations')
        .delete()
        .eq('id', inviteId)
        .eq('store_id', id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Invitación cancelada correctamente' }, { status: 200 });
    } else {
      return NextResponse.json({ error: 'Se requiere memberId o inviteId.' }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
