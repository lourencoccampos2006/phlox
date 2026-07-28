import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'

// Lista os convites (ativos e resgatados) de um perfil — só o dono vê isto.
// Inclui o NOME de quem resgatou cada convite — sem isto, o dono via só um
// código e "✓ Resgatado", sem saber QUEM é essa pessoa (pedido: "quem mais
// tem acesso a este perfil" tem de ser óbvio, não só "alguém resgatou").

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })

  const supabase = sb(req)
  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { data } = await supabase.from('family_profile_shares')
    .select('id, code, created_at, redeemed_at, revoked_at, viewer_user_id')
    .eq('profile_id', profileId).eq('owner_user_id', userId)
    .order('created_at', { ascending: false })

  const viewerIds = Array.from(new Set((data || []).map(s => s.viewer_user_id).filter(Boolean)))
  let viewerName: Record<string, string> = {}
  if (viewerIds.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: profs } = await admin.from('profiles').select('id, name').in('id', viewerIds as string[])
    ;(profs || []).forEach((p: any) => { viewerName[p.id] = p.name })
  }
  const shares = (data || []).map(s => ({ ...s, viewer_name: s.viewer_user_id ? (viewerName[s.viewer_user_id] || 'Conta Phlox') : null }))

  return NextResponse.json({ shares })
}
