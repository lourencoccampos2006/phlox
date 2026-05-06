import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass, domain } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Tópico obrigatório' }, { status: 400 })

    const cacheKey = `${domain || 'farmacologia'}:${drugClass}`
    if (cache.has(cacheKey)) return NextResponse.json(cache.get(cacheKey))

    // Context adapts by domain
    const domainContext: Record<string, string> = {
      farmacologia: 'farmácia e medicina, focado em mecanismo de acção, indicações, efeitos adversos e farmacocinética',
      medicina_interna: 'medicina interna, focado em fisiopatologia, diagnóstico, critérios diagnósticos e tratamento',
      emergencia: 'medicina de emergência, focado em reconhecimento, algoritmos de actuação e tratamento imediato',
      cirurgia: 'cirurgia geral, focado em indicações cirúrgicas, técnica, complicações e cuidados peri-operatórios',
      pediatria: 'pediatria, focado em especificidades pediátricas, doses por kg, desenvolvimento e diferenças da medicina do adulto',
      gineco_obstetricia: 'ginecologia e obstetrícia, focado em fisiologia da gravidez, patologia e tratamento',
      anatomia_fisiologia: 'anatomia e fisiologia, focado em estrutura, função e relações clínicas',
      semiologia: 'semiologia clínica, focado em técnica de exame físico, interpretação e diagnóstico diferencial',
      enfermagem: 'enfermagem clínica, focado em técnicas, cuidados, protocolos e escalas de avaliação',
      nutricao: 'nutrição clínica, focado em avaliação nutricional, necessidades, dietas terapêuticas e suporte nutricional',
    }

    const ctx = domainContext[domain || 'farmacologia'] || domainContext.farmacologia

    const result = await aiJSON<{ flashcards: { front: string; back: string }[] }>([
      {
        role: 'system',
        content: `Cria flashcards pedagógicos para estudantes de ${ctx}. Responde APENAS com JSON válido: {"flashcards":[{"front":"pergunta clara e concisa","back":"resposta detalhada com pontos-chave"}]}. Cria exactamente 12 flashcards. As perguntas devem ser variadas: mecanismos, definições, critérios, doses, complicações, diagnóstico diferencial. As respostas devem ser completas mas concisas. Língua: português PT-PT.`,
      },
      {
        role: 'user',
        content: `Cria 12 flashcards sobre "${drugClass}" para estudantes de ${ctx}.`,
      },
    ], { maxTokens: 2500, temperature: 0.3 })

    cache.set(cacheKey, result)
    // Cache for 1 hour max (prevent memory leak)
    if (cache.size > 200) cache.delete(cache.keys().next().value)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar flashcards.' }, { status: 500 })
  }
}