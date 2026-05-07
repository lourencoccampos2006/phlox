import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 20, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free' || plan === 'student') return planGateResponse('pro', 'Phlox Ward')

  const body = await req.json().catch(() => null)
  if (!body?.patients) return NextResponse.json({ error: 'Dados obrigatórios' }, { status: 400 })

  const { shift, patients, from_name, from_role, general_notes } = body

  const SHIFT_LABELS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um ${from_role || 'profissional de saúde'} a gerar uma passagem de turno clínica estruturada. Responde APENAS com JSON válido, sem markdown, em português PT-PT.

{
  "shift": "${shift}",
  "from_name": "${from_name}",
  "patients_summary": [
    {
      "patient_id": "id do doente",
      "patient_name": "nome",
      "status": "estado clínico em 1-2 frases — o que aconteceu neste turno",
      "alerts": ["alerta urgente 1", "alerta urgente 2"],
      "action_needed": "o que o próximo turno precisa de fazer — concreto e prático"
    }
  ],
  "general_notes": "notas gerais do turno — em 1-2 frases"
}

Regras:
- status: factual, clínico, baseado nos dados fornecidos
- alerts: só se há algo urgente — lista vazia se não houver
- action_needed: sempre prático — "verificar TA às 22h", "confirmar resultado de análise", etc.
- geral_notes: síntese do turno`,
    },
    {
      role: 'user',
      content: `Turno: ${SHIFT_LABELS[shift] || shift}
De: ${from_name} (${from_role})
${general_notes ? `Notas: ${general_notes}` : ''}

Doentes:
${patients.map((p: any) => `- ${p.patient_name} (${p.patient_info || '?'}):
  Alertas activos: ${p.alerts?.join(', ') || 'nenhum'}
  Decisões do turno: ${p.decisions?.join(', ') || 'nenhuma'}
  Tarefas em aberto: ${p.open_tasks || 0}`).join('\n')}`,
    },
  ], { maxTokens: 1500, temperature: 0.2 })

  return NextResponse.json(result)
}