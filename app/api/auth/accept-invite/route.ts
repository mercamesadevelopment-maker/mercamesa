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

    // Sin filtrar por tipo: ahora también se invita a administrar la
    // plataforma, y el formulario que se muestra depende de cuál de las dos es.
    const { data: invite } = await serviceSupabase
      .from('invitations')
      .select('id, store_id, invitation_type, role, expires_at, stores(name)')
      .eq('email', user.email)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // La vigencia se escribía desde el principio y no la miraba nadie: una
    // invitación de hace ocho meses servía igual. Para un administrador eso es
    // una puerta abierta indefinidamente.
    const vencida = !!invite && new Date(invite.expires_at) <= new Date();

    let roleLabel: string | null = null;
    if (invite?.role) {
      const { data: rol } = await serviceSupabase
        .from('roles')
        .select('label')
        .eq('id', invite.role)
        .maybeSingle();
      roleLabel = rol?.label ?? null;
    }

    return NextResponse.json({
      authenticated: true,
      email: user.email,
      hasInvite: !!invite && !vencida,
      expired: vencida,
      invitationType: invite?.invitation_type ?? null,
      roleLabel,
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

    // La invitación se busca antes que nada porque su tipo decide qué datos se
    // piden: a un administrador no se le exige tipo de persona ni documento,
    // que son requisitos de facturación de una tienda.
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const serviceSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invite } = await serviceSupabase
      .from('invitations')
      .select('*')
      .eq('email', user.email)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: 'No se encontró una invitación activa para este correo electrónico.' }, { status: 404 });
    }

    if (new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json(
        { error: 'Esta invitación ya venció. Pídele a quien te invitó que te envíe una nueva.' },
        { status: 410 }
      );
    }

    const esAdmin = invite.invitation_type === 'admin';

    // El teléfono se guarda en E.164 en los dos caminos; lo que no sea un
    // número se rechaza acá y no llega a la base.
    const phoneE164 = phone ? toE164(String(phone)) : null;
    if (phone && !phoneE164) {
      return NextResponse.json({ error: 'El teléfono no es un número válido.' }, { status: 400 });
    }

    // ------------------------------------------------------------------
    // Invitación a administrar la plataforma
    //
    // Camino corto: nombre, teléfono y contraseña. No hay tienda que asociar ni
    // datos de facturación que pedir.
    // ------------------------------------------------------------------
    if (esAdmin) {
      if (!fullName || !String(fullName).trim()) {
        return NextResponse.json({ error: 'El nombre completo es un campo obligatorio.' }, { status: 400 });
      }

      if (!invite.role) {
        return NextResponse.json({ error: 'La invitación no indica un rol válido.' }, { status: 400 });
      }

      // Se valida todo antes de tocar la contraseña: `updateUser` no se puede
      // deshacer y dejaría al invitado sin poder entrar ni reintentar.
      const { error: claveError } = await supabase.auth.updateUser({ password });
      if (claveError) {
        const { message } = authErrorMessage(
          claveError,
          'No pudimos guardar la contraseña. Intenta de nuevo.',
          'accept-invite'
        );
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const { error: perfilError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: String(fullName).trim(),
          phone: phoneE164,
          role_id: invite.role,
          language: 'es',
          is_active: true,
        });

      if (perfilError) {
        return NextResponse.json({ error: `Error al crear perfil: ${perfilError.message}` }, { status: 400 });
      }

      await serviceSupabase.from('invitations').delete().eq('id', invite.id);

      return NextResponse.json({ success: true, redirectUrl: '/admin' }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // Invitación a una tienda (el flujo de siempre)
    // ------------------------------------------------------------------

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
    //
    // Con la llave de servicio, no con la sesión del invitado: la política
    // `store_members_write` exige `is_store_member(store_id)`, o sea ser YA
    // miembro de la tienda a la que uno se está sumando. Así, aceptar una
    // invitación fallaba siempre acá y dejaba a la persona con perfil pero sin
    // tienda, y la invitación sin consumir.
    //
    // No se está saltando ningún permiso: a qué tienda y con qué rol entra sale
    // de la invitación, que ya se validó arriba, no del cuerpo de la petición.
    const { error: memberError } = await serviceSupabase
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
