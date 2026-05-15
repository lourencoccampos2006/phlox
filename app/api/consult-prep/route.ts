import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 5, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Login necessário' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body?.reason) return NextResponse.json({ error: 'Motivo da consulta obrigatório' }, { status: 400 })

  const authHeader = req.headers.get('authorization') || ''
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const profileId = body.profile_id || null
  const profileFilter = profileId ? (q: any) => q.eq('profile_id', profileId) : (q: any) => q.is('profile_id', null)

  const [{ data: meds }, { data: labs }] = await Promise.all([
    profileId
      ? supabase.from('family_profile_meds').select('name, dose, frequency, indication').eq('user_id', userId).eq('profile_id', profileId)
      : supabase.from('personal_meds').select('name, dose, frequency, indication').eq('user_id', userId),
    profileFilter(supabase.from('lab_records').select('date, values, flags').eq('user_id', userId).order('date', { ascending: false }).limit(3)),
  ])

  const medsSummary = (meds || []).map((m: any) => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join(', ')
  const labsSummary = (labs || []).map((l: any) => {
    const vals = (l.values || []).slice(0, 8).map((v: any) => `${v.name}: ${v.value} ${v.unit || ''} [${v.status || 'N'}]`).join(', ')
    return `${l.date}: ${vals}`
  }).join(' | ')

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico e médico de família a preparar um doente para uma consulta médica em Portugal.
Analisa o contexto clínico e gera um briefing estruturado para levar à consulta.
Responde APENAS com JSON válido:
{
  "patient_summary": "resumo clínico em 1-2 frases",
  "consultation_reason": "motivo estruturado da consulta",
  "medications_summary": ["medicamento dose frequência — o que faz em linguagem simples"],
  "recent_labs": [{"name": "parâmetro", "value": "valor", "status": "NORMAL|ALTO|BAIXO|CRITICO_ALTO|CRITICO_BAIXO", "date": "data"}],
  "active_concerns": ["preocupação activa identificada"],
  "questions_to_ask": ["pergunta específica e útil para fazer ao médico — máx 6"],
  "medication_questions": ["pergunta sobre medicação — máx 4"],
  "things_to_mention": ["coisa importante a mencionar que o doente pode esquecer — máx 5"],
  "red_flags": ["aviso urgente se existir algo que requer atenção imediata"],
  "next_steps": ["passo seguinte recomendado"]
}
Regras:
- As perguntas devem ser específicas ao contexto, não genéricas
- Se há análises alteradas, incluir perguntas sobre elas
- Se há medicação, incluir perguntas sobre possíveis ajustes
- Red flags apenas se há algo realmente preocupante
- Linguagem simples, acessível ao doente`,
      },
      {
        role: 'user',
        content: [
          `Motivo da consulta: ${body.reason}`,
          body.symptoms && `Sintomas: ${body.symptoms}`,
          body.concerns && `Preocupações: ${body.concerns}`,
          body.specialty && `Especialidade: ${body.specialty}`,
          medsSummary && `Medicação actual: ${medsSummary}`,
          labsSummary && `Análises recentes: ${labsSummary}`,
        ].filter(Boolean).join('\n'),
      },
    ], { maxTokens: 1500, temperature: 0.1 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao gerar. Tenta novamente.' }, { status: 500 })
  }
}