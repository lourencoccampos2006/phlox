import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Guia rápido de primeiros socorros — passos claros e prudentes para uma situação.
// NÃO substitui o 112; orienta o que fazer enquanto a ajuda não chega.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const situation = String(body?.situation || '').trim().slice(0, 200)
  if (!situation) return NextResponse.json({ error: 'Descreve a situação' }, { status: 400 })

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um instrutor de primeiros socorros em Portugal (orientações INEM/Cruz Vermelha). Dás passos CLAROS, por ordem, a alguém sem formação, com calma e prudência. PT-PT.

Responde APENAS com JSON válido (sem markdown):
{
  "situation": "situação conforme descrita",
  "call_112_now": true/false,
  "call_112_reason": "porquê ligar já, ou '' ",
  "steps": ["passo concreto e acionável, por ordem", "..."],
  "do_not": ["erro comum a NÃO fazer"],
  "watch_for": ["sinal de agravamento que obriga a ligar 112"],
  "after": "o que fazer depois de estabilizar (1 frase)"
}

Regras:
- Se houver QUALQUER risco de vida (inconsciência, não respira, hemorragia grave, dor no peito, reação alérgica grave, AVC, engasgamento total), call_112_now=true e mete-o como 1º passo.
- Passos curtos, na ordem certa, linguagem simples. Inclui RCP/manobra de Heimlich quando aplicável, de forma correta.
- Nunca recomendes medicação por iniciativa própria além do óbvio (ex: água fria numa queimadura).
- Prudente: na dúvida, manda ligar 112 / SNS24 (808 24 24 24).`,
      },
      { role: 'user', content: situation },
    ], { maxTokens: 1000, temperature: 0 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
