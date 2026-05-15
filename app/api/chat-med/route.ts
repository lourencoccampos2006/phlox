import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.message) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

  const message = String(body.message).trim().slice(0, 500)
  const meds: { name: string; dose?: string; frequency?: string }[] = body.meds || []
  const history: { role: string; content: string }[] = (body.history || []).slice(-6)

  const medList = meds.length > 0
    ? meds.map(m => `- ${m.name}${m.dose ? ` ${m.dose}` : ''}${m.frequency ? `, ${m.frequency}` : ''}`).join('\n')
    : 'Nenhum medicamento registado.'

  const messages = [
    {
      role: 'system' as const,
      content: `És o assistente farmacêutico do Phlox. O utilizador toma os seguintes medicamentos:
${medList}

Regras:
- Responde em português europeu (PT-PT), linguagem simples e direta
- Máximo 3 frases por resposta, sem listas longas
- Para situações graves (sobredosagem, reação alérgica, dor no peito): "Liga imediatamente para o 112 ou vai à urgência."
- Para dúvidas sérias sobre interações: "Fala com o teu farmacêutico ou médico antes de continuar."
- Se não souberes algo com certeza, diz claramente que não sabes
- Não inventes informação clínica
- Termina sempre com confiança, nunca em pânico desnecessário`,
    },
    ...history.map(h => ({ role: h.role as 'user'|'assistant', content: h.content })),
    { role: 'user' as const, content: message },
  ]

  try {
    const result = await aiComplete(messages, { maxTokens: 200, temperature: 0.2, preferFast: true })
    return NextResponse.json({ reply: result.text.trim() })
  } catch (e: any) {
    return NextResponse.json({ error: 'Serviço temporariamente indisponível.' }, { status: 503 })
  }
}
