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

  // IMPORTANTE (proteção legal): o Phlox NÃO é software médico nem faz
  // diagnóstico. Esta análise apenas APONTA COINCIDÊNCIAS no tempo para a
  // pessoa LEVAR AO MÉDICO. Nunca afirma causalidade ("X causou Y"), nunca
  // diz para alterar/parar medicação, nunca dá conclusões clínicas. Tudo é
  // formulado como "reparámos que..." + "vale a pena perguntar ao médico".
  const result = await aiJSON<{ correlations: any[] }>([
    {
      role: 'system',
      content: `Ajudas a organizar a linha do tempo de saúde de uma pessoa para ela levar à consulta. NÃO és médico, NÃO diagnosticas, NÃO afirmas que uma coisa causou outra. Apenas reparas em COINCIDÊNCIAS no tempo que possam VALER A PENA a pessoa mencionar ao médico. Responde APENAS com JSON válido, sem markdown, em português PT-PT simples (não técnico).

JSON esperado:
{
  "correlations": [
    {
      "confidence": "alta|moderada|baixa",
      "type": "temporal|trend|warning",
      "finding": "o que se reparou, como observação neutra: 'Reparámos que X e Y aconteceram por volta da mesma altura' — NUNCA 'X causou Y'",
      "events_involved": ["evento 1", "evento 2"],
      "recommendation": "sempre na forma de pergunta a fazer ao médico, ex: 'Pode valer a pena perguntar ao médico se há relação.'"
    }
  ]
}

Tipos:
- temporal: duas coisas aconteceram por perto no tempo
- trend: um valor ou sintoma parece estar a mudar ao longo do tempo
- warning: vale a pena chamar a atenção do médico para isto

Regras OBRIGATÓRIAS:
- NUNCA usar "causou", "provocou", "efeito adverso", "deve parar/alterar". Usar "coincidiu com", "aconteceu por volta de", "pode valer a pena perguntar".
- "recommendation" é SEMPRE uma sugestão de pergunta ao médico, nunca uma ação clínica.
- Máximo 3-5 observações. Só com base nos dados dados. Se não há nada claro, lista vazia.
- Linguagem simples, de apoio, sem alarmar.`,
    },
    {
      role: 'user',
      content: `Organiza a linha do tempo de ${body.profile_name || 'esta pessoa'} e aponta coincidências no tempo que possam valer a pena levar ao médico:\n\n${eventsStr}`,
    },
  ], { maxTokens: 1500, temperature: 0.3 })

  // Força sempre o disclaimer no payload para a UI o mostrar.
  return NextResponse.json({ ...result, disclaimer: 'Estas são apenas observações para conversares com o teu médico. O Phlox não faz diagnósticos nem substitui aconselhamento médico.' })
}