import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan, planGateResponse } from '@/lib/planGate'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 6, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const { plan } = await getUserPlan(req)
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('protocol', plan)

  const body = await req.json().catch(() => null)
  if (!body?.goal) return NextResponse.json({ error: 'Objectivo terapêutico obrigatório' }, { status: 400 })

  const goal = String(body.goal).trim().slice(0, 400)
  const patient = String(body.patient || '').trim().slice(0, 600)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um farmacologista clínico e internista sénior a simular estratégias terapêuticas alternativas para um caso clínico específico. Pensas como um especialista de referência consultado por um colega.

Responde APENAS com JSON válido sem markdown:
{
  "goal_summary": "resumo conciso do objectivo clínico",
  "patient_profile": "perfil do doente em 1 frase inferido do contexto",
  "strategies": [
    {
      "id": "s1",
      "name": "Nome da estratégia (ex: 'SGLT2i + Optimização da Metformina')",
      "tagline": "em que consiste em 1 frase curta",
      "drugs": [
        { "name": "nome DCI", "dose": "dose completa", "role": "papel nesta estratégia", "timing": "quando tomar (opcional)" }
      ],
      "expected_outcome": "resultado esperado quantificado se possível",
      "time_to_effect": "quando esperar efeito",
      "monitoring": ["parâmetro 1 e quando", "parâmetro 2"],
      "advantages": ["vantagem específica para este doente"],
      "disadvantages": ["desvantagem ou limitação"],
      "evidence_level": "A" | "B" | "C",
      "guidelines": ["guideline e ano (ex: 'ESC Diabetes 2023')"],
      "contraindications_present": ["contraindicação que existe NESTE doente — só se aplicável"],
      "suitability_score": 0-100,
      "suitability_reason": "porque é ou não adequada para ESTE doente específico — 1-2 frases directas"
    }
  ],
  "recommended": "id da melhor estratégia para este doente",
  "recommendation_reason": "justificação clínica detalhada da escolha — menciona especificamente as características do doente que determinam a escolha",
  "shared_monitoring": ["monitorização comum a todas as estratégias"],
  "key_trade_offs": "o dilema clínico principal neste caso — o que se ganha e o que se perde com a escolha"
}

Gera exactamente 3-4 estratégias com diferenças reais entre si (não variações menores).
Ordena internamente por suitability_score decrescente.
Sê específico sobre doses, evidência e adequação ao perfil.
O suitability_score deve reflectir genuinamente a adequação ao ESTE doente (não é apenas qualidade da estratégia em geral).
Evidence A = RCTs, meta-análises. B = estudos observacionais, sub-análises. C = consenso, opinião de peritos.`,
      },
      {
        role: 'user',
        content: `Objectivo: ${goal}${patient ? `\n\nPerfil do doente: ${patient}` : ''}`,
      },
    ], { maxTokens: 2800, temperature: 0.15 })

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('Strategy error:', err?.message)
    return NextResponse.json({ error: err.message || 'Erro ao simular. Tenta novamente.' }, { status: 500 })
  }
}