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
          content: `Cria perguntas de exame de farmacologia. Responde APENAS com JSON válido sem texto antes ou depois:
{"questions":[{"question":"pergunta","options":["A","B","C","D"],"correct":0,"explanation":"explicação"}]}
O campo "correct" é o índice 0-3 da opção correcta. Cria exactamente 8 perguntas.`
        },
        { role: 'user', content: `Cria 8 perguntas de escolha múltipla sobre ${drugClass} para exame universitário de farmacologia.` }
      ],
      temperature: 0.3,
      max_tokens: 2500,
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