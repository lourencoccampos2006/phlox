// app/api/copilot-chat/route.ts
// Phlox Copilot — assistente contextual flutuante (Pro). Sabe em que página o
// utilizador está e responde curto, prático e clínico. Não substitui as
// ferramentas dedicadas; complementa-as no momento.
import { NextRequest, NextResponse } from 'next/server'
import { aiComplete } from '@/lib/ai'
import { getUserPlan, planGateResponse, isPlanSufficient } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Descrição curta do contexto de cada rota + a ferramenta certa a sugerir.
function routeContext(path: string): string {
  const map: [RegExp, string][] = [
    [/^\/study\/notas/, 'Está nas notas clínicas (revisão espaçada). Podes ajudar a consolidar ou criar mnemónicas (/mnemonicas).'],
    [/^\/study\/ecg/, 'Está a treinar interpretação de ECG. Ajuda a ler o traçado por passos (ritmo, eixo, intervalos, ST/T).'],
    [/^\/study\/plano|^\/study360/, 'Está no plano de estudo. Ajuda a priorizar o que estudar a seguir.'],
    [/^\/simulador|^\/osce/, 'Está num caso clínico simulado. NÃO entregues a resposta de bandeja — guia o raciocínio.'],
    [/^\/tutor/, 'Está com o AI Tutor (método socrático). Reforça o raciocínio em vez de dar respostas diretas.'],
    [/^\/arena/, 'Está na Arena de ligas (quiz competitivo). Pode pedir para explicar uma questão que errou.'],
    [/^\/estagio/, 'Está a gerir o estágio clínico (casos vistos, competências, reflexões). Ajuda a estruturar registos e a refletir.'],
    [/^\/interactions/, 'Está a verificar interações medicamentosas. Explica mecanismo e gravidade; sugere /interactions para o cruzamento completo.'],
    [/^\/medicamento|^\/bula|^\/quickcheck/, 'Está a consultar/analisar medicação. Responde sobre ESSE fármaco/lista; sugere /interactions se houver várias.'],
    [/^\/labs|^\/study\/lab/, 'Está a interpretar análises laboratoriais. Foca-te nos valores alterados e no que fazer.'],
    [/^\/sintomas|^\/saude-agora|^\/triagem/, 'Está a avaliar sintomas. Distingue o que pode esperar do que precisa de cuidados já; nunca minimizes sinais de alarme.'],
    [/^\/mymeds|^\/calendario-meds/, 'Está a gerir a medicação pessoal. Ajuda com horários, esquecimentos e cuidados.'],
    [/^\/preparar-consulta/, 'Está a preparar uma consulta. Ajuda a estruturar perguntas e o que levar.'],
    [/^\/rounds|^\/mar|^\/turno|^\/painel|^\/care-log/, 'Está num fluxo clínico profissional/institucional. Sê preciso e prático.'],
    [/^\/patients|^\/residentes/, 'Está na lista de doentes/utentes. Pode pedir um resumo ou o que vigiar.'],
  ]
  for (const [re, ctx] of map) if (re.test(path)) return ctx
  return 'Está numa página do Phlox.'
}

const MODE_CTX: Record<string, string> = {
  student: 'É ESTUDANTE de saúde — privilegia o raciocínio, o "porquê" e a fixação. Quando fizer sentido, faz perguntas que forcem o pensamento.',
  clinical: 'É PROFISSIONAL de saúde a trabalhar — sê direto, técnico e acionável; assume vocabulário clínico.',
  caregiver: 'CUIDA de outra pessoa — linguagem clara, foca-te na pessoa de quem cuida e em segurança.',
  personal: 'Está a cuidar da PRÓPRIA saúde — linguagem simples e tranquilizadora, sem jargão.',
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 40, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Phlox Copilot')

  const body = await req.json().catch(() => null) as { message?: string; path?: string; selection?: string; context?: string; profile?: string; mode?: string; history?: { role: string; content: string }[] } | null
  if (!body?.message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 })

  const ctx = routeContext(body.path || '')
  const sel = (body.selection || '').slice(0, 1500)
  const pageCtx = (body.context || '').slice(0, 2000)  // contexto rico: pesquisa/item aberto/dados
  const profileCtx = (body.profile || '').slice(0, 500) // quem está em foco (perfil/doente ativo)
  const modeCtx = MODE_CTX[body.mode || ''] || ''

  try {
    const { text } = await aiComplete([
      {
        role: 'system',
        content: `És o Phlox Copilot, o assistente clínico contextual do Phlox, em PT-PT. És útil, consciente e prático: sabes QUEM é o utilizador, ONDE está e SOBRE QUEM trabalha.
${modeCtx ? `QUEM: ${modeCtx}\n` : ''}ONDE: ${ctx}
${profileCtx ? `SOBRE QUEM: ${profileCtx}\n` : ''}${pageCtx ? `\nCONTEXTO ATUAL (o que o utilizador está mesmo a ver/fez nesta página — usa-o como base da resposta):\n${pageCtx}\n` : ''}Regras:
- Responde curto e prático (máximo ~6 frases ou uma lista breve). Vai direto ao que ajuda.
- Usa o CONTEXTO ATUAL e o SOBRE QUEM — se há um medicamento/ECG/análise/doente em foco, responde SOBRE ESSE, e tem em conta a idade/condições/alergias da pessoa ativa.
- Rigor clínico; se não sabes, di-lo. Nunca inventes doses, valores ou interações.
- Adapta o tom a QUEM (estudante→raciocínio; profissional→técnico; pessoal/cuidador→simples).
- Quando útil, aponta para a ferramenta certa do Phlox (ex: "confirma em /interactions", "regista em /sintomas").
- Não diagnosticas nem prescreves: informas, organizas e ajudas a decidir o passo seguinte.
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
