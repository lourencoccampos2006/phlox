import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'

const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Drug class required' }, { status: 400 })
    if (cache.has(drugClass)) return NextResponse.json(cache.get(drugClass))

    const result = await aiJSON<{ flashcards: { front: string; back: string }[] }>(
      [
        {
          role: 'system',
          content: 'Cria flashcards pedagógicos. Responde APENAS com JSON válido sem texto antes ou depois: {"flashcards":[{"front":"pergunta","back":"resposta detalhada"}]}. Cria exactamente 10 flashcards.',
        },
        {
          role: 'user',
          content: `Cria 10 flashcards sobre ${drugClass} para estudantes de farmácia e medicina. Inclui mecanismo de acção, indicações, efeitos adversos e farmacocinética.`,
        },
      ],
      { maxTokens: 2000, temperature: 0.3 }
    )

    cache.set(drugClass, result)
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Erro ao gerar flashcards.' }, { status: 500 })
  }
}