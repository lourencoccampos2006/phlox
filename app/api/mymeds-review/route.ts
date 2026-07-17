import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { runRules, SEVERITY_META, type ClinicalCase } from '@/lib/decisionEngine'

// Revisão da Minha Medicação — Pro. Porte para consumidor de uma ferramenta
// clínica: corre o MESMO Decision Engine (26 regras, determinístico) usado
// pelo /assessments (revisão farmacoterapêutica clínica) e pelo Copilot
// clínico, mas traduz os achados para linguagem leiga em vez de terminologia
// profissional — ancorado nas regras reais, não um chat genérico a "adivinhar".

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 6, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Revisão da Minha Medicação')

  const body = await req.json().catch(() => null)
  const { medications, conditions, age, sex } = body || {}
  if (!medications?.trim()) {
    return NextResponse.json({ error: 'Indica a tua medicação — a revisão tem de ser sobre o que tomas de verdade.' }, { status: 400 })
  }

  const medLines = String(medications).split('\n').map((s: string) => s.trim()).filter(Boolean).slice(0, 30)
  const condList = conditions ? String(conditions).split(/[,;]\s*/).map((s: string) => s.trim()).filter(Boolean) : []

  const clinicalCase: ClinicalCase = {
    age: age ? Number(age) : undefined,
    sex: sex === 'M' || sex === 'F' ? sex : undefined,
    conditions: condList,
    meds: medLines,
  }

  let findings: ReturnType<typeof runRules> = []
  try { findings = runRules(clinicalCase) } catch { findings = [] }

  const findingsText = findings.length
    ? findings.map(f => `[${f.id}] (${SEVERITY_META[f.severity].label}) ${f.title}: ${f.detail}${f.action ? ` Ação sugerida: ${f.action}` : ''}`).join('\n')
    : 'Nenhum achado do motor de regras clínicas para esta combinação (não significa ausência de risco — só que nenhuma das 26 regras verificadas foi acionada).'

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacêutico clínico a explicar, em português simples e sem jargão, os achados de um motor de regras clínicas determinístico sobre a medicação de uma pessoa LEIGA (não profissional de saúde). NÃO inventes achados novos além dos listados — a tua função é traduzir e contextualizar, não diagnosticar. Podes acrescentar comentário geral sobre polimedicação/simplificação (nº de medicamentos, horários) mesmo sem achados do motor.

Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "summary": "1-2 frases: como está a tua medicação em geral, tom calmo e claro",
  "findings_plain": [ { "rule_id": "id da regra tal como recebido", "severity": "crítico|grave|moderado|ligeiro|informativo", "plain_title": "título em linguagem simples", "plain_explanation": "o que isto significa para ti, sem jargão", "what_to_do": "ação concreta e realista" } ],
  "questions_for_doctor": ["pergunta concreta para levar à próxima consulta"],
  "simplification_notes": ["ideia concreta de simplificação, ex: horários que podem juntar-se, perguntar sobre genéricos — só se houver base real nos dados"],
  "disclaimer": "aviso curto: apoio informativo, não substitui o teu médico ou farmacêutico — nunca pares ou mudes a medicação sem falar com eles"
}`,
    },
    {
      role: 'user',
      content: `Idade: ${age || 'não indicada'}. Sexo: ${sex || 'não indicado'}.
Condições: ${condList.length ? condList.join(', ') : 'nenhuma registada'}.
Medicação (${medLines.length} linhas): ${medLines.join('; ')}.

ACHADOS DO MOTOR DE REGRAS CLÍNICAS (Decision Engine, determinístico):
${findingsText}`,
    },
  ], { maxTokens: 1300, temperature: 0.3 })

  return NextResponse.json({
    findings_raw: findings.map(f => ({ id: f.id, severity: f.severity, title: f.title })),
    ...result,
  })
}
