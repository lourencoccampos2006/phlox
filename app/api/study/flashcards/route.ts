// app/api/study/flashcards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
const cache = new Map<string, any>()

export async function POST(request: NextRequest) {
  try {
    const { drugClass } = await request.json()
    if (!drugClass) return NextResponse.json({ error: 'Drug class required' }, { status: 400 })

    if (cache.has(drugClass)) return NextResponse.json(cache.get(drugClass))

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `És um professor de farmacologia. Cria flashcards pedagógicos para estudantes universitários.
Responde APENAS com JSON válido, sem texto antes ou depois:
{
  "flashcards": [
    { "front": "pergunta ou conceito", "back": "resposta detalhada e explicativa" }
  ]
}
Cria exactamente 10 flashcards de alta qualidade.`
        },
        {
          role: 'user',
          content: `Cria 10 flashcards sobre ${drugClass} para estudantes de farmácia e medicina. Inclui mecanismos de acção, indicações, efeitos adversos importantes e farmacocinética relevante.`
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })

    const text = completion.choices[0]?.message?.content || ''
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(clean)

    cache.set(drugClass, result)
    return NextResponse.json(result)

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}