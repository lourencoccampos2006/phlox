import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Resgatar um código de Convite de Visualização — NENHUMA policy de RLS
// permite isto diretamente (o convite ainda não pertence a ninguém enquanto
// viewer_user_id é null, e quem resgata não é o dono), por isso esta rota usa
// a service-role key e faz a SUA PRÓPRIA verificação explícita: o código tem
// de existir, não estar já resgatado por outra pessoa, e não estar revogado.
// Resgatar não exige plano Pro — só CRIAR o convite exige (é o dono que paga
// a funcionalidade, quem recebe o convite não devia ter de pagar para ver).

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const code = String(body?.code || '').trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Código obrigatório' }, { status: 400 })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: share } = await db.from('family_profile_shares').select('id, profile_id, owner_user_id, viewer_user_id, revoked_at, role').eq('code', code).maybeSingle()
  if (!share) return NextResponse.json({ error: 'Código inválido.' }, { status: 404 })
  if (share.revoked_at) return NextResponse.json({ error: 'Este convite foi revogado.' }, { status: 410 })
  if (share.owner_user_id === userId) return NextResponse.json({ error: 'Não podes resgatar o teu próprio convite.' }, { status: 400 })
  if (share.viewer_user_id && share.viewer_user_id !== userId) return NextResponse.json({ error: 'Este convite já foi resgatado por outra pessoa.' }, { status: 409 })

  if (!share.viewer_user_id) {
    await db.from('family_profile_shares').update({ viewer_user_id: userId, redeemed_at: new Date().toISOString() }).eq('id', share.id)
  }
  const { data: profile } = await db.from('family_profiles').select('name').eq('id', share.profile_id).maybeSingle()
  return NextResponse.json({ ok: true, profile_id: share.profile_id, profile_name: profile?.name || 'Familiar', role: share.role === 'editor' ? 'editor' : 'viewer' })
}
