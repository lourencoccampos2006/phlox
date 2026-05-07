import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

const COURSE_CTX: Record<string, string> = {
  medicine: 'Medicina — o estudante actua como médico/interno',
  pharmacy: 'Farmácia — o estudante actua como farmacêutico clínico',
  nursing: 'Enfermagem — o estudante actua como enfermeiro',
  nutrition: 'Nutrição — o estudante actua como nutricionista clínico',
  physiotherapy: 'Fisioterapia — o estudante actua como fisioterapeuta',
  dentistry: 'Medicina Dentária — o estudante actua como médico dentista',
}
const TYPE_CTX: Record<string, string> = {
  history_taking: 'anamnese e colheita de história clínica',
  physical_exam: 'exame físico dirigido',
  counselling: 'aconselhamento e educação do doente',
  procedure: 'procedimento clínico ou técnica',
  communication: 'comunicação de más notícias',
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox OSCE')
  const body = await req.json().catch(() => ({}))
  const { course = 'medicine', station_type = 'history_taking', difficulty = 'intermediate' } = body

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `Crias estações OSCE realistas para estudantes de ${COURSE_CTX[course] || 'Medicina'}. Estação de ${TYPE_CTX[station_type]}. Dificuldade: ${difficulty}. Responde APENAS com JSON válido sem markdown em português PT-PT.
{
  "title": "título da estação",
  "course": "${course}",
  "station_type": "${station_type}",
  "difficulty": "${difficulty}",
  "duration_minutes": 8,
  "patient_briefing": "o que o examinador diz ao estudante — 3-4 frases, inclui o que o estudante tem de fazer",
  "patient_persona": "instruções detalhadas para a AI fazer de doente — quem é, sintomas, historial, o que revela só se perguntado",
  "checklist_items": [
    { "item": "item avaliado", "marks": 1, "mandatory": true }
  ],
  "model_diagnosis": "conclusão/diagnóstico esperado",
  "model_plan": "plano de actuação esperado"
}
Checklist: 10-14 items específicos para o tipo de estação e curso. Adapta ao curso (farmacêutico avalia interações; enfermeiro avalia técnica). Dificuldade ${difficulty}: ${difficulty === 'basic' ? 'caso clássico directo' : difficulty === 'intermediate' ? 'comorbilidades a descobrir' : 'apresentação atípica ou dilema'}.`,
    },
    { role: 'user', content: `Gera estação OSCE: ${TYPE_CTX[station_type]}, ${COURSE_CTX[course]}, dificuldade ${difficulty}` },
  ], { maxTokens: 2000, temperature: 0.5 })

  return NextResponse.json(result)
}