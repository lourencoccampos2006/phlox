// app/api/study/quiz/route.ts
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
          content: `És um professor de farmacologia que cria perguntas de exame. 
Responde APENAS com JSON válido, sem texto antes ou depois:
{
  "questions": [
    {
      "question": "pergunta clara e precisa",
      "options": ["opção A", "opção B", "opção C", "opção D"],
      "correct": 0,
      "explanation": "explicação detalhada da resposta correcta"
    }
  ]
}
O campo "correct" é o índice (0-3) da opção correcta.
Cria exactamente 8 perguntas de dificuldade progressiva.`
        },
        {
          role: 'user',
          content: `Cria 8 perguntas de escolha múltipla sobre ${drugClass} para um exame de farmacologia de nível universitário. Inclui perguntas sobre mecanismo de acção, indicações clínicas, efeitos adversos e interações importantes.`
        }
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