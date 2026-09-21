import { NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { getPersonTypeRules, validateIdentificationPair } from '@/lib/identification/validate';
import { toE164 } from '@/lib/phone/phone';
import { authErrorMessage } from '@/lib/auth/auth-error-messages';

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

    // Campos tomados uno a uno, nunca con un spread: el `role_id` sale de la
    // invitación, no del cuerpo.
    const {
      password,
      fullName,
      phone,
      person_type_id,
      identification_type_id,
      document_number,
      business_name,
      contact_name,
    } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'La contraseña es un campo obligatorio.' }, { status: 400 });
    }

    // Todo lo que sigue se valida ANTES de tocar la contraseña. El orden
    // importa: `updateUser({ password })` no se puede deshacer, y un cuerpo
    // inválido dejaría al invitado con la contraseña cambiada, sin perfil y sin
    // tienda — o sea, sin poder entrar ni volver a intentarlo.
    const personType = person_type_id
      ? await getPersonTypeRules(supabase, String(person_type_id))
      : null;

    if (!personType) {
      return NextResponse.json({ error: 'El tipo de persona no es válido' }, { status: 400 });
    }

    // La regla del cliente (Natural → CC, Jurídica → NIT, Establecimiento → NIT
    // o RUT) vive en la tabla puente. Filtrar el desplegable no basta: sin esta
    // comprobación, un POST a mano registraría una persona Natural con NIT.
    const pairError = await validateIdentificationPair(
      supabase,
      String(person_type_id),
      identification_type_id ? String(identification_type_id) : null
    );
    if (pairError) {
      return NextResponse.json({ error: pairError.message }, { status: 400 });
    }

    // El teléfono se guarda en E.164; lo que no sea un número se rechaza acá y
    // no llega a la base.
    const phoneE164 = phone ? toE164(String(phone)) : null;
    if (phone && !phoneE164) {
      return NextResponse.json({ error: 'El teléfono no es un número válido.' }, { status: 400 });
    }

    if (!document_number || !String(document_number).trim()) {
      return NextResponse.json({ error: 'El número de identificación es obligatorio.' }, { status: 400 });
    }

    // Qué campos de nombre se exigen es una propiedad del tipo de persona, no un
    // `if` sobre 'juridica': "Establecimiento de comercio" también lleva razón
    // social.
    if (personType.requiresBusinessName) {
      if (!business_name || !contact_name) {
        return NextResponse.json(
          { error: 'La razón social y el nombre del contacto son requeridos para este tipo de persona' },
          { status: 400 }
        );
      }
    } else if (!fullName) {
      return NextResponse.json({ error: 'El nombre completo es un campo obligatorio.' }, { status: 400 });
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
      const { message } = authErrorMessage(
        passwordError,
        'No pudimos guardar la contraseña. Intenta de nuevo.',
        'accept-invite'
      );
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // 4. Create the profile record in profiles
    const roleId = invite.role || '8c87f324-1ed6-4d75-914f-cb66d9f12a45'; // fallback to seller / Tendero
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email!,
        // Cuando el tipo de persona lleva razón social, el nombre visible es el
        // del contacto: mismo criterio que `register-buyer`.
        full_name: personType.requiresBusinessName ? contact_name : fullName,
        phone: phoneE164,
        role_id: roleId,
        person_type_id: personType.id,
        identification_type_id: String(identification_type_id),
        document_number: String(document_number).trim(),
        business_name: personType.requiresBusinessName ? business_name : null,
        contact_name: personType.requiresBusinessName ? contact_name : null,
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
