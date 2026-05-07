import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 15, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox Consulta')

  const body = await req.json().catch(() => null)
  if (!body?.after_answers) return NextResponse.json({ error: 'Respostas obrigatórias' }, { status: 400 })

  const { after_answers, briefing, patient_name } = body
  const aa = after_answers

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacêutico clínico a sintetizar o resultado de uma consulta médica para o doente. Converte as notas do doente num resumo claro, accionável e simples. Responde APENAS com JSON válido sem markdown, em português PT-PT ${aa.patient_understanding <= 2 ? '— usa linguagem MUITO simples pois o doente disse que não percebeu bem' : ''}.

JSON esperado:
{
  "what_changed": ["o que mudou nesta consulta — lista de factos concretos"],
  "action_plan": [
    {
      "action": "o que fazer — concreto e simples",
      "by_when": "quando (ex: 'Nas próximas 2 semanas', 'Antes da próxima consulta')",
      "who": "quem faz (ex: 'Tu', 'Farmácia', 'Médico')"
    }
  ],
  "updated_medication_notes": "resumo das alterações de medicação em linguagem simples",
  "follow_up_reminders": ["lembrete concreto para acompanhamento"],
  "generate_care_plan": true|false
}

Regras:
- what_changed: máx 6 items, concretos ("Aumentou a dose do ramipril", não "Medicação ajustada")
- action_plan: máx 5 acções, por ordem de prioridade
- generate_care_plan: true se houve alterações de medicação significativas
- Se patient_understanding <= 2, simplifica ao máximo toda a linguagem`,
    },
    {
      role: 'user',
      content: `Contexto da consulta:
${briefing ? `Briefing inicial: ${briefing.patient_summary}` : ''}
Doente: ${patient_name || 'Doente'}

O que aconteceu na consulta:
${aa.changes_made || 'Sem alterações registadas'}
${aa.new_medications ? `Novos medicamentos: ${aa.new_medications}` : ''}
${aa.stopped_medications ? `Medicamentos parados: ${aa.stopped_medications}` : ''}
${aa.exams_requested ? `Exames pedidos: ${aa.exams_requested}` : ''}
${aa.next_consult ? `Próxima consulta: ${aa.next_consult}` : ''}
${aa.additional_notes ? `Notas adicionais: ${aa.additional_notes}` : ''}
Compreensão do doente: ${aa.patient_understanding}/5`,
    },
  ], { maxTokens: 1200, temperature: 0.2 })

  return NextResponse.json(result)
}