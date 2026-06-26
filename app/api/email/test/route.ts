// app/api/email/test/route.ts
// Endpoint para verificar que o Resend está a funcionar.
// GET /api/email/test  → envia um email de teste para o utilizador autenticado
// (ou para ?to=email). Diz exatamente o que correu mal se falhar.
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailLayout } from '@/lib/email'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

// Resposta JSON com charset UTF-8 explícito (senão os acentos saem partidos:
// "NÃ£o" em vez de "Não") e legível no browser.
function ok(body: any, status = 200) {
  return new NextResponse(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export async function GET(req: NextRequest) {
  // Teste do telemóvel SEM sessão: usa um token DEDICADO e descartável
  // (EMAIL_TEST_TOKEN), NUNCA o CRON_SECRET — para um link que possa vazar não
  // expor o segredo do cron. Mesmo com o token, só se pode enviar para emails
  // de uma allowlist (EMAIL_TEST_ALLOWLIST), por isso o estrago de uma fuga é nulo.
  const testToken = req.nextUrl.searchParams.get('t')
  const viaToken = !!process.env.EMAIL_TEST_TOKEN && testToken === process.env.EMAIL_TEST_TOKEN

  let to = req.nextUrl.searchParams.get('to') || ''

  if (viaToken) {
    const allow = (process.env.EMAIL_TEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    if (!to) to = allow[0] || ''
    if (allow.length && !allow.includes(to.toLowerCase())) {
      return ok({ ok: false, error: 'Esse email não está na allowlist de teste (EMAIL_TEST_ALLOWLIST).' }, 403)
    }
  } else {
    const { userId } = await getUserPlan(req)
    if (!userId) {
      return ok({ error: 'Não autenticado. Para testar pelo browser, define a variável EMAIL_TEST_TOKEN na Vercel e abre: /api/email/test?t=O_TEU_EMAIL_TEST_TOKEN' }, 401)
    }
    if (!to) {
      const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
      const { data: { user } } = await sb.auth.getUser()
      to = user?.email || ''
    }
  }

  // Diagnóstico: a key existe?
  if (!process.env.RESEND_API_KEY) {
    return ok({ ok: false, step: 'config', error: 'RESEND_API_KEY não está definida na Vercel → Settings → Environment Variables.' })
  }
  if (!to) {
    return ok({ ok: false, error: 'Sem email de destino. Acrescenta &to=o-teu@email.pt ao link.' })
  }

  const from = process.env.EMAIL_FROM || 'noreply@phloxclinical.com'
  const r = await sendEmail({
    to,
    subject: 'Teste de email — Phlox',
    html: emailLayout({ heading: 'Funciona! ✓', body: '<p style="margin:0">Se está a ler isto, o envio de emails (Resend) está configurado corretamente.</p>' }),
  })

  // Mensagem clara consoante o resultado.
  if (r.ok) {
    return ok({ ok: true, mensagem: `Email enviado para ${to}. Confirma a caixa de entrada (e o spam).`, id: r.id, from })
  }
  return ok({
    ok: false,
    erro_do_resend: r.error,
    from,
    para: to,
    dica: 'O motivo mais comum: o domínio do remetente não está VERIFICADO no Resend. Vai a resend.com → Domains, adiciona phloxclinical.com e mete os registos DNS. Enquanto não verificas, só consegues enviar para o teu próprio email de registo no Resend.',
  })
}
