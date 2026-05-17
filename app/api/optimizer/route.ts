import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

interface Med { name: string; dose?: string|null; frequency?: string|null; indication?: string|null; started_at?: string|null }
interface PatientContext { age?: number|null; sex?: string|null; weight?: number|null; creatinine?: number|null; conditions?: string|null }

interface SavingItem {
  drug: string; brand_cost: string; generic_name: string; generic_cost: string
  monthly_saving: string; equivalence_note: string
}
interface SafetyFlag {
  drug: string; issue: string; reason: string
  severity: 'high'|'medium'|'low'; action: string; evidence: string
}
interface MonitoringGap {
  drug: string; monitoring: string; frequency: string
  last_done: string|null; why_important: string
}
interface DoseReview {
  drug: string; current_dose: string; suggested_dose: string
  reason: string; condition: 'renal'|'hepatic'|'age'|'weight'|'interaction'|'guideline'
}
interface OptimizerResult {
  savings: SavingItem[]
  safety_flags: SafetyFlag[]
  monitoring_gaps: MonitoringGap[]
  dose_reviews: DoseReview[]
  summary: string
  total_monthly_saving_estimate: string
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (checkRateLimit(ip, 4, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return NextResponse.json({ error: 'Requer plano Student ou superior', upgrade: true }, { status: 403 })

  let body: { medications: Med[]; patient?: PatientContext; mode?: 'clinical'|'personal' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  const { medications, patient, mode = 'personal' } = body
  if (!medications?.length) return NextResponse.json({ error: 'Lista de medicamentos em falta' }, { status: 400 })

  const medList = medications.slice(0, 25).map(m =>
    `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}${m.indication ? ` (${m.indication})` : ''}`
  ).join('\n')

  const patientCtx = patient ? `
CONTEXTO DO DOENTE:
- Idade: ${patient.age || 'desconhecida'}
- Sexo: ${patient.sex || 'desconhecido'}
- Peso: ${patient.weight ? patient.weight + 'kg' : 'desconhecido'}
- Creatinina: ${patient.creatinine ? patient.creatinine + ' mg/dL' : 'desconhecida'}
- Condições: ${patient.conditions || 'não especificadas'}` : ''

  const isClinical = mode === 'clinical'

  const prompt = `És um farmacêutico clínico especialista em otimização de prescrição e deprescribing.
${patientCtx}

MEDICAÇÃO ATUAL:
${medList}

Analisa esta prescrição e devolve um relatório JSON completo de otimização:
{
  "savings": [
    {
      "drug": "nome do medicamento de marca",
      "brand_cost": "custo estimado mensal marca (ex: '€18/mês')",
      "generic_name": "nome DCI / genérico equivalente",
      "generic_cost": "custo estimado genérico (ex: '€3.20/mês')",
      "monthly_saving": "poupança estimada (ex: '€14.80')",
      "equivalence_note": "nota de bioequivalência (1 frase)"
    }
  ],
  "safety_flags": [
    {
      "drug": "medicamento",
      "issue": "problema identificado",
      "reason": "explicação clínica (max 2 frases)",
      "severity": "high"|"medium"|"low",
      "action": "recomendação concreta",
      "evidence": "guideline ou critério (STOPP/START, Beers, DGS, ESC, etc.)"
    }
  ],
  "monitoring_gaps": [
    {
      "drug": "medicamento",
      "monitoring": "exame/análise em falta",
      "frequency": "com que frequência deve ser feito",
      "last_done": null,
      "why_important": "por que é clinicamente importante"
    }
  ],
  "dose_reviews": [
    {
      "drug": "medicamento",
      "current_dose": "dose atual",
      "suggested_dose": "dose sugerida",
      "reason": "justificação clínica",
      "condition": "renal"|"hepatic"|"age"|"weight"|"interaction"|"guideline"
    }
  ],
  "summary": "resumo executivo em PT-PT (3 frases, ${isClinical ? 'linguagem clínica' : 'linguagem simples para o doente'})",
  "total_monthly_saving_estimate": "poupança total estimada (ex: '€22-35/mês')"
}

Regras:
- Savings: inclui apenas quando existe genérico comercializado em PT mais barato
- Safety flags: critérios STOPP/START v2, Beers 2023, ADA 2024, ESC 2023; inclui medicamentos potencialmente desnecessários (PPIs sem indicação clara, benzodiazepinas crónicas, antibióticos desnecessários)
- Monitoring: metformina→HbA1c, IECA/ARA→creatinina+K, varfarina→INR, digoxina→digoxinemia, lítio→litemia, amiodarona→TSH+enzimas hepáticas, estatinas→CK+transaminases
- Dose reviews: ajuste renal se creatinina conhecida; ajuste por idade (>70 anos); interações farmacodinâmicas
- Máximo: 8 savings, 10 safety flags, 10 monitoring gaps, 6 dose reviews
- Responde APENAS JSON`

  try {
    const result = await aiJSON<OptimizerResult>([{ role: 'user', content: prompt }], { maxTokens: 2000 })
    const safe: OptimizerResult = {
      savings: (Array.isArray(result?.savings) ? result.savings : []).slice(0,8).map((s:any) => ({
        drug: String(s.drug||'').slice(0,100), brand_cost: String(s.brand_cost||'').slice(0,50),
        generic_name: String(s.generic_name||'').slice(0,100), generic_cost: String(s.generic_cost||'').slice(0,50),
        monthly_saving: String(s.monthly_saving||'').slice(0,50), equivalence_note: String(s.equivalence_note||'').slice(0,300),
      })),
      safety_flags: (Array.isArray(result?.safety_flags) ? result.safety_flags : []).slice(0,10).map((s:any) => ({
        drug: String(s.drug||'').slice(0,100), issue: String(s.issue||'').slice(0,200),
        reason: String(s.reason||'').slice(0,400), severity: ['high','medium','low'].includes(s.severity)?s.severity:'medium',
        action: String(s.action||'').slice(0,300), evidence: String(s.evidence||'').slice(0,200),
      })),
      monitoring_gaps: (Array.isArray(result?.monitoring_gaps) ? result.monitoring_gaps : []).slice(0,10).map((m:any) => ({
        drug: String(m.drug||'').slice(0,100), monitoring: String(m.monitoring||'').slice(0,200),
        frequency: String(m.frequency||'').slice(0,100), last_done: null,
        why_important: String(m.why_important||'').slice(0,300),
      })),
      dose_reviews: (Array.isArray(result?.dose_reviews) ? result.dose_reviews : []).slice(0,6).map((d:any) => ({
        drug: String(d.drug||'').slice(0,100), current_dose: String(d.current_dose||'').slice(0,100),
        suggested_dose: String(d.suggested_dose||'').slice(0,100), reason: String(d.reason||'').slice(0,300),
        condition: ['renal','hepatic','age','weight','interaction','guideline'].includes(d.condition)?d.condition:'guideline',
      })),
      summary: String(result?.summary||'').slice(0,600),
      total_monthly_saving_estimate: String(result?.total_monthly_saving_estimate||'').slice(0,50),
    }
    return NextResponse.json(safe)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro na análise' }, { status: 500 })
  }
}
