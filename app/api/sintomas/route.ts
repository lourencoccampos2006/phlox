import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'

// Diário de Sintomas — registo por perfil (próprio ou familiar). Grava no perfil ativo.

function makeSupabase(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

const NO_TABLE = (msg: string) =>
  /relation .*symptom_logs.* does not exist|column .*does not exist/i.test(msg) ? 503 : 500

export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const profileId = req.nextUrl.searchParams.get('profile_id')

  let query = supabase.from('symptom_logs').select('*').order('at', { ascending: false }).limit(120)
  query = profileId ? query.eq('profile_id', profileId) : query.eq('user_id', userId).is('profile_id', null)

  const { data, error } = await query
  if (error) {
    if (NO_TABLE(error.message) === 503) return NextResponse.json({ error: 'O Diário de Sintomas ainda não está ativo. Aplica supabase/sprint28_symptom_log.sql.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ logs: data || [] })
}

export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  const profileId = body.profile_id || null
  const record: any = {
    user_id: userId,
    profile_id: profileId,
    feeling: body.feeling != null ? Number(body.feeling) : null,
    symptoms: Array.isArray(body.symptoms) ? body.symptoms.slice(0, 12).map((s: any) => String(s).slice(0, 60)) : null,
    pain: body.pain != null ? Number(body.pain) : null,
    temperature: body.temperature != null && body.temperature !== '' ? Number(body.temperature) : null,
    notes: body.notes ? String(body.notes).slice(0, 600) : null,
  }
  const { data, error } = await supabase.from('symptom_logs').insert(record).select().single()
  if (error) {
    if (NO_TABLE(error.message) === 503) return NextResponse.json({ error: 'O Diário de Sintomas ainda não está ativo. Aplica supabase/sprint28_symptom_log.sql.' }, { status: 503 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (profileId && (data as any)?.profile_id == null)
    return NextResponse.json({ error: 'Registo não associado ao familiar (coluna profile_id em falta).' }, { status: 503 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const supabase = makeSupabase(req)
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'ID em falta' }, { status: 400 })
  await supabase.from('symptom_logs').delete().eq('id', id).eq('user_id', userId)
  return NextResponse.json({ ok: true })
}
