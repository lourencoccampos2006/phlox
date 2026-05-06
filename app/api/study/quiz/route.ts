import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass, domain } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 })

    const cacheKey = `quiz:${domain || 'farmacologia'}:${drugClass}`
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

    const result = await aiJSON<{ questions: { question: string; options: string[]; correct: number; explanation: string }[] }>([
      {
        role: 'system',
        content: `Cria perguntas de exame universitário de ${ctx}. Responde APENAS com JSON válido: {"questions":[{"question":"pergunta","options":["A","B","C","D"],"correct":0,"explanation":"explicação detalhada da resposta correcta e porquê as outras estão erradas"}]}. O campo "correct" é o índice 0-3 da opção correcta. Cria exactamente 10 perguntas. Varia os tipos: aplicação clínica, mecanismo, diagnóstico diferencial, contra-indicações, doses. Dificuldade: nível universitário avançado. Língua: português PT-PT.`,
      },
      {
        role: 'user',
        content: `Cria 10 perguntas de exame sobre "${drugClass}" no contexto de ${ctx}.`,
      },
    ], { maxTokens: 3000, temperature: 0.4 })

    cache.set(cacheKey, result)
    if (cache.size > 200) cache.delete(cache.keys().next().value)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar quiz.' }, { status: 500 })
  }
}