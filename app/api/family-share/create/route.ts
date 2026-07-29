import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'

// Convite de partilha (Pro) — item B9 da auditoria, alargado (sprint121) com
// um papel: 'viewer' (só ver, o que já existia) ou 'editor' (gestão a dois —
// pode adicionar/editar medicação e registar vitais/sintomas, tal como o
// dono). O DONO de um perfil de família gera o código; quem o resgatar
// (/api/family-share/redeem) fica com o papel escolhido AQUI, sem se tornar
// co-dono na RLS nem exigir migração de esquema — ver sprint121_family_
// profile_editor_role.sql.

function genCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes).map(b => b.toString(36)).join('').slice(0, 8).toUpperCase()
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Convite de Partilha')

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id
  const role = body?.role === 'editor' ? 'editor' : 'viewer'
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const supabase = sb(req)
  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  let code = genCode()
  for (let i = 0; i < 3; i++) {
    const { data, error } = await supabase.from('family_profile_shares')
      .insert({ profile_id: profileId, owner_user_id: userId, code, role }).select('id, code, created_at, role').single()
    if (!error) return NextResponse.json({ share: data })
    code = genCode()
  }
  return NextResponse.json({ error: 'Não foi possível gerar o convite. Tenta novamente.' }, { status: 500 })
}
