import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { aiComplete, aiJSON } from '@/lib/ai'

interface Med { name: string; dose?: string|null; frequency?: string|null }
interface ClarifyQuestion { question: string; type: 'yesno'|'scale'|'duration'|'text'; options?: string[] }
interface SOAPNote {
  subjective: string
  objective: string
  assessment: string
  plan: string[]
  monitoring: string
  when_to_seek_help: string
  evidence_level: 'A'|'B'|'C'
  pcne_problem?: string
  pcne_cause?: string
  pcne_intervention?: string
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (checkRateLimit(ip, 6, 60_000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  let body: {
    phase: 'clarify'|'assess'
    problem: string
    medications: Med[]
    answers?: Record<string, string>
    mode: 'personal'|'clinical'
    age?: number|null
    conditions?: string|null
  }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 }) }

  const { phase, problem, medications, answers, mode, age, conditions } = body
  if (!problem?.trim()) return NextResponse.json({ error: 'Descreve o problema' }, { status: 400 })

  const medContext = medications?.length
    ? medications.map(m => `${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? ` ${m.frequency}` : ''}`).join(', ')
    : 'não especificados'

  const patientCtx = [
    age ? `${age} anos` : null,
    conditions ? conditions : null,
  ].filter(Boolean).join(', ')

  // Phase 1: Generate clarifying questions
  if (phase === 'clarify') {
    const prompt = `És um farmacêutico clínico experiente a receber um doente.

PROBLEMA APRESENTADO: "${problem.trim().slice(0, 500)}"
MEDICAÇÃO: ${medContext}
${patientCtx ? `CONTEXTO: ${patientCtx}` : ''}

Gera 3-4 perguntas de clarificação ESSENCIAIS para uma avaliação farmacêutica completa.
Responde APENAS JSON:
{
  "questions": [
    {
      "question": "pergunta em PT-PT, dirigida ao doente",
      "type": "yesno"|"scale"|"duration"|"text",
      "options": ["opção 1", "opção 2"] // só para yesno ou scale
    }
  ],
  "immediate_concern": true|false  // true se o problema pode ser urgente
}

Regras:
- Perguntas práticas e diretas (evita jargão médico)
- Cobre: duração dos sintomas, intensidade, relação temporal com medicação, outros sintomas associados
- Para "scale": usa escala de 1-10 ou timing (manhã/tarde/noite)
- Responde APENAS JSON`

    const result = await aiJSON<{ questions: ClarifyQuestion[]; immediate_concern: boolean }>(
      [{ role: 'user', content: prompt }],
      { maxTokens: 600 }
    )
    return NextResponse.json({
      questions: (result?.questions || []).slice(0, 4),
      immediate_concern: result?.immediate_concern || false,
    })
  }

  // Phase 2: Full SOAP assessment
  if (phase === 'assess') {
    const isClinical = mode === 'clinical'
    const answersText = answers ? Object.entries(answers).map(([q, a]) => `Q: ${q}\nR: ${a}`).join('\n\n') : ''

    const prompt = `És um farmacêutico clínico sénior a produzir uma avaliação clínica estruturada.

PROBLEMA: "${problem.trim().slice(0, 500)}"
MEDICAÇÃO: ${medContext}
${patientCtx ? `CONTEXTO CLÍNICO: ${patientCtx}` : ''}

RESPOSTAS DO DOENTE:
${answersText || '(sem respostas adicionais)'}

Produz uma avaliação SOAP completa em JSON:
{
  "subjective": "o que o doente reporta, em linguagem ${isClinical ? 'clínica' : 'simples'} (2-3 frases)",
  "objective": "dados objetivos relevantes mencionados (medicação, doses, contexto clínico) (1-2 frases)",
  "assessment": "avaliação farmacêutica: problema drug-related provável, mecanismo, DDx farmacológico (3-4 frases ${isClinical ? 'técnicas com DCI e guidelines' : 'acessíveis'})",
  "plan": [
    "recomendação 1 concreta e acionável",
    "recomendação 2",
    "recomendação 3"
  ],
  "monitoring": "o que monitorizar e quando (1-2 frases)",
  "when_to_seek_help": "sinais de alerta para ir ao médico/urgência (1 frase)",
  "evidence_level": "A"|"B"|"C",
  ${isClinical ? `"pcne_problem": "código PCNE + descrição do problema farmacológico",
  "pcne_cause": "causa PCNE (C1-C9)",
  "pcne_intervention": "intervenção PCNE proposta",` : ''}
  "urgency": "routine"|"soon"|"urgent"|"emergency"
}

Níveis de evidência: A=RCT/meta-análise, B=estudos observacionais/guidelines, C=consenso/expert opinion
${isClinical ? 'PCNE v9.1: usar códigos P1-P3 (problemas), C1-C9 (causas), I1-I5 (intervenções)' : ''}
Responde APENAS JSON`

    try {
      const result = await aiJSON<SOAPNote & { urgency: string }>(
        [{ role: 'user', content: prompt }],
        { maxTokens: 1200 }
      )
      return NextResponse.json({
        soap: {
          subjective:        String(result?.subjective || '').slice(0, 800),
          objective:         String(result?.objective || '').slice(0, 500),
          assessment:        String(result?.assessment || '').slice(0, 1000),
          plan:              Array.isArray(result?.plan) ? result.plan.slice(0,6).map((p:any) => String(p).slice(0,300)) : [],
          monitoring:        String(result?.monitoring || '').slice(0, 400),
          when_to_seek_help: String(result?.when_to_seek_help || '').slice(0, 300),
          evidence_level:    ['A','B','C'].includes(result?.evidence_level as string) ? result.evidence_level : 'B',
          pcne_problem:      result?.pcne_problem ? String(result.pcne_problem).slice(0,200) : undefined,
          pcne_cause:        result?.pcne_cause   ? String(result.pcne_cause).slice(0,200)   : undefined,
          pcne_intervention: result?.pcne_intervention ? String(result.pcne_intervention).slice(0,200) : undefined,
          urgency:           ['routine','soon','urgent','emergency'].includes(result?.urgency as string) ? result.urgency : 'routine',
        }
      })
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Fase inválida' }, { status: 400 })
}
