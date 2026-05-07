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
  if (!body?.answers) return NextResponse.json({ error: 'Respostas obrigatórias' }, { status: 400 })

  const { answers, meds, conditions, doctor, specialty, patient_name } = body

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `És um farmacêutico clínico a preparar um briefing de consulta para um médico ler em 30 segundos. O briefing é baseado nas respostas do doente antes da consulta. Responde APENAS com JSON válido sem markdown, em português PT-PT.

JSON esperado:
{
  "patient_summary": "1 frase: quem é o doente e contexto actual (ex: 'Doente de 68a com HTA, DM2 e FA sob 5 fármacos, consulta de seguimento com cardiologista')",
  "since_last_consult": "síntese do que aconteceu desde a última consulta — baseada nas respostas do doente. 2-3 frases concretas.",
  "main_concern": "a principal preocupação do doente hoje — reformulada de forma clinicamente relevante",
  "medication_alerts": [
    {
      "drug": "nome do medicamento",
      "concern": "preocupação específica com este medicamento neste contexto",
      "severity": "alta|media|baixa"
    }
  ],
  "questions_prioritised": [
    {
      "question": "a pergunta do doente reformulada em termos clínicos",
      "clinical_context": "porquê esta pergunta é clinicamente relevante — em 1 frase"
    }
  ],
  "labs_suggested": ["análise ou exame relevante para esta consulta"],
  "flag_for_physician": "alerta urgente para o médico (só se houver algo crítico — ex: sintoma grave, interação perigosa) ou null"
}

Regras:
- questions_prioritised: máx 5, ordenadas por importância clínica
- medication_alerts: só inclui se há preocupação real nos medicamentos listados
- labs_suggested: baseados nos medicamentos e sintomas — específicos, não genéricos
- flag_for_physician: null se não há nada urgente. Se há: 1 frase directa e clara`,
    },
    {
      role: 'user',
      content: `Doente: ${patient_name || 'Doente'}
Especialidade: ${specialty || 'Médico de Família'}
${doctor ? `Médico: ${doctor}` : ''}
${conditions ? `Condições: ${conditions}` : ''}
${meds?.length ? `Medicação: ${meds.join(', ')}` : ''}

Respostas do doente:
Como se sentiu: ${answers.feeling_since_last}
Principal preocupação: ${answers.main_concern}
${answers.symptoms?.length ? `Sintomas: ${answers.symptoms.join(', ')}` : ''}
${answers.medication_questions ? `Dúvidas sobre medicação: ${answers.medication_questions}` : ''}
${answers.other_context ? `Outros: ${answers.other_context}` : ''}`,
    },
  ], { maxTokens: 1500, temperature: 0.2 })

  return NextResponse.json(result)
}