import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Reconciliação Medicamentosa')

  const body = await req.json().catch(() => null)
  if (!body?.before || !body?.after) return NextResponse.json({ error: 'Listas obrigatórias' }, { status: 400 })

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacêutico clínico especialista em reconciliação medicamentosa. Analisa duas listas de medicamentos (antes e depois de internamento ou mudança de serviço) e identifica discrepâncias. Responde APENAS com JSON válido, sem markdown, em português PT-PT.

JSON esperado:
{
  "summary": "resumo em 1-2 frases",
  "discrepancies": [
    {
      "type": "added|removed|dose_changed|frequency_changed|intentional_omission",
      "drug": "nome do fármaco",
      "before": "dose/frequência antes (se aplicável)",
      "after": "dose/frequência depois (se aplicável)",
      "severity": "critical|moderate|low",
      "action_required": "o que o clínico deve fazer",
      "justification_needed": true|false
    }
  ],
  "unintentional_omissions": ["fármaco que parece ter sido omitido por engano"],
  "therapeutic_duplications": ["par de fármacos com efeito duplicado"],
  "recommendations": ["recomendação prática 1", "recomendação 2"],
  "reconciliation_complete": true|false
}

Regras:
- severity critical: omissão não intencional de fármaco essencial, duplicação terapêutica
- severity moderate: alteração de dose >50%, adição de fármaco sem contexto clínico óbvio
- severity low: alteração menor, adição profilática previsível (ex: heparina no internamento)
- justification_needed: true para qualquer discrepância que deve ficar documentada no processo`,
    },
    {
      role: 'user',
      content: `Lista ANTES do internamento:\n${body.before}\n\nLista DEPOIS (nota de alta / prescrição actual):\n${body.after}${body.context ? `\n\nContexto clínico: ${body.context}` : ''}`,
    },
  ], { maxTokens: 2000, temperature: 0.2 })

  return NextResponse.json(result)
}