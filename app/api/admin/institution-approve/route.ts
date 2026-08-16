import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, adminDb } from '@/lib/adminAuth'

// POST /api/admin/institution-approve { email } — marca institution_signup_
// approved=true no profile. É o passo que falta para essa pessoa conseguir
// criar a instituição dela própria em /comecar-instituicao (ver o bloqueio em
// app/api/org/setup, sprint da correção de segurança 2026-07-28). Não cria a
// organização — só dá luz verde para a pessoa o fazer.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const email = String(body?.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Indica o email.' }, { status: 400 })

  const db = adminDb()
  const { data: profile, error: findErr } = await db.from('profiles').select('id, email, name, institution_signup_approved').ilike('email', email).maybeSingle()
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: 'Não encontrei nenhuma conta com este email. A pessoa precisa de criar conta grátis primeiro.' }, { status: 404 })

  const { error } = await db.from('profiles').update({ institution_signup_approved: true }).eq('id', profile.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, profile: { id: profile.id, email: profile.email, name: profile.name } })
}
