import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { getClientIp } from '@/lib/auth/verification-codes';
import { getMeteorWhatsappNumber } from '@/lib/env';
import { requestPhoneVerification, whatsappVerificationUrl } from '@/lib/phone/verification';

/**
 * Da el código con el que el usuario verifica su teléfono: se lo manda a
 * Carolina por WhatsApp desde ese número (ver `lib/phone/verification.ts`).
 *
 * El estado se lee del perfil (`phone_verified_at`, en `GET /api/profile`).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const whatsappNumber = getMeteorWhatsappNumber();
    if (!whatsappNumber) {
      return NextResponse.json(
        { error: 'La verificación por WhatsApp todavía no está disponible.' },
        { status: 503 }
      );
    }

    const { data: perfil } = await supabase
      .from('profiles')
      .select('email, phone, phone_verified_at')
      .eq('id', user.id)
      .single();

    if (!perfil?.phone) {
      return NextResponse.json({ error: 'Primero guarda tu número de celular.' }, { status: 400 });
    }
    if (perfil.phone_verified_at) {
      return NextResponse.json({ error: 'Tu número ya está verificado.' }, { status: 409 });
    }

    const service = createSupabaseServiceClient();
    const resultado = await requestPhoneVerification(service, {
      userId: user.id,
      email: perfil.email,
      phone: perfil.phone,
      ip: getClientIp(request),
    });

    if ('limit' in resultado) {
      return NextResponse.json(
        { error: resultado.limit.error, retryAfterSeconds: resultado.limit.retryAfterSeconds },
        { status: resultado.limit.status }
      );
    }

    return NextResponse.json(
      {
        code: resultado.code,
        expiresAt: resultado.expiresAt,
        whatsappUrl: whatsappVerificationUrl(whatsappNumber, resultado.code),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('profile/phone-verification', error);
    return NextResponse.json({ error: 'No pudimos generar el código. Intenta de nuevo.' }, { status: 500 });
  }
}
