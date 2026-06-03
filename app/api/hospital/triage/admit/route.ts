// app/api/hospital/triage/admit/route.ts
// POST → admite um doente directamente a partir de uma triagem.
//        Chama a RPC admit_from_triage que cria episódio + marca triagem
//        como vista + opcionalmente associa cama.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan } from '@/lib/planGate'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await req.json().catch(() => null) as { triage_id?: string; bed_id?: string } | null
  if (!body?.triage_id) return NextResponse.json({ error: 'triage_id obrigatório' }, { status: 400 })

  const db = sb(req)
  const { data, error } = await db.rpc('admit_from_triage', {
    p_triage_id: body.triage_id,
    p_bed_id: body.bed_id || null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ episode_id: data })
}
