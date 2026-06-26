// app/api/email/welcome/route.ts
// Envia o email de boas-vindas UMA vez por conta. É idempotente: marca
// welcome_email_sent no perfil para nunca enviar duas vezes (mesmo que o cliente
// chame isto mais do que uma vez por causa de re-renders).
//
// Chamado pelo AuthContext logo a seguir a criar o perfil de um utilizador novo.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, welcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  // Precisa do token do utilizador (Authorization: Bearer ...) para saber QUEM é —
  // assim ninguém pode disparar emails de boas-vindas em nome de outra conta.
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ ok: false, error: 'no-auth' }, { status: 401 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user?.email) return NextResponse.json({ ok: false, error: 'no-user' }, { status: 401 })

  // Idempotência: usa o service-role para ler/escrever a flag sem bater na RLS.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // A coluna welcome_email_sent pode ainda não existir (migração por correr).
  // Se existir, usamo-la para não enviar duas vezes; se não, enviamos na mesma
  // (o pior caso é o utilizador receber 1 email a mais, não um erro).
  let name = user.user_metadata?.full_name || ''
  let hasFlagColumn = true
  const { data: prof, error: selErr } = await admin
    .from('profiles')
    .select('welcome_email_sent, name')
    .eq('id', user.id)
    .single()

  if (selErr && /welcome_email_sent/.test(selErr.message || '')) {
    hasFlagColumn = false
    const { data: p2 } = await admin.from('profiles').select('name').eq('id', user.id).single()
    name = p2?.name || name
  } else if (prof) {
    if (prof.welcome_email_sent) return NextResponse.json({ ok: true, already: true })
    name = prof.name || name
  }

  const t = welcomeEmail(name)
  const r = await sendEmail({ to: user.email, subject: t.subject, html: t.html })

  // Só marca como enviado se o envio correu — senão tentamos de novo no próximo login.
  if (r.ok && hasFlagColumn) {
    await admin.from('profiles').update({ welcome_email_sent: true }).eq('id', user.id)
  }
  return NextResponse.json({ ok: r.ok, error: r.error })
}
