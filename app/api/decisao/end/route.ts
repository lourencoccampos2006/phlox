// app/api/decisao/end/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.case_id) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { case_id, patient_final, events, time_elapsed } = body

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um especialista clínico a avaliar a performance de um estudante/profissional num caso simulado. Analisa as decisões tomadas e dá feedback rigoroso, honesto e educativo.

Responde APENAS com JSON:
{
  "score": 0-100,
  "grade": "Excelente"|"Bom"|"Suficiente"|"Insuficiente"|"Reprovado",
  "overall_feedback": "Avaliação global em 2-3 frases directas — o que correu bem e mal globalmente",
  "correct_decisions": ["decisão correcta e porquê foi a decisão certa neste contexto"],
  "critical_errors": ["erro grave com explicação do porquê é perigoso — 'Prescreveste furosemida IV sem repor volémia prévia num doente em pré-choque — isto causa colapso cardiovascular'"],
  "missed_opportunities": ["o que devia ter sido feito e não foi"],
  "teaching_points": [
    "Ponto de aprendizagem concreto derivado deste caso — com mecanismo ou guideline (ex: 'Na CAD, a insulina só inicia APÓS K+ > 3.5 mEq/L — K+ < 3.5 com insulina causa hipocaliemia fatal')"
  ],
  "time_assessment": "Avaliação do tempo de decisão — demorou demasiado? Foi rápido?"
}

Critérios de score:
- 90-100: diagnóstico correcto, tratamento guideline-compliant, sem erros graves
- 70-89: diagnóstico correcto, tratamento adequado, 1-2 suboptimalidades
- 50-69: diagnóstico provável, alguns erros mas não fatais
- 30-49: diagnóstico errado ou atraso significativo, tratamento inadequado
- 0-29: erros graves, perigosos para o doente

Sê específico e clínico — não dês elogios vazios. O feedback deve ser útil para não repetir o erro.`,
      },
      {
        role: 'user',
        content: `Caso: ${case_id}

Estado final do doente: ${JSON.stringify(patient_final)}

Sequência de decisões tomadas:
${events?.join('\n') || 'Nenhuma decisão registada'}

Tempo total: ${time_elapsed} minutos

Avalia a performance.`,
      },
    ], { maxTokens: 1500, temperature: 0.1 })

    return NextResponse.json({ final_score: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro' }, { status: 500 })
  }
}