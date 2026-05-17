import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!checkRateLimit(ip, 5, 60_000).allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: {
    suspected_drug: string
    reaction: string
    onset_date?: string
    action_taken?: string
    outcome?: string
    patient_age?: number
    patient_sex?: string
    other_drugs?: string
  } = { suspected_drug: '', reaction: '' }

  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  if (!body.suspected_drug?.trim() || !body.reaction?.trim()) {
    return NextResponse.json({ error: 'Medicamento suspeito e reação são obrigatórios' }, { status: 400 })
  }

  const prompt = `És um especialista em farmacovigilância. Com base nos dados fornecidos, gera uma análise estruturada de reação adversa a medicamento (RAM) conforme CIOMS/WHO-UMC.

MEDICAMENTO SUSPEITO: ${body.suspected_drug}
REAÇÃO: ${body.reaction}
${body.onset_date ? `DATA DE INÍCIO: ${body.onset_date}` : ''}
${body.action_taken ? `AÇÃO TOMADA: ${body.action_taken}` : ''}
${body.outcome ? `RESULTADO: ${body.outcome}` : ''}
${body.patient_age ? `IDADE: ${body.patient_age} anos` : ''}
${body.patient_sex ? `SEXO: ${body.patient_sex}` : ''}
${body.other_drugs ? `OUTROS MEDICAMENTOS: ${body.other_drugs}` : ''}

Devolve APENAS JSON:
{
  "who_umc_causality": "Definida" | "Provável" | "Possível" | "Improvável" | "Inclassificável",
  "who_umc_score": 1-9,
  "seriousness": "Grave" | "Não grave",
  "seriousness_criteria": ["lista de critérios que se aplicam: morte, risco de vida, hospitalização, incapacidade, anomalia congénita, medicamente significativo"],
  "meddra_term": "termo MedDRA mais adequado (PT level)",
  "soc": "System Organ Class MedDRA",
  "mechanism": "mecanismo farmacológico provável (1-2 frases)",
  "similar_reports": "existência de casos semelhantes na literatura/INFARMED",
  "recommendations": ["lista de recomendações: continuar, suspender, substituir, reduzir dose, monitorizar"],
  "infarmed_report_required": true | false,
  "infarmed_deadline_days": número de dias para reportar (15 para graves, 90 para não graves),
  "summary": "resumo narrativo para reportar (2-3 frases, linguagem técnica)",
  "disclaimer": "nota sobre limitações desta análise automática"
}

Responde APENAS JSON.`

  try {
    const result = await aiJSON<any>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1000 }
    )
    return NextResponse.json({
      who_umc_causality: result?.who_umc_causality || 'Possível',
      who_umc_score: typeof result?.who_umc_score === 'number' ? result.who_umc_score : null,
      seriousness: result?.seriousness || 'Não grave',
      seriousness_criteria: Array.isArray(result?.seriousness_criteria) ? result.seriousness_criteria.map((c: any) => String(c).slice(0, 100)) : [],
      meddra_term: String(result?.meddra_term || '').slice(0, 200),
      soc: String(result?.soc || '').slice(0, 200),
      mechanism: String(result?.mechanism || '').slice(0, 400),
      similar_reports: String(result?.similar_reports || '').slice(0, 300),
      recommendations: Array.isArray(result?.recommendations) ? result.recommendations.map((r: any) => String(r).slice(0, 200)) : [],
      infarmed_report_required: Boolean(result?.infarmed_report_required),
      infarmed_deadline_days: typeof result?.infarmed_deadline_days === 'number' ? result.infarmed_deadline_days : 90,
      summary: String(result?.summary || '').slice(0, 600),
      disclaimer: String(result?.disclaimer || 'Esta análise é gerada por IA e não substitui a avaliação de um profissional de farmacovigilância.').slice(0, 400),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro na análise' }, { status: 500 })
  }
}
