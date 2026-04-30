import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

interface MedInput {
  name: string
  dose?: string
  frequency?: string
}

interface PatientCtx {
  age?: number
  sex?: 'M' | 'F'
  weight?: number
  creatinine?: number
  conditions?: string
  allergies?: string
}

interface MonitorAlert {
  type: 'interaction' | 'renal' | 'beers' | 'duplication' | 'monitoring' | 'contraindication'
  severity: 'critical' | 'major' | 'moderate' | 'minor'
  drugs_involved: string[]
  message: string
  action: string
  evidence: string
}

interface MonitorResult {
  alerts: MonitorAlert[]
  score: number
  summary: string
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.medications || !Array.isArray(body.medications) || body.medications.length === 0) {
    return NextResponse.json({ error: 'Lista de medicamentos obrigatória.' }, { status: 400 })
  }

  const meds: MedInput[] = (body.medications as MedInput[]).slice(0, 20).map((m: MedInput) => ({
    name: String(m.name || '').trim().slice(0, 80),
    dose: m.dose ? String(m.dose).trim().slice(0, 40) : undefined,
    frequency: m.frequency ? String(m.frequency).trim().slice(0, 40) : undefined,
  })).filter(m => m.name)

  if (meds.length === 0) return NextResponse.json({ error: 'Nenhum medicamento válido.' }, { status: 400 })

  const ctx: PatientCtx = body.patient_context || {}
  const patientStr = [
    ctx.age ? `${ctx.age} anos` : null,
    ctx.sex ? (ctx.sex === 'F' ? 'sexo feminino' : 'sexo masculino') : null,
    ctx.weight ? `${ctx.weight} kg` : null,
    ctx.creatinine ? `creatinina ${ctx.creatinine} µmol/L` : null,
    ctx.conditions ? `comorbilidades: ${String(ctx.conditions).slice(0, 200)}` : null,
    ctx.allergies ? `alergias: ${String(ctx.allergies).slice(0, 100)}` : null,
  ].filter(Boolean).join(', ')

  const medsStr = meds.map(m =>
    `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` (${m.frequency})` : ''}`
  ).join(', ')

  try {
    const result = await aiJSON<MonitorResult>([
      {
        role: 'system',
        content: `És um farmacologista clínico especialista em polimedicação. Analisa listas de medicamentos e identifica problemas clínicos relevantes em PT-PT (português europeu).

Responde APENAS com JSON válido sem markdown:
{
  "alerts": [
    {
      "type": "interaction|renal|beers|duplication|monitoring|contraindication",
      "severity": "critical|major|moderate|minor",
      "drugs_involved": ["nome1", "nome2"],
      "message": "descrição clínica clara do problema (1-2 frases)",
      "action": "acção recomendada concreta (1 frase)",
      "evidence": "fonte/guideline de suporte (ex: FDA, KDIGO 2022, Critérios Beers 2023)"
    }
  ],
  "score": 0-100,
  "summary": "resumo clínico global em 2-3 frases"
}

Tipos de alertas a verificar:
- interaction: interacções farmacodinâmicas e farmacocinéticas (inibição/indução CYP, prolongamento QT, hipotensão aditiva, nefrotoxicidade, etc.)
- renal: ajuste de dose necessário com disfunção renal (usa creatinina/TFG se disponível)
- beers: medicamentos potencialmente inapropriados em idosos (Critérios Beers AGS 2023)
- duplication: duplicação terapêutica ou farmacológica
- monitoring: parâmetros que devem ser monitorizados com urgência
- contraindication: contra-indicações absolutas ou relativas ao contexto do doente

Score: 100 = perfil completamente seguro, 0 = múltiplos problemas críticos.
Máximo 8 alertas. Prioriza os mais clinicamente relevantes.
Se não há alertas relevantes responde com alerts:[], score:100 e um summary adequado.`,
      },
      {
        role: 'user',
        content: `Medicação: ${medsStr}${patientStr ? `\n\nContexto do doente: ${patientStr}` : ''}`,
      },
    ], { maxTokens: 2000, temperature: 0.0 })

    // Validate + sanitise output
    const alerts: MonitorAlert[] = (result.alerts || [])
      .slice(0, 8)
      .filter((a: MonitorAlert) =>
        a.message && a.action && Array.isArray(a.drugs_involved) &&
        ['critical', 'major', 'moderate', 'minor'].includes(a.severity)
      )

    const score = typeof result.score === 'number'
      ? Math.max(0, Math.min(100, Math.round(result.score)))
      : 100

    return NextResponse.json({
      alerts,
      score,
      summary: String(result.summary || '').slice(0, 400),
    })

  } catch (err: any) {
    console.error('Monitor route error:', err?.message)
    return NextResponse.json({ error: 'Erro na análise. Tenta novamente.' }, { status: 500 })
  }
}
