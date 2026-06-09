// app/api/study/professor/route.ts
// Modo Professor — o estudante ENSINA um conceito ao Phlox. A IA faz de aluno
// curioso/confuso, faz perguntas e aponta lacunas. No fim, avalia a explicação.
// Protégé effect: ensinar é a forma nº1 de consolidar.
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete, aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 30, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (plan === 'free') return planGateResponse('student', 'Modo Professor')

  const body = await req.json().catch(() => null) as { action?: string; topic?: string; transcript?: { role: string; content: string }[]; message?: string } | null
  if (!body?.action) return NextResponse.json({ error: 'action obrigatório' }, { status: 400 })

  // ── ASK: a IA (aluno) faz uma pergunta/reação à explicação do estudante ──
  if (body.action === 'ask') {
    const topic = (body.topic || '').slice(0, 120)
    const history = (body.transcript || []).slice(-8)
    try {
      const { text } = await aiComplete([
        {
          role: 'system',
          content: `És um ALUNO curioso de ciências da saúde a aprender sobre "${topic}" com o utilizador (que é o PROFESSOR). PT-PT.
O teu papel:
- Reage à explicação do professor de forma natural e curta (1-3 frases).
- Faz UMA pergunta de cada vez — perguntas que um bom aluno faria, que testam se o professor REALMENTE percebe (mecanismos, exceções, "porquê", aplicação clínica).
- Se o professor disser algo incorreto ou vago, não corrijas diretamente — faz uma pergunta que o leve a perceber a lacuna ("mas então como explicas...?").
- Se ele explicar bem, mostra que percebeste e aprofunda.
- Sê encorajador mas exigente. Nunca dês a resposta — faz pensar.`,
        },
        ...history.map(h => ({ role: (h.role === 'student' ? 'user' : 'assistant') as 'user' | 'assistant', content: String(h.content).slice(0, 1500) })),
        { role: 'user', content: (body.message || 'Explica-me este tema.').slice(0, 2000) },
      ], { maxTokens: 400, temperature: 0.5 })
      return NextResponse.json({ reply: text })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  // ── EVALUATE: avalia a qualidade da explicação do estudante ──
  if (body.action === 'evaluate') {
    const topic = (body.topic || '').slice(0, 120)
    const studentText = (body.transcript || []).filter(m => m.role === 'student').map(m => m.content).join('\n').slice(0, 6000)
    if (!studentText.trim()) return NextResponse.json({ error: 'Sem explicação para avaliar.' }, { status: 400 })
    try {
      const res = await aiJSON<any>([
        {
          role: 'system',
          content: `És examinador. Avalias a qualidade da EXPLICAÇÃO que o estudante deu sobre "${topic}" (ensinar = dominar). PT-PT.
Responde APENAS JSON:
{
  "score": 0-100,
  "verdict": "domina|quase|frágil",
  "correct": ["o que explicou bem/corretamente"],
  "gaps": ["lacuna ou imprecisão concreta na explicação"],
  "missed": ["conceito importante que NÃO mencionou e devia"],
  "next": "o que estudar a seguir para fechar as lacunas"
}
Sê rigoroso: se a explicação foi superficial ou tem erros, o score reflete isso.`,
        },
        { role: 'user', content: `Tema: ${topic}\n\nExplicação do estudante:\n${studentText}` },
      ], { maxTokens: 1200, temperature: 0.2 })
      return NextResponse.json({ evaluation: res })
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
  }

  return NextResponse.json({ error: 'action não suportada' }, { status: 400 })
}
