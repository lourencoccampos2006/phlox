import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

// GET /api/reach/code — devolve o código de convite do utilizador (cria se não existir).

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function makeCode(): string {
  const alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6); crypto.getRandomValues(bytes)
  const tail = Array.from(bytes, b => alpha[b % alpha.length]).join('')
  return `PHLOX-${tail}`
}

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const sb = admin()
  const { data: existing } = await sb.from('invites').select('id,code,uses,uses_limit,created_at').eq('user_id', userId).maybeSingle()
  if (existing) {
    const { data: redemptions } = await sb.from('invite_redemptions').select('id,invitee_email,at,upgraded,upgraded_at').eq('referrer_id', userId).order('at', { ascending: false })
    const upgraded = (redemptions || []).filter((r: any) => r.upgraded).length
    return NextResponse.json({ ...existing, redemptions: redemptions || [], upgraded })
  }
  // criar — tenta 5x em caso de colisão
  for (let i = 0; i < 5; i++) {
    const code = makeCode()
    const { data, error } = await sb.from('invites').insert({ user_id: userId, code }).select().single()
    if (!error && data) return NextResponse.json({ ...data, redemptions: [], upgraded: 0 })
  }
  return NextResponse.json({ error: 'Falha a gerar código' }, { status: 500 })
}
