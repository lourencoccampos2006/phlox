import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Análise de Correlações')

  const body = await req.json().catch(() => null)
  if (!body?.events || body.events.length < 3) {
    return NextResponse.json({ error: 'Mínimo 3 eventos necessários' }, { status: 400 })
  }

  const eventsStr = body.events
    .map((e: any) => `${e.date} | ${e.type} | ${e.title}${e.severity ? ' [' + e.severity + ']' : ''}`)
    .join('\n')

  const result = await aiJSON<{ correlations: any[] }>([
    {
      role: 'system',
      content: `És um farmacologista clínico e especialista em farmacovigilância. Analisa uma linha do tempo de eventos clínicos e identifica correlações temporais clinicamente relevantes. Responde APENAS com JSON válido, sem markdown, em português PT-PT.

JSON esperado:
{
  "correlations": [
    {
      "confidence": "alta|moderada|baixa",
      "type": "temporal|causal|trend|warning",
      "finding": "o que foi encontrado — específico e concreto, menciona datas e eventos reais",
      "events_involved": ["evento 1", "evento 2"],
      "recommendation": "o que o utilizador deve fazer com esta informação"
    }
  ]
}

Tipos de correlação:
- temporal: evento A ocorre consistentemente antes/depois de evento B
- causal: medicamento iniciado precede sintoma — possível efeito adverso
- trend: valor ou sintoma a piorar/melhorar ao longo do tempo
- warning: combinação de eventos que requer atenção clínica

Regras:
- Identifica 3-6 correlações no máximo
- Só menciona correlações com suporte nos dados fornecidos — não inventa
- "finding" deve ser específico: "X semanas após iniciar Y, apareceu Z"
- Prioriza por relevância clínica (efeitos adversos > tendências > informações gerais)
- "recommendation" deve ser prático e accionável
- Se não há correlações claras, devolve lista vazia`,
    },
    {
      role: 'user',
      content: `Analisa a linha do tempo clínica de ${body.profile_name || 'este utilizador'} e identifica correlações temporais relevantes:\n\n${eventsStr}`,
    },
  ], { maxTokens: 1500, temperature: 0.3 })

  return NextResponse.json(result)
}