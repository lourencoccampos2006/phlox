// app/api/estudar-conceito/route.ts
// Plano de estudo focado num conceito.
// 2026-06-01: complementa /api/explica e /api/mnemonicas — gera passos
// concretos para realmente perceber o conceito.

import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

interface StudyPlan {
  steps: string[]
  questions: string[]
  further_reading: string[]
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 12, 60_000).allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null)
  const concept = String(body?.concept || '').trim().slice(0, 200)
  const area = String(body?.area || 'medicina').trim().slice(0, 80)
  const context = body?.context ? String(body.context).slice(0, 800) : ''
  if (!concept) return NextResponse.json({ error: 'Indica um conceito.' }, { status: 400 })

  try {
    const result = await aiJSON<StudyPlan>([
      {
        role: 'system',
        content: `És um tutor universitário de ${area} em Portugal. PT-PT. Devolves um plano de estudo focado num conceito, prático e realista. Devolve APENAS JSON:
{
  "steps": ["passo concreto para perceber o conceito (não 'leia o livro'; algo accionável)"],
  "questions": ["pergunta para o estudante se testar — concreta, com resposta verificável"],
  "further_reading": ["referência específica (capítulo, paper, guideline). Se não tens certeza absoluta, omite"]
}

Regras:
- steps: 4-6 itens. Começa pelo mais simples ("perceber este precursor") e termina em aplicação ("resolve este caso").
- Liga sempre a algo que o estudante pode ACTUAR: ler X, fazer Y, esquematizar Z.
- questions: 3-5 perguntas. Misture conceptuais e aplicação clínica.
- further_reading: 2-4 itens. Não inventes referências — se não sabes, omite.`,
      },
      {
        role: 'user',
        content: `Conceito: ${concept}\nÁrea: ${area}\n${context ? `Contexto que já viu:\n${context}` : ''}`,
      },
    ], { maxTokens: 1200, temperature: 0.2 })

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro.' }, { status: 500 })
  }
}
