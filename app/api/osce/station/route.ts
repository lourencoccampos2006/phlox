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

// Bancos de cenários para forçar variedade (evita estações repetidas).
const SCENARIO_BANK: Record<string, string[]> = {
  medicine: ['dor torácica', 'dispneia', 'cefaleia', 'dor abdominal', 'lombalgia', 'tonturas/síncope', 'febre sem foco', 'fadiga crónica', 'edema dos membros', 'palpitações', 'hemorragia digestiva', 'icterícia', 'perda de peso', 'tosse crónica', 'alteração do estado de consciência', 'poliúria/polidipsia', 'dor articular', 'exantema', 'disúria', 'ansiedade/pânico'],
  pharmacy: ['polimedicação no idoso', 'interação varfarina', 'adesão à terapêutica', 'novo anticoagulante oral', 'inalador mal usado', 'automedicação perigosa', 'ajuste de dose renal', 'efeito adverso suspeito', 'contraceção de emergência', 'antibiótico em ITU', 'dor não controlada', 'diabetes mal controlada'],
  nursing: ['administração segura de medicação', 'algaliação', 'penso de ferida', 'colheita de sangue', 'sinais vitais alterados', 'queda do doente', 'glicemia capilar', 'oxigenoterapia', 'preparação pré-operatória', 'dor pós-operatória', 'cuidados com cateter', 'educação do cuidador'],
  nutrition: ['avaliação nutricional', 'diabetes tipo 2', 'desnutrição', 'obesidade', 'doença renal crónica', 'doença celíaca', 'alergia alimentar', 'nutrição entérica', 'dislipidemia', 'gravidez', 'transtorno alimentar', 'desporto'],
  physiotherapy: ['lombalgia mecânica', 'pós-AVC', 'reabilitação do joelho', 'ombro doloroso', 'DPOC reabilitação', 'pós-fratura', 'lesão desportiva', 'cervicalgia', 'equilíbrio no idoso', 'reabilitação cardíaca'],
  dentistry: ['dor dentária aguda', 'abcesso', 'doença periodontal', 'trauma dentário', 'lesão da mucosa oral', 'higiene oral', 'sensibilidade dentária', 'bruxismo', 'avaliação pré-extração'],
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 10, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox OSCE')
  const body = await req.json().catch(() => ({}))
  const { course = 'medicine', station_type = 'history_taking', difficulty = 'intermediate' } = body

  // Semente de cenário aleatória → variedade real entre estações
  const bank = SCENARIO_BANK[course] || SCENARIO_BANK.medicine
  const seed = pick(bank)
  const sexAge = pick(['homem 24a', 'mulher 31a', 'homem 58a', 'mulher 67a', 'homem 72a', 'mulher 45a', 'adolescente 16a', 'homem 39a', 'mulher 80a'])

  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `Crias estações OSCE realistas para estudantes de ${COURSE_CTX[course] || 'Medicina'}. Estação de ${TYPE_CTX[station_type]}. Dificuldade: ${difficulty}.
CENÁRIO BASE (usa-o, não inventes outro tema): "${seed}" num(a) ${sexAge}. Cria um caso ESPECÍFICO e único à volta disto — nunca genérico.
Responde APENAS com JSON válido sem markdown em português PT-PT.
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
    { role: 'user', content: `Gera estação OSCE única sobre "${seed}" (${sexAge}): ${TYPE_CTX[station_type]}, ${COURSE_CTX[course]}, dificuldade ${difficulty}` },
  ], { maxTokens: 2000, temperature: 0.8 })

  return NextResponse.json(result)
}