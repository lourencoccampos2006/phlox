import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Drug class required' }, { status: 400 })
    if (cache.has(drugClass)) return NextResponse.json(cache.get(drugClass))

    const result = await aiJSON<{ questions: { question: string; options: string[]; correct: number; explanation: string }[] }>(
      [
        {
          role: 'system',
          content: 'Cria perguntas de exame de farmacologia. Responde APENAS com JSON válido sem texto antes ou depois: {"questions":[{"question":"pergunta","options":["A","B","C","D"],"correct":0,"explanation":"explicação"}]}. O campo "correct" é o índice 0-3 da opção correcta. Cria exactamente 8 perguntas.',
        },
        {
          role: 'user',
          content: `Cria 8 perguntas de escolha múltipla sobre ${drugClass} para exame universitário de farmacologia.`,
        },
      ],
      { maxTokens: 2500, temperature: 0.3 }
    )

    cache.set(drugClass, result)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar quiz.' }, { status: 500 })
  }
}