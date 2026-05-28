import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Gestão de rastreios (Centro de Saúde / USF) — para PROFISSIONAL.
// Dado um utente, lista rastreios e vacinas devidos segundo DGS, com periodicidade e elegibilidade.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const age = parseInt(String(body?.age || '')) || 0
  if (!age || age < 0 || age > 120) return NextResponse.json({ error: 'Idade inválida' }, { status: 400 })
  const sex = String(body?.sex || '').trim().slice(0, 20)
  const risk = String(body?.risk || '').trim().slice(0, 400)   // fatores de risco / antecedentes
  const done = String(body?.done || '').trim().slice(0, 400)   // rastreios já feitos e quando

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És médico(a) de família / enfermeiro(a) de uma USF em Portugal. Dás o plano de RASTREIOS e VACINAS devido a um utente, segundo as orientações da DGS (rastreios oncológicos organizados, PNV, rastreio de fatores de risco CV). Linguagem profissional e acionável. PT-PT.

Responde APENAS com JSON válido (sem markdown):
{
  "profile": "resumo (ex: 'Mulher, 54 anos, hipertensa')",
  "due_now": [ { "name": "rastreio/vacina devido AGORA", "rationale": "porquê e elegibilidade DGS", "frequency": "periodicidade", "action": "ação concreta (ex: 'requisitar PSOF', 'referenciar mamografia')" } ],
  "upcoming": [ { "name": "rastreio futuro", "when": "quando passa a estar indicado" } ],
  "risk_factors_to_address": ["fator de risco a abordar (ex: tabagismo, TA, IMC)"],
  "notes": "nota de coordenação (1-2 frases)"
}

Regras:
- ESTRITAMENTE por idade/sexo/risco e orientações DGS PT: colo útero (citologia/HPV 25-60), mama (mamografia 50-69, 2/2 anos), cólon (PSOF 50-74, 2/2 anos), risco CV, vacinas (gripe/pneumocócica em risco/idoso, Td 10/10 anos, zóster ≥50, COVID).
- Se "done" indicar um rastreio recente, NÃO o metas em due_now (passa a upcoming com a próxima data).
- due_now só o que está mesmo indicado e em falta para este utente.`,
      },
      { role: 'user', content: `Utente: ${age} anos, sexo ${sex || 'n/i'}.${risk ? ` Risco/antecedentes: ${risk}.` : ''}${done ? ` Já feito: ${done}.` : ''}` },
    ], { maxTokens: 1300, temperature: 0 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
