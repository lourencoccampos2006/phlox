import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { zarit12Band } from '@/lib/caregiverScales'
import { makeSupabase, getToken } from '@/lib/orgAuth'

// Escala Zarit-12 de sobrecarga do cuidador (Pro, objetivo=cuidador). Sem IA —
// pontuação determinística (lib/caregiverScales.ts) — só persiste o histórico
// por familiar, para a pessoa ver a tendência ao longo do tempo.

export async function GET(req: NextRequest) {
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Escala de sobrecarga do cuidador')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const profileId = req.nextUrl.searchParams.get('profile_id')
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })
  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const { data: checks } = await supabase.from('caregiver_burden_checks')
    .select('id,total_score,band,created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(10)

  return NextResponse.json({ checks: checks || [], latest: checks?.[0] || null })
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Escala de sobrecarga do cuidador')
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  const supabase = makeSupabase(token)

  const body = await req.json().catch(() => null)
  const profileId = body?.profile_id
  const answers = body?.answers
  if (!profileId) return NextResponse.json({ error: 'profile_id obrigatório' }, { status: 400 })
  if (!Array.isArray(answers) || answers.length !== 12 || answers.some((a: any) => typeof a !== 'number' || a < 0 || a > 4 || !Number.isInteger(a))) {
    return NextResponse.json({ error: 'São precisas 12 respostas, cada uma entre 0 e 4.' }, { status: 400 })
  }

  const { data: owned } = await supabase.from('family_profiles').select('id').eq('id', profileId).eq('user_id', userId).maybeSingle()
  if (!owned) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })

  const total = answers.reduce((a: number, b: number) => a + b, 0)
  const band = zarit12Band(total)
  const { data: row, error } = await supabase.from('caregiver_burden_checks')
    .insert({ user_id: userId, profile_id: profileId, answers, total_score: total, band })
    .select('id,total_score,band,created_at').single()
  if (error) return NextResponse.json({ error: 'Não foi possível guardar a avaliação.' }, { status: 500 })

  return NextResponse.json({ check: row })
}
