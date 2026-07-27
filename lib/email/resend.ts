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

export function passwordResetCodeEmail(code: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Recupera tu contraseña - Mercamesa</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #FAFAF5; color: #1A2610; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 20px rgba(26, 51, 8, 0.08); border: 1px solid #E2E2D0; }
        .header { background-color: #1A3308; padding: 40px 20px; text-align: center; }
        .content { padding: 40px 30px; text-align: center; }
        .title { font-family: Georgia, serif; font-size: 26px; color: #1A3308; margin-top: 0; margin-bottom: 20px; font-weight: bold; }
        .text { font-size: 16px; line-height: 1.6; color: #3D4D2E; margin-bottom: 24px; }
        .code { display: inline-block; font-size: 36px; letter-spacing: 8px; font-weight: bold; color: #1A3308; background-color: #F5F8F0; border: 1px solid #E2E2D0; border-radius: 16px; padding: 16px 24px; margin-bottom: 24px; }
        .footer { background-color: #F5F8F0; padding: 24px; text-align: center; font-size: 12px; color: #707A65; border-top: 1px solid #E2E2D0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span style="color:#ffffff;font-family:Georgia,serif;font-size:22px;font-weight:bold;">MercaMesa</span>
        </div>
        <div class="content">
          <h2 class="title">Recupera tu contraseña</h2>
          <p class="text">Usa este código para continuar con la recuperación de tu contraseña. Vence en 10 minutos.</p>
          <div class="code">${code}</div>
          <p class="text">Si tú no solicitaste este código, puedes ignorar este correo.</p>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mercamesa. Todos los derechos reservados.<br>Conectando el campo y la ciudad.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
