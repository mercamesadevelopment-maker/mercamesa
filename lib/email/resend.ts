import { getResendApiKey, getResendFromEmail } from '@/lib/env';

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getResendApiKey()}`,
    },
    body: JSON.stringify({
      from: getResendFromEmail(),
      to,
      subject,
      html,
    }),
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.message || 'Failed to send email via Resend');
  }

  return result;
}

/**
 * El molde de todos los correos.
 *
 * Estaba copiado entero en cada plantilla —los mismos 15 estilos, la misma
 * cabecera, el mismo pie— y con cada aviso nuevo se copiaba otra vez. Cambiar un
 * color obligaba a acordarse de todas; en la práctica, se desincronizaban.
 *
 * Lo único que de verdad cambia entre un correo y otro es el título, el
 * encabezado y los párrafos.
 */
function plantilla({
  title,
  heading,
  body,
}: {
  /** Lo que se ve en la pestaña y en la vista previa del cliente de correo. */
  title: string;
  heading: string;
  /** Contenido ya en HTML: párrafos `.text`, el bloque `.code`, lo que haga falta. */
  body: string;
}) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title} - Mercamesa</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #FAFAF5; color: #1A2610; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(26, 51, 8, 0.08); border: 1px solid #E2E2D0; }
        .header { background-color: #1A3308; padding: 40px 20px; text-align: center; }
        .content { padding: 40px 30px; text-align: center; }
        .title { font-family: Georgia, serif; font-size: 26px; color: #1A3308; margin-top: 0; margin-bottom: 20px; font-weight: bold; }
        .text { font-size: 16px; line-height: 1.6; color: #3D4D2E; margin-bottom: 24px; }
        .code { display: inline-block; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #1A3308; background-color: #F5F8F0; border: 1px solid #E2E2D0; border-radius: 16px; padding: 16px 24px; margin-bottom: 24px; }
        .highlight { font-weight: bold; color: #1A3308; }
        .footer { background-color: #F5F8F0; padding: 24px; text-align: center; font-size: 12px; color: #707A65; border-top: 1px solid #E2E2D0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span style="color:#ffffff;font-family:Georgia,serif;font-size:22px;font-weight:bold;">MercaMesa</span>
        </div>
        <div class="content">
          <h2 class="title">${heading}</h2>
          ${body}
        </div>
        <div class="footer">
          <p>&copy; 2026 Mercamesa. Todos los derechos reservados.<br>Conectando el campo y la ciudad.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * La fecha y hora en Colombia, para los avisos de seguridad. Sin ella, «tu
 * contraseña cambió» no le sirve a quien necesita decidir si fue él: lo que
 * responde esa pregunta es *cuándo*.
 */
function momentoEnColombia(): string {
  return new Date().toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

// ---------------------------------------------------------------------------
// Códigos
// ---------------------------------------------------------------------------

export function passwordResetCodeEmail(code: string) {
  return plantilla({
    title: 'Recupera tu contraseña',
    heading: 'Recupera tu contraseña',
    body: `
      <p class="text">Usa este código para continuar con la recuperación de tu contraseña. Vence en 10 minutos.</p>
      <div class="code">${code}</div>
      <p class="text">Si tú no solicitaste este código, puedes ignorar este correo.</p>
    `,
  });
}

export function emailChangeCodeEmail(code: string) {
  return plantilla({
    title: 'Confirma tu nuevo correo',
    heading: 'Confirma tu nuevo correo',
    body: `
      <p class="text">Usa este código para confirmar que este es tu nuevo correo en MercaMesa. Vence en 10 minutos.</p>
      <div class="code">${code}</div>
      <p class="text">Si tú no solicitaste este cambio, puedes ignorar este correo.</p>
    `,
  });
}

export function passwordChangeCodeEmail(code: string) {
  return plantilla({
    title: 'Confirma el cambio de contraseña',
    heading: 'Confirma el cambio de contraseña',
    body: `
      <p class="text">Usa este código para confirmar que eres tú quien está cambiando la contraseña. Vence en 10 minutos.</p>
      <div class="code">${code}</div>
      <p class="text">Si <strong>no</strong> estás cambiando tu contraseña, alguien podría tener acceso a tu cuenta: no uses este código y cámbiala cuanto antes.</p>
    `,
  });
}

export function signupCodeEmail(code: string) {
  return plantilla({
    title: 'Confirma tu correo',
    heading: 'Confirma tu correo',
    body: `
      <p class="text">Usa este código para terminar de crear tu cuenta en MercaMesa. Vence en 10 minutos.</p>
      <div class="code">${code}</div>
      <p class="text">Si tú no estás creando una cuenta, puedes ignorar este correo.</p>
    `,
  });
}

export function adminLoginCodeEmail(code: string) {
  return plantilla({
    title: 'Tu código para ingresar',
    heading: 'Tu código para ingresar',
    body: `
      <p class="text">Usa este código para terminar de ingresar a MercaMesa. Vence en 10 minutos.</p>
      <div class="code">${code}</div>
      <p class="text">Fecha del intento: <span class="highlight">${momentoEnColombia()}</span></p>
      <p class="text">Si <strong>no</strong> estás ingresando, alguien más tiene tu contraseña: no uses este código y cámbiala de inmediato.</p>
    `,
  });
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export function emailChangeNotificationEmail(newEmail: string) {
  return plantilla({
    title: 'Solicitud de cambio de correo',
    heading: 'Se solicitó cambiar tu correo',
    body: `
      <p class="text">Alguien solicitó cambiar el correo de tu cuenta MercaMesa a <span class="highlight">${newEmail}</span>.</p>
      <p class="text">Fecha de la solicitud: <span class="highlight">${momentoEnColombia()}</span></p>
      <p class="text">Si fuiste tú, no necesitas hacer nada más. Si <strong>no</strong> reconoces esta solicitud, cambia tu contraseña de inmediato.</p>
    `,
  });
}

export function passwordChangedEmail() {
  return plantilla({
    title: 'Contraseña actualizada',
    heading: 'Tu contraseña fue actualizada',
    body: `
      <p class="text">Acabas de cambiar la contraseña de tu cuenta MercaMesa.</p>
      <p class="text">Fecha del cambio: <span class="highlight">${momentoEnColombia()}</span></p>
      <p class="text">Si <strong>no</strong> reconoces este cambio, alguien más podría tener acceso a tu cuenta: recupérala desde «¿Olvidaste tu contraseña?» cuanto antes.</p>
    `,
  });
}

export function emailChangeConfirmedEmail(newEmail: string, previousEmail?: string) {
  return plantilla({
    title: 'Correo actualizado',
    heading: 'Tu correo fue actualizado',
    body: `
      <p class="text">El correo de tu cuenta MercaMesa ahora es <span class="highlight">${newEmail}</span>.</p>
      ${previousEmail ? `<p class="text">Antes era <span class="highlight">${previousEmail}</span>.</p>` : ''}
      <p class="text">Fecha del cambio: <span class="highlight">${momentoEnColombia()}</span></p>
      <p class="text">Si <strong>no</strong> reconoces este cambio, recupera tu cuenta desde «¿Olvidaste tu contraseña?» cuanto antes.</p>
    `,
  });
}

export function legalDocumentUpdatedEmail(etiqueta: string, version: number, url: string) {
  return plantilla({
    title: `Se actualizó: ${etiqueta}`,
    heading: `Se actualizó: ${etiqueta}`,
    body: `
      <p class="text">Publicamos la versión <span class="highlight">${version}</span> de ${etiqueta.toLowerCase()}. Te lo contamos porque te afecta: al entrar a MercaMesa te pediremos aceptarla para poder seguir.</p>
      <p class="text">Fecha de la publicación: <span class="highlight">${momentoEnColombia()}</span></p>
      <p class="text">
        <a href="${url}" style="display:inline-block;background-color:#1A3308;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 28px;border-radius:16px;">Leer el documento</a>
      </p>
      <p class="text">Si el botón no funciona, copia este enlace en tu navegador:<br><span style="word-break:break-all;">${url}</span></p>
    `,
  });
}
