import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'

// Lista os convites (ativos e resgatados) de um perfil — só o dono vê isto.

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const supabase = sb(req)
  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { data } = await supabase.from('family_profile_shares')
    .select('id, code, created_at, redeemed_at, revoked_at')
    .eq('profile_id', profileId).eq('owner_user_id', userId)
    .order('created_at', { ascending: false })

  return NextResponse.json({ shares: data || [] })
}
