import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Relatório PCNE')

  const body = await req.json().catch(() => ({}))
  const { month, interventions = [] } = body

  const byType: Record<string, number> = {}
  const byOutcome: Record<string, number> = {}
  let accepted = 0, rejected = 0

  interventions.forEach((i: any) => {
    byType[i.intervention_type || 'outro'] = (byType[i.intervention_type || 'outro'] || 0) + 1
    byOutcome[i.outcome || 'pendente'] = (byOutcome[i.outcome || 'pendente'] || 0) + 1
    if (i.outcome === 'aceite') accepted++
    if (i.outcome === 'rejeitado') rejected++
  })

  const total = interventions.length
  const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0

  const result = await aiComplete([
    {
      role: 'system',
      content: `És um farmacêutico clínico hospitalar a redigir o relatório mensal de actividade farmacêutica em formato PCNE (Pharmaceutical Care Network Europe). O relatório deve ser profissional, estruturado, e adequado para acreditação hospitalar. Língua: português PT-PT.`,
    },
    {
      role: 'user',
      content: `Gera o relatório de actividade farmacêutica de ${month}.

DADOS DO MÊS:
- Total de intervenções: ${total}
- Taxa de aceitação: ${acceptRate}%
- Intervenções aceites: ${accepted}
- Intervenções rejeitadas: ${rejected}
- Por tipo: ${JSON.stringify(byType)}
- Por resultado: ${JSON.stringify(byOutcome)}
- Intervenções: ${JSON.stringify(interventions.slice(0, 20))}

O relatório deve incluir:
1. Cabeçalho com período e resumo executivo
2. Tabela de intervenções por classificação PCNE
3. Taxa de aceitação e análise
4. Problemas farmacoterapêuticos mais frequentes
5. Recomendações para o mês seguinte
6. Conclusão

Formato de texto limpo, estruturado com headers e secções claras.`,
    },
  ], { maxTokens: 1500, temperature: 0.2 })

  return NextResponse.json({ report: (result as any).content ?? (result as any).text ?? JSON.stringify(result) })
}