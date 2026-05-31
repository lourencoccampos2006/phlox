import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiComplete } from '@/lib/ai'
import { runRules, riskScore, type ClinicalCase, type Finding } from '@/lib/decisionEngine'

// Phlox AI Copilot — ancora a IA no Decision Engine determinístico.
// Em vez de inventar, a IA recebe os achados das regras como FACTOS e responde
// com explicação clínica e plano. Cada achado é citado por id (R1, R7…).
// Requer plano Pro.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()

  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Phlox AI Copilot')

  const body = await req.json().catch(() => null)
  const c: ClinicalCase = body?.case || {}
  const question: string = (body?.question || 'Analisa o caso clinicamente. Aponta riscos, prioriza e propõe plano de medicação.').slice(0, 1200)
  if (!c || (!c.meds?.length && !c.conditions?.length && !c.age)) return NextResponse.json({ error: 'Caso clínico vazio' }, { status: 400 })

  // 1) Decision Engine — factos deterministicos
  const findings: Finding[] = runRules(c)
  const score = riskScore(findings)

  // 2) Construir contexto para a IA
  const factos = findings.length
    ? findings.map(f => `[${f.id} · ${f.severity}] ${f.title} — ${f.detail}${f.action ? ' ACÇÃO: ' + f.action : ''}${f.reference ? ' (' + f.reference + ')' : ''}`).join('\n')
    : 'Sem achados pelo Decision Engine.'

  const system = `És o Phlox AI Copilot — assistente clínico para profissionais de saúde em Portugal.

REGRAS RÍGIDAS:
1. NUNCA inventes interações ou critérios. SÓ usas os FACTOS abaixo (output do Phlox Decision Engine, determinístico) e o caso clínico.
2. Cita CADA recomendação com o id da regra entre parênteses, ex: "(R1)". Se a recomendação não vem de uma regra dada, NÃO a faças.
3. Português de Portugal. Linguagem clínica concisa.
4. Estrutura SEMPRE: 1) Resumo do risco · 2) Prioridades · 3) Plano sugerido · 4) Acompanhamento.
5. Termina com: "⚠ Ferramenta de apoio à decisão. Validação clínica obrigatória."

FACTOS DO DECISION ENGINE (autoritativos):
${factos}

PONTUAÇÃO DE RISCO: ${score}/100`

  const userMsg = `CASO:
- Idade: ${c.age ?? 'n/d'} · Sexo: ${c.sex || 'n/d'}
- TFG: ${c.egfr ?? 'n/d'} mL/min · QTc: ${c.qtc_ms ?? 'n/d'} ms
- Condições: ${(c.conditions || []).join(', ') || 'n/d'}
- Medicação: ${(c.meds || []).join(', ') || 'n/d'}

PERGUNTA: ${question}`

  try {
    const ai = await aiComplete([
      { role: 'system', content: system },
      { role: 'user', content: userMsg },
    ], { temperature: 0.05, maxTokens: 900 })

    return NextResponse.json({
      ok: true,
      answer: ai.text,
      provider: ai.provider,
      model: ai.model,
      decision_engine: { findings, risk_score: score },
    })
  } catch (e: any) {
    return NextResponse.json({ error: `IA indisponível: ${String(e?.message || e).slice(0, 200)}` }, { status: 503 })
  }
}
