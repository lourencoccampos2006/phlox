// app/api/copilot-chat/route.ts
// Phlox Copilot — assistente contextual flutuante (Pro). Sabe em que página o
// utilizador está e responde curto, prático e clínico. Não substitui as
// ferramentas dedicadas; complementa-as no momento.
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Descrição curta do contexto de cada rota — ajuda o copiloto a ser útil.
function routeContext(path: string): string {
  const map: [RegExp, string][] = [
    [/^\/study\/notas/, 'O utilizador está nas notas clínicas (sistema de revisão espaçada).'],
    [/^\/study\/ecg/, 'O utilizador está a treinar interpretação de ECG.'],
    [/^\/study\/plano/, 'O utilizador está no seu plano de estudo.'],
    [/^\/simulador|^\/osce/, 'O utilizador está num caso clínico simulado.'],
    [/^\/interactions/, 'O utilizador está a verificar interações medicamentosas.'],
    [/^\/medicamento|^\/bula/, 'O utilizador está a consultar informação de um medicamento.'],
    [/^\/labs|^\/study\/lab/, 'O utilizador está a interpretar análises laboratoriais.'],
    [/^\/estagio/, 'O utilizador está a gerir o seu estágio clínico.'],
    [/^\/rounds|^\/mar|^\/turno/, 'O utilizador está num fluxo clínico profissional.'],
  ]
  for (const [re, ctx] of map) if (re.test(path)) return ctx
  return 'O utilizador está numa página do Phlox.'
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 40, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Phlox Copilot')

  const body = await req.json().catch(() => null) as { message?: string; path?: string; selection?: string; context?: string; history?: { role: string; content: string }[] } | null
  if (!body?.message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 })

  const ctx = routeContext(body.path || '')
  const sel = (body.selection || '').slice(0, 1500)
  const pageCtx = (body.context || '').slice(0, 2000)  // contexto rico: pesquisa/item aberto/dados

  try {
    const { text } = await aiComplete([
      {
        role: 'system',
        content: `És o Phlox Copilot, um assistente clínico contextual em PT-PT.
${ctx}
${pageCtx ? `\nCONTEXTO ATUAL (o que o utilizador está mesmo a ver/fez nesta página — usa-o como base da resposta):\n${pageCtx}\n` : ''}Regras:
- Responde curto e prático (máximo ~6 frases ou uma lista breve).
- Usa o CONTEXTO ATUAL acima — se ele tem um medicamento/ECG/análise/doente aberto, responde SOBRE ESSE, não em geral.
- Rigor clínico; se não sabes, di-lo. Não inventes doses ou valores.
- Linguagem profissional mas direta. Sem disclaimers longos.
- Quando útil, sugere a ferramenta certa do Phlox (ex: "vê /interactions").
${sel ? `\nO utilizador tem isto selecionado/em foco:\n"""${sel}"""` : ''}`,
      },
      ...((body.history || []).slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content).slice(0, 1500) }))),
      { role: 'user', content: body.message.slice(0, 1500) },
    ], { maxTokens: 700, temperature: 0.3 })
    return NextResponse.json({ reply: text })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha do copiloto' }, { status: 500 })
  }
}
