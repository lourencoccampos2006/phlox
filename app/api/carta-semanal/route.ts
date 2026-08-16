// app/api/carta-semanal/route.ts
// Módulo 3 (2026-08-16) — carta semanal de bem-estar. Gera SÓ um rascunho:
// junta os dados reais dos últimos 7 dias (refeições, humor, atividades,
// adesão à medicação) e pede à IA (lib/ai.ts) para os transformar numa carta
// calorosa em português simples, sem jargão clínico. Nunca envia sozinha —
// devolve {subject, body} para preencher o formulário já existente em
// /familia (Nova Mensagem), que a equipa revê, edita e só depois envia. Por
// desenho, NUNCA inclui ocorrências/incidentes — esse canal é sempre manual
// e direto (ver app/api/voice-log/extract, mesmo princípio).
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { sb } from '@/lib/orgAuth'
import { aiComplete } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 15, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Carta semanal')

  const body = await req.json().catch(() => null) as any
  const patientId = String(body?.patient_id || '')
  if (!patientId) return NextResponse.json({ error: 'patient_id obrigatório.' }, { status: 400 })

  const db = sb(req)
  const { data: patient } = await db.from('patients').select('id,name').eq('id', patientId).maybeSingle()
  if (!patient) return NextResponse.json({ error: 'Sem acesso a esta pessoa.' }, { status: 403 })

  const since = new Date(); since.setDate(since.getDate() - 7)
  const sinceStr = since.toISOString().slice(0, 10)

  const [{ data: recs }, { data: parts }, { data: doses }] = await Promise.all([
    db.from('care_records').select('date,nutrition,mood').eq('patient_id', patientId).gte('date', sinceStr),
    db.from('activity_participations').select('attended,activities(title,date)').eq('patient_id', patientId).eq('attended', true)
      .then((r: any) => r, () => ({ data: [] })),
    db.from('mar_records').select('status').eq('patient_id', patientId).gte('date', sinceStr),
  ])

  const careRecs = (recs || []) as any[]
  const meals = careRecs.flatMap(r => [r.nutrition?.breakfast, r.nutrition?.lunch, r.nutrition?.dinner]).filter((x: any) => typeof x === 'number')
  const avgMeal = meals.length ? Math.round(meals.reduce((a: number, b: number) => a + b, 0) / meals.length) : null
  const moods = careRecs.map(r => r.mood?.level).filter((x: any) => typeof x === 'number')
  const avgMood = moods.length ? moods.reduce((a: number, b: number) => a + b, 0) / moods.length : null
  const daysWithRecord = new Set(careRecs.map(r => r.date)).size
  const activityTitles = ((parts || []) as any[])
    .filter(p => p.activities && p.activities.date >= sinceStr)
    .map(p => p.activities.title)
  const doseRows = (doses || []) as any[]
  const adherencePct = doseRows.length ? Math.round((doseRows.filter(d => d.status === 'administered').length / doseRows.length) * 100) : null

  if (!daysWithRecord && !activityTitles.length) {
    return NextResponse.json({ error: 'Ainda não há registos suficientes esta semana para gerar uma carta.' }, { status: 400 })
  }

  const facts = [
    `Dias com registo esta semana: ${daysWithRecord}`,
    avgMeal != null ? `Alimentação média: ${avgMeal}% da refeição` : '',
    avgMood != null ? `Humor médio: ${avgMood.toFixed(1)}/5 (1=agitado, 5=muito bem)` : '',
    activityTitles.length ? `Atividades em que participou: ${[...new Set(activityTitles)].join(', ')}` : 'Sem atividades registadas esta semana',
    adherencePct != null ? `Adesão à medicação: ${adherencePct}%` : '',
  ].filter(Boolean).join('\n')

  try {
    const letter = await aiComplete([
      {
        role: 'system',
        content: `Escreves cartas semanais calorosas de um lar/centro de dia português para a família de um residente. Português europeu, tom próximo mas profissional, SEM jargão clínico (nunca "adesão terapêutica", diz "tomou a medicação certinha"; nunca "ingestão alimentar", diz "comeu bem"). Um parágrafo curto (4-6 frases), primeira pessoa do plural ("Esta semana..."), termina com uma nota de carinho. Usa APENAS os factos fornecidos — nunca inventes detalhes, nomes de atividades ou números que não foram dados. Se um facto não foi fornecido, não o menciones. Nunca mencionas ocorrências, quedas ou problemas de saúde — isso é comunicado à parte, diretamente.`,
      },
      { role: 'user', content: `Nome: ${patient.name}\n\nFactos desta semana:\n${facts}\n\nEscreve a carta.` },
    ], { maxTokens: 400, temperature: 0.4 })

    return NextResponse.json({
      subject: `Como foi a semana de ${patient.name.split(' ')[0]}`,
      body: letter.text.trim(),
    })
  } catch (err: any) {
    console.error('[phlox:carta-semanal]', err?.message)
    return NextResponse.json({ error: 'Não foi possível gerar a carta agora. Tenta de novo.' }, { status: 502 })
  }
}
