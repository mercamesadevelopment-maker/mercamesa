import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, fullName, storeName, roleLabel, loginUrl } = await req.json()

    if (!email || !storeName || !roleLabel) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'onboarding@resend.dev'

    if (!resendApiKey) {
      console.error('RESEND_API_KEY secret is not set in Supabase')
      return new Response(JSON.stringify({ error: 'Mail service is not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    const appRedirectUrl = loginUrl || 'https://mercamesa.com'

    // HTML Email Template
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Asignación de Tienda en Mercamesa</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #FAFAF5;
          color: #1A2610;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(26, 51, 8, 0.08);
          border: 1px solid #E2E2D0;
        }
        .header {
          background-color: #1A3308;
          padding: 40px 20px;
          text-align: center;
        }
        .header img {
          max-height: 50px;
          display: inline-block;
        }
        .content {
          padding: 40px 30px;
          text-align: center;
        }
        .title {
          font-family: Georgia, serif;
          font-size: 26px;
          color: #1A3308;
          margin-top: 0;
          margin-bottom: 20px;
          font-weight: bold;
        }
        .text {
          font-size: 16px;
          line-height: 1.6;
          color: #3D4D2E;
          margin-bottom: 24px;
        }
        .card {
          background-color: #F5F8F0;
          border: 1px solid #E2E2D0;
          border-radius: 16px;
          padding: 20px;
          margin: 0 auto 30px auto;
          text-align: left;
          max-width: 400px;
        }
        .card-item {
          margin-bottom: 12px;
          font-size: 15px;
          color: #3D4D2E;
        }
        .card-item:last-child {
          margin-bottom: 0;
        }
        .card-label {
          font-weight: bold;
          color: #1A3308;
        }
        .button-container {
          margin-bottom: 30px;
        }
        .btn {
          background-color: #2A4E12;
          color: #ffffff !important;
          padding: 14px 32px;
          text-decoration: none;
          font-weight: bold;
          border-radius: 12px;
          display: inline-block;
          font-size: 16px;
        }
        .footer {
          background-color: #F5F8F0;
          padding: 24px;
          text-align: center;
          font-size: 12px;
          color: #707A65;
          border-top: 1px solid #E2E2D0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://mercamesa.com/wp-content/uploads/2025/09/logo-mercamesa-opt.png" alt="Mercamesa Logo">
        </div>
        <div class="content">
          <h2 class="title">¡Hola, ${fullName}!</h2>
          <p class="text">Queremos informarte que has sido asignado a una tienda dentro de la plataforma Mercamesa. A continuación se presentan los detalles de tu nueva asignación:</p>
          
          <div class="card">
            <div class="card-item"><span class="card-label">Tienda:</span> ${storeName}</div>
            <div class="card-item"><span class="card-label">Rol:</span> ${roleLabel}</div>
          </div>
          
          <p class="text">Ya puedes ingresar a tu panel de administración para empezar a gestionar la tienda.</p>
          
          <div class="button-container">
            <a href="${appRedirectUrl}" class="btn" style="color: #ffffff;">Acceder a mi panel</a>
          </div>
        </div>
        <div class="footer">
          <p>&copy; 2026 Mercamesa. Todos los derechos reservados.<br>Conectando el campo y la ciudad.</p>
        </div>
      </div>
    </body>
    </html>
    `

    // Send email using Resend REST API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: email,
        subject: `Has sido asignado a la tienda "${storeName}" - Mercamesa`,
        html: htmlContent
      })
    })

    const result = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(result.message || 'Failed to send email via Resend')
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
