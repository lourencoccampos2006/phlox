// app/api/decisao/action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 40, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Decisão')

  const body = await req.json().catch(() => null)
  if (!body?.action_id || !body?.current_patient) return NextResponse.json({ error: 'Dados insuficientes' }, { status: 400 })

  const { action_label, current_patient, time_elapsed, previous_events, case_id } = body

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És o motor de simulação de um caso clínico dinâmico. A tua função é simular as consequências fisiológicas e clínicas reais da acção tomada pelo utilizador, e actualizar o estado do doente de forma realista.

Responde APENAS com JSON:
{
  "updated_patient": {
    // O mesmo formato do patient, mas actualizado conforme a acção
    // Actualiza vitals, labs, narrative, severity, pending_results, available_actions
    // Se a acção foi correcta: melhora algum parâmetro
    // Se foi incorrecta: piora ou não altera
    // Se foi perigosa: deterioração significativa
    "name": "...", "age": 0, "sex": "M",
    "chief_complaint": "...",
    "background": "...",
    "current_meds": [],
    "allergies": [],
    "vitals": [],
    "labs": [],
    "narrative": "Estado ACTUALIZADO do doente após a intervenção — em 1-2 frases directas",
    "severity": "stable"|"worsening"|"critical"|"improving"|"resolved",
    "time_elapsed": 0,
    "pending_results": [],
    "available_actions": []
  },
  "immediate_consequence": "O que aconteceu imediatamente após a acção — em 1-2 frases clínicas directas (ex: 'SpO2 subiu de 88% para 94% após 4L O2 por óculos nasais. Doente refere alívio ligeiro da dispneia.')",
  "lab_results": "Resultados de exames se pedidos (null se não aplicável)",
  "alert": "Alerta clínico URGENTE se necessário (null se não urgente) — ex: 'CRÍTICO: TA desceu para 70/40 após furosemida IV num contexto de hipovolémia prévia'",
  "severity": "info"|"warning"|"critical"|"success",
  "case_ended": false,
  "end_reason": null
}

Regras de simulação:
- Sê implacavelmente realista — erros têm consequências
- Furosemida IV em hipovolemia → queda de TA
- Antibiótico errado → sem melhoria + resistência selecionada
- Anticoagulação em hemorragia activa sem reversão → piora
- O2 em hipoxia → melhoria de SpO2
- Digoxina na IC aguda sem controlo de FC → arritmia
- case_ended = true quando: diagnóstico correcto + tratamento iniciado + estável, OU quando o doente deteriora criticamente E o utilizador não toma acção correcta em 3 oportunidades, OU quando o utilizador escolhe "Alta" ou "Transferência"
- As available_actions devem evoluir conforme o caso — se pediu hemograma, já não deve aparecer de novo; se iniciou antibiótico, aparece "rever antibiótico" etc.
- Mantém o case_id internamente para consistência (case_id fornecido: ${case_id})`,
      },
      {
        role: 'user',
        content: `Estado actual do doente: ${JSON.stringify(current_patient)}

Tempo decorrido: ${time_elapsed} minutos

Acções anteriores:
${previous_events?.join('\n') || 'Nenhuma'}

Acção escolhida agora: "${action_label}"

Simula as consequências clínicas reais desta acção neste doente específico.`,
      },
    ], { maxTokens: 2200, temperature: 0.2 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro' }, { status: 500 })
  }
}