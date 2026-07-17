import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { sb } from '@/lib/orgAuth'

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const shareId = body?.share_id
  if (!shareId) return NextResponse.json({ error: 'share_id obrigatório' }, { status: 400 })

  const supabase = sb(req)
  const { error } = await supabase.from('family_profile_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId).eq('owner_user_id', userId)
  if (error) return NextResponse.json({ error: 'Não foi possível revogar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
