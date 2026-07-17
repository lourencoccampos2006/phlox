import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'
import { createClient } from '@supabase/supabase-js'

// Lista os perfis que outras pessoas partilharam COMIGO (resgatados, não
// revogados). A policy fps_viewer_read já permite isto ao utilizador
// autenticado (viewer_user_id = auth.uid()), mas o nome do familiar vive em
// family_profiles, cuja RLS é só do dono — por isso o segundo passo usa
// service-role apenas para ir buscar o nome (não a lista de partilhas em si).

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = sb(req)
  const { data: shares } = await supabase.from('family_profile_shares')
    .select('id, profile_id, redeemed_at').eq('viewer_user_id', userId).is('revoked_at', null)
    .order('redeemed_at', { ascending: false })

  if (!shares?.length) return NextResponse.json({ shared: [] })

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const ids = shares.map(s => s.profile_id)
  const { data: profiles } = await db.from('family_profiles').select('id, name, relation').in('id', ids)
  const byId = new Map((profiles || []).map((p: any) => [p.id, p]))

  return NextResponse.json({
    shared: shares.map(s => ({ profile_id: s.profile_id, name: byId.get(s.profile_id)?.name || 'Familiar', relation: byId.get(s.profile_id)?.relation || null })),
  })
}
