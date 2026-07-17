import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'

// Convite de Visualização (Pro) — item B9 da auditoria. O DONO de um perfil de
// família gera um código; quem o resgatar (/api/family-share/redeem) passa a
// ver (só ler) esse perfil, sem se tornar co-dono nem exigir migração de RLS.

function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes).map(b => b.toString(36)).join('').slice(0, 8).toUpperCase()
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Convite de Visualização')

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const supabase = sb(req)
  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  let code = genCode()
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.from('family_profile_shares')
      .insert({ profile_id: profileId, owner_user_id: userId, code }).select('id, code, created_at').single()
    if (!error) return NextResponse.json({ share: data })
    code = genCode()
  }
  return NextResponse.json({ error: 'Não foi possível gerar o convite. Tenta novamente.' }, { status: 500 })
}
