// app/api/refeicoes/arrumar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Arruma a biblioteca de pratos: classifica por categoria os que ainda não têm.
//
// Uma biblioteca que cresce sem arrumação volta a ser uma lista alfabética de
// cem nomes — e é isso que leva alguém a criar "Bacalhau com natas" pela
// terceira vez, sem saber que já lá estava.
//
// Só classifica. Não muda nomes, não apaga, não cria pratos. E devolve
// apenas ids que vieram no pedido — nunca inventados.
import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { aiJSON } from '@/lib/ai'

export const runtime = 'nodejs'
// 120s e nao menos: esta rota le uma imagem ou escreve uma resposta longa, e
// no pior caso a escada de IA tenta mais do que um modelo. Um tecto curto
// aqui nao poupa nada -- so troca uma resposta lenta por um 504 sem mensagem.
export const maxDuration = 120

const CATEGORIAS = ['carne', 'peixe', 'vegetariano', 'sopa', 'doce', 'fruta', 'outro']

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 10, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await req.json().catch(() => null) as { pratos?: { id: string; name: string }[] } | null
  const pratos = (body?.pratos || []).filter(p => p?.id && p?.name).slice(0, 200)
  if (!pratos.length) return NextResponse.json({ error: 'Nada para arrumar.' }, { status: 400 })

  const idsValidos = new Set(pratos.map(p => p.id))

  try {
    const out = await aiJSON<{ c: { id: string; k: string }[] }>([
      {
        role: 'system',
        content: `Classificas pratos da cozinha portuguesa por categoria. Uma categoria por prato, só destas:
${CATEGORIAS.join(', ')}

Regras:
- "sopa" para qualquer sopa, caldo ou creme de entrada.
- "carne" e "peixe" pelo ingrediente principal do prato.
- "vegetariano" quando não leva carne nem peixe e não é sopa nem doce.
- "doce" para sobremesas de pastelaria ou leite; "fruta" para fruta.
- "outro" só quando nenhuma das anteriores serve.

Responde SÓ JSON compacto: {"c":[{"id":"<id exato>","k":"<categoria>"}]}
Um item por prato, com o id EXATO que recebeste.`,
      },
      { role: 'user', content: pratos.map(p => `${p.id}|${p.name}`).join('\n') },
    ], { maxTokens: 4000, temperature: 0.1 })

    const classificados = (out.c || [])
      .filter(x => x && idsValidos.has(x.id) && CATEGORIAS.includes(x.k))
      .map(x => ({ id: x.id, category: x.k }))

    return NextResponse.json({ classificados, pedidos: pratos.length })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e).slice(0, 140) }, { status: 500 })
  }
}
