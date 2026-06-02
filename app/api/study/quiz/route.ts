// app/api/study/quiz/route.ts
// Atualizado 2026-05-31: aplica QUIZ_RULES_PT e inspectQuestion. O utilizador
// reportou que muitas perguntas estavam erradas — o prompt foi reforçado e
// adicionou-se sinalização de qualidade por pergunta (campo "quality_flags").
// Cada pergunta passa por um sanity-check antes de ser servida; se houver
// flags, elas vão na resposta para a UI mostrar um aviso e o utilizador poder
// reportar.
import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { QUIZ_RULES_PT, inspectQuestion } from '@/lib/quizQuality'

interface ExamQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
  reference?: string
  quality_flags?: string[]
}

const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass, domain } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 })

    const cacheKey = `quiz:${domain || 'farmacologia'}:${drugClass}:v2`
    if (cache.has(cacheKey)) return NextResponse.json(cache.get(cacheKey))

    const domainContext: Record<string, string> = {
      farmacologia: 'farmacologia clínica — mecanismos, interações, efeitos adversos, farmacocinética',
      medicina_interna: 'medicina interna — fisiopatologia, diagnóstico, critérios e tratamento',
      emergencia: 'medicina de emergência — algoritmos, reconhecimento e actuação imediata',
      cirurgia: 'cirurgia — indicações, técnica, complicações e peri-operatório',
      pediatria: 'pediatria — especificidades pediátricas, doses e desenvolvimento',
      gineco_obstetricia: 'ginecologia e obstetrícia — fisiologia, patologia e tratamento',
      anatomia_fisiologia: 'anatomia e fisiologia — estrutura, função e relações clínicas',
      semiologia: 'semiologia — exame físico, sinais e diagnóstico diferencial',
      enfermagem: 'enfermagem clínica — técnicas, protocolos e cuidados',
      nutricao: 'nutrição clínica — avaliação, necessidades e dietas terapêuticas',
    }

    const ctx = domainContext[domain || 'farmacologia'] || domainContext.farmacologia

    const result = await aiJSON<{ questions: ExamQuestion[] }>([
      {
        role: 'system',
        content: `Cria perguntas de exame universitário de ${ctx}.

${QUIZ_RULES_PT}

Responde APENAS com JSON válido:
{
  "questions": [
    {
      "question": "pergunta clínica",
      "options": ["A", "B", "C", "D"],
      "correct": 0,
      "explanation": "explicação completa: porque a correta é correta com mecanismo; porque cada errada é errada",
      "reference": "guideline ou fonte conhecida — opcional, omite se não tens certeza"
    }
  ]
}

O campo "correct" é o índice 0-3 da opção correcta. EXATAMENTE 10 perguntas. EXATAMENTE 4 opções por pergunta. EXATAMENTE 1 correcta por pergunta.

Varia: aplicação clínica, mecanismo, diagnóstico diferencial, contra-indicações, doses, monitorização, efeitos adversos. Dificuldade nível universitário avançado.`,
      },
      {
        role: 'user',
        content: `Cria 10 perguntas de exame sobre "${drugClass}" no contexto de ${ctx}. Cumpre TODAS as regras acima.`,
      },
    ], { maxTokens: 4000, temperature: 0.35 })

    // Anexa flags de qualidade por pergunta — a UI pode usar para avisar.
    if (Array.isArray(result?.questions)) {
      result.questions = result.questions.map(q => {
        const insp = inspectQuestion(q)
        return insp.ok ? q : { ...q, quality_flags: insp.flags }
      })
    }

    cache.set(cacheKey, result)
    if (cache.size > 200) { const first = cache.keys().next().value; if (first) cache.delete(first) }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar quiz.' }, { status: 500 })
  }
}
