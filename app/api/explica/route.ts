import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// "Explica-me" — um conceito de saúde explicado em 3 níveis + analogia. Para estudantes.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const concept = String(body?.concept || '').trim().slice(0, 160)
  if (!concept) return NextResponse.json({ error: 'Indica o conceito' }, { status: 400 })
  const area = String(body?.area || '').trim().slice(0, 40)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um excelente professor de ciências da saúde em Portugal. Explicas qualquer conceito em três níveis crescentes, com rigor e clareza. PT-PT.

Responde APENAS com JSON válido (sem markdown):
{
  "concept": "conceito conforme pedido",
  "simple": "explicação como se fosse para alguém de 12 anos, 2-3 frases",
  "exam": "explicação de nível exame universitário — rigorosa, com os termos corretos e os pontos que caem em teste",
  "clinical": "porque importa na prática clínica / aplicação real (ou '' se não aplicável)",
  "analogy": "uma analogia ou imagem mental que torna o conceito inesquecível",
  "key_points": ["facto-chave a reter", "..."],
  "common_mistake": "o erro/confusão mais comum dos estudantes sobre isto"
}

Regras: factualmente correto; rigor crescente do simple→exam; se não souberes com rigor, di-lo em vez de inventar.`,
      },
      { role: 'user', content: `Explica: ${concept}${area ? ` (contexto: ${area})` : ''}` },
    ], { maxTokens: 1300, temperature: 0.2 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
