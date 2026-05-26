import { NextRequest, NextResponse } from 'next/server'
import { aiJSON } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Gerador de mnemónicas para estudantes de saúde — decorar listas/classificações.

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  const topic = String(body?.topic || '').trim().slice(0, 160)
  if (!topic) return NextResponse.json({ error: 'Indica o que queres decorar' }, { status: 400 })
  const area = String(body?.area || '').trim().slice(0, 40)

  try {
    const result = await aiJSON<any>([
      {
        role: 'system',
        content: `És um tutor de estudantes de saúde em Portugal, especialista em criar MNEMÓNICAS eficazes para memorizar. Crias frases memoráveis em português onde cada elemento corresponde a um item da lista.

Responde APENAS com JSON válido (sem markdown), PT-PT:
{
  "topic": "tópico conforme pedido",
  "items": ["item real e correto da lista a decorar", "..."],
  "mnemonic": "a frase/sigla mnemónica em português, fácil de lembrar",
  "breakdown": [ { "letter": "letra ou palavra-chave", "stands_for": "a que item corresponde" } ],
  "tip": "1 dica de memorização ou uma imagem mental que ajude",
  "alt": "uma mnemónica alternativa curta (ou '')"
}

Regras:
- Os "items" têm de ser factualmente corretos (ex: nervos cranianos, critérios, ramos). Se não souberes a lista com rigor, devolve items vazio e diz no tip.
- A mnemónica deve mapear na ordem dos items.
- Português de Portugal, criativa mas respeitável.`,
      },
      { role: 'user', content: `Cria uma mnemónica para decorar: ${topic}${area ? ` (área: ${area})` : ''}` },
    ], { maxTokens: 900, temperature: 0.5 })
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro. Tenta novamente.' }, { status: 500 })
  }
}
