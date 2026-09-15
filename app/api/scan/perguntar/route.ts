// app/api/scan/perguntar/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// "E isto aqui, o que quer dizer?"
//
// É a pergunta que vem sempre a seguir a ler um relatório, e não havia onde a
// fazer: a ferramenta explicava uma vez e calava-se. Quem fica com uma dúvida
// às onze da noite não tem a quem perguntar — e é exatamente aí que uma
// explicação calma vale mais.
//
// Responde SÓ sobre o documento que já foi decifrado. Não é um chat de saúde
// geral: se a pergunta sair do papel, diz isso e manda para a consulta. Essa
// fronteira é o que separa "ajudar a perceber" de "dar consultas", e é a que
// não se atravessa.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getIP, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { getUserPlan } from '@/lib/planGate'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 20, 60_000).allowed) return rateLimitResponse()
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Inicia sessão para perguntar.' }, { status: 401 })

  const body = await req.json().catch(() => null) as
    { documento?: any; pergunta?: string; anteriores?: { q: string; r: string }[] } | null

  const pergunta = String(body?.pergunta || '').trim().slice(0, 500)
  if (!pergunta) return NextResponse.json({ error: 'Falta a pergunta.' }, { status: 400 })
  if (!body?.documento) return NextResponse.json({ error: 'Não há documento para perguntar sobre.' }, { status: 400 })

  // O documento vai como JSON: é o que a IA já produziu, por isso não há aqui
  // nenhuma leitura nova nem nenhuma foto a circular outra vez.
  const doc = JSON.stringify(body.documento).slice(0, 12000)
  const historico = (body.anteriores || []).slice(-4)
    .map(t => `Pergunta: ${t.q}\nResposta: ${t.r}`).join('\n\n').slice(0, 4000)

  const sistema = `És um médico português a responder a uma dúvida sobre UM documento de saúde que já foi explicado a esta pessoa. Português europeu, simples, direto.

O documento decifrado (em JSON):
${doc}
${historico ? `\nJá foi perguntado antes:\n${historico}` : ''}

REGRAS:
- Responde em 2 a 5 frases. Sem listas a não ser que a pergunta peça mesmo uma.
- Só sobre ESTE documento e o que ele contém. Se a pergunta for sobre outra coisa (sintomas de agora, se deve mudar a medicação, o que tem), diz com franqueza que isso não está no documento e que é conversa para o médico — e diz exatamente o que perguntar.
- NUNCA dás um diagnóstico, nem dizes se deve ou não tomar alguma coisa.
- Se o documento não tiver a resposta, diz isso. "Não está aqui" é uma resposta honesta e útil; inventar não é.
- Não acrescentas "consulte o seu médico" a todas as respostas — a aplicação já o diz. Usa isso só quando for mesmo o passo seguinte.`

  try {
    const r = await aiComplete([
      { role: 'system', content: sistema },
      { role: 'user', content: pergunta },
    ], { maxTokens: 700, temperature: 0.2, qualidade: true })

    return NextResponse.json({ resposta: r.text.trim() })
  } catch (e: any) {
    return NextResponse.json({ error: 'Não consegui responder agora. Tenta outra vez.' }, { status: 500 })
  }
}
