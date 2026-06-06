// app/api/email/test/route.ts
// Endpoint para verificar que o Resend está a funcionar.
// GET /api/email/test  → envia um email de teste para o utilizador autenticado
// (ou para ?to=email). Diz exatamente o que correu mal se falhar.
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, emailLayout } from '@/lib/email'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // Diagnóstico: a key existe?
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ ok: false, step: 'config', error: 'RESEND_API_KEY não está definida na Vercel.' }, { status: 200 })
  }

  // Descobre o email do utilizador
  let to = req.nextUrl.searchParams.get('to') || ''
  if (!to) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const { data: { user } } = await sb.auth.getUser()
    to = user?.email || ''
  }
  if (!to) return NextResponse.json({ ok: false, error: 'Sem email de destino.' }, { status: 200 })

  const r = await sendEmail({
    to,
    subject: 'Teste de email — Phlox Clinical',
    html: emailLayout({ heading: 'Funciona! ✓', body: '<p style="margin:0">Se estás a ler isto, o envio de emails (Resend) está configurado corretamente.</p>' }),
  })
  return NextResponse.json({ ...r, to, from: process.env.EMAIL_FROM || 'noreply@phloxclinical.com' })
}
