import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Plano de Recuperação — Pro, ligado ao Objetivo de Saúde "recover" (cirurgia,
// internamento ou evento agudo recente). Mesmo padrão do /api/weight-plan
// (stateless, sem tabela — gera de novo a pedido): dias/semanas de marcos
// realistas para O EVENTO CONCRETO desta pessoa, não um genérico "recupera bem".

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 5, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan !== 'pro' && plan !== 'clinic') return planGateResponse('pro', 'Plano de Recuperação')

  const body = await req.json().catch(() => null)
  const { event, medications, conditions, age, days_since } = body || {}
  if (!event?.trim()) {
    return NextResponse.json({ error: 'Indica o evento (ex: "Cirurgia à anca", "Internamento por pneumonia") — o plano tem de ser sobre a tua recuperação real.' }, { status: 400 })
  }

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um enfermeiro especialista em reabilitação a preparar um plano de recuperação PERSONALIZADO para alguém em casa depois de um evento de saúde concreto — não um genérico "descanse e beba água". Considera a medicação e condições reais (ex: anticoagulantes mudam sinais de alarme de hemorragia, diabetes atrasa cicatrização, DPOC muda a progressão de exercícios respiratórios).

Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "summary": "1-2 frases: o que esperar desta recuperação, adaptado à pessoa",
  "phase_now": "nome curto da fase atual (ex: 'Primeira semana — repouso ativo')",
  "milestones": [ { "period": "ex: 'Dias 1-3'", "focus": "o que é normal/esperado nesse período", "dos": ["ação concreta a fazer"], "donts": ["ação concreta a evitar"] } ],
  "medication_considerations": [ { "medication": "nome do fármaco real da lista", "consideration": "o que isto muda na recuperação (ex: risco de sangramento, açúcar no sangue, interação com analgésicos)" } ],
  "warning_signs": ["sinal concreto que exige contactar o médico ou urgência, específico deste evento/medicação"],
  "when_to_call_112": "critério claro de emergência real vs. só vigiar",
  "disclaimer": "aviso curto: apoio informativo, não substitui as indicações da equipa que tratou a pessoa"
}

Gera 3 a 5 períodos em "milestones", cobrindo desde agora até à recuperação funcional esperada para este tipo de evento.`,
    },
    {
      role: 'user',
      content: `Pessoa: ${age ? age + ' anos' : 'idade não indicada'}.
Evento: ${event.trim()}.
${days_since ? `Há ${days_since} dias.` : 'Data do evento não indicada — assume que é recente.'}
Medicação atual: ${medications?.trim() || 'nenhuma registada'}.
Condições/diagnósticos: ${conditions?.trim() || 'nenhuma registada'}.`,
    },
  ], { maxTokens: 1400, temperature: 0.4 })

  return NextResponse.json(result)
}
