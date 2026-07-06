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

// Checklist genérica mas ÚTIL por tipo de estação — serve de base à estação de
// recurso (determinística) quando a IA falha. Assim NENHUM curso/tipo fica sem
// estação (o bug do Fernando: só medicina+anamnese funcionava).
const FALLBACK_CHECKLIST: Record<string, string[]> = {
  history_taking: ['Apresenta-se e identifica o doente', 'Pergunta o motivo da consulta', 'Caracteriza a queixa principal (início, duração, evolução)', 'Explora sintomas associados', 'Antecedentes pessoais e familiares relevantes', 'Medicação habitual e alergias', 'Hábitos (tabaco, álcool, atividade)', 'Impacto na vida do doente', 'Resume e valida com o doente', 'Comunica de forma empática e clara'],
  physical_exam: ['Higieniza as mãos e prepara o material', 'Explica o exame e obtém consentimento', 'Posiciona o doente adequadamente', 'Inspeção sistemática', 'Palpação dirigida', 'Manobras específicas do sistema em causa', 'Compara com o lado contralateral', 'Respeita o conforto e privacidade', 'Interpreta os achados', 'Comunica os resultados ao doente'],
  counselling: ['Estabelece relação e avalia o conhecimento prévio', 'Explica a condição em linguagem acessível', 'Explica a terapêutica e como a usar', 'Aborda efeitos adversos e o que vigiar', 'Verifica a compreensão (teach-back)', 'Responde a dúvidas e receios', 'Reforça a adesão e o seguimento', 'Fornece material de apoio', 'Combina plano de reavaliação', 'Comunicação empática'],
  procedure: ['Confirma indicação e consentimento', 'Reúne e verifica o material', 'Higieniza as mãos e técnica asséptica', 'Prepara e posiciona o doente', 'Executa os passos pela ordem correta', 'Mantém segurança e assepsia', 'Gere desconforto/dor do doente', 'Descarta material em segurança', 'Regista o procedimento', 'Explica os cuidados seguintes'],
  communication: ['Prepara o ambiente e a privacidade', 'Avalia o que o doente já sabe', 'Avisa que vem informação difícil', 'Comunica com clareza e sem jargão', 'Faz pausas e permite reação', 'Responde às emoções com empatia', 'Evita falsas garantias', 'Resume e verifica a compreensão', 'Combina os próximos passos', 'Disponibiliza-se e agenda seguimento'],
}
function fallbackStation(course: string, station_type: string, difficulty: string, seed: string, sexAge: string) {
  const items = (FALLBACK_CHECKLIST[station_type] || FALLBACK_CHECKLIST.history_taking).map((item, i) => ({ item, marks: 1, mandatory: i < 4 }))
  const typeLabel = TYPE_CTX[station_type] || TYPE_CTX.history_taking
  return {
    title: `${seed.charAt(0).toUpperCase() + seed.slice(1)} — ${sexAge}`,
    course, station_type, difficulty, duration_minutes: 8,
    patient_briefing: `Tem à sua frente um(a) ${sexAge} com "${seed}". Faça a ${typeLabel} de forma estruturada. Tem 8 minutos.`,
    patient_persona: `És um(a) ${sexAge} com "${seed}". Responde de forma realista, revelando detalhes só quando perguntado. Mantém-te no cenário.`,
    checklist_items: items,
    model_diagnosis: `Ver abordagem a "${seed}" — conclua com base na avaliação.`,
    model_plan: 'Plano estruturado: investigação dirigida, terapêutica adequada e seguimento.',
    _fallback: true,
  }
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  // ERA 10/min → um estudante a treinar várias estações seguidas batia no limite
  // e via "tente novamente" (era ESTE o bug, não a IA). É autenticado e gated ao
  // plano, por isso um limite generoso não abre porta a abuso.
  if (!checkRateLimit(ip, 40, 60_000).allowed) return rateLimitResponse()
  const { plan } = await getUserPlan(req)
  if (plan === 'free') return planGateResponse('student', 'Phlox OSCE')
  const body = await req.json().catch(() => ({}))
  const { course = 'medicine', station_type = 'history_taking', difficulty = 'intermediate' } = body
  const custom = String(body.custom_topic || '').trim()

  // Semente do cenário: tema escrito pelo estudante (se houver) OU aleatório do
  // banco. Com tema personalizado, a estação é sobre exatamente esse assunto.
  const bank = SCENARIO_BANK[course] || SCENARIO_BANK.medicine
  const seed = custom ? custom.slice(0, 120) : pick(bank)
  const sexAge = pick(['homem 24a', 'mulher 31a', 'homem 58a', 'mulher 67a', 'homem 72a', 'mulher 45a', 'adolescente 16a', 'homem 39a', 'mulher 80a'])

  try {
  const result = await aiJSON<any>([
    {
      role: 'system',
      content: `Crias estações OSCE realistas para estudantes de ${COURSE_CTX[course] || 'Medicina'}. Estação de ${TYPE_CTX[station_type] || TYPE_CTX.history_taking}. Dificuldade: ${difficulty}.
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
    { role: 'user', content: `Gera estação OSCE única sobre "${seed}" (${sexAge}): ${TYPE_CTX[station_type] || TYPE_CTX.history_taking}, ${COURSE_CTX[course] || COURSE_CTX.medicine}, dificuldade ${difficulty}` },
  ], { maxTokens: 2000, temperature: 0.8 })

  // Validação: a IA às vezes devolve JSON sem checklist (mais comum em cursos/
  // tipos menos frequentes — era o bug do "tente novamente"). Em vez de falhar,
  // servimos uma estação de RECURSO determinística, sempre válida e útil.
  if (!result || !Array.isArray(result.checklist_items) || result.checklist_items.length === 0) {
    return NextResponse.json(fallbackStation(course, station_type, difficulty, seed, sexAge))
  }
  // Garante campos mínimos mesmo quando a IA devolve parte do JSON.
  const merged = { ...fallbackStation(course, station_type, difficulty, seed, sexAge), ...result, _fallback: undefined }
  return NextResponse.json(merged)
  } catch {
    // Rede caiu ou IA indisponível → estação de recurso, nunca um beco sem saída.
    return NextResponse.json(fallbackStation(course, station_type, difficulty, seed, sexAge))
  }
}