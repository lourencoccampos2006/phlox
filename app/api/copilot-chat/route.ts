// app/api/copilot-chat/route.ts
// Phlox Copilot — assistente contextual flutuante (Pro). Ronda 9: deixou de ser
// um chat que só conversa sobre o contexto — agora FUNDAMENTA respostas em
// ferramentas reais (lib/copilotTools.ts, mesma lógica rigorosa das ferramentas
// dedicadas), propõe ações concretas (guardar, registar — sempre com
// confirmação do utilizador) e tem memória persistente entre sessões
// (copilot_memory). Nunca aponta para outra ferramenta como resposta — responde.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiComplete, aiJSON } from '@/lib/ai'
import { getUserPlan, planGateResponse, isPlanSufficient, extractToken } from '@/lib/planGate'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { TOOLS, type ToolMode } from '@/lib/toolRegistry'
import { checkInteractionsTool, patientDataTool } from '@/lib/copilotTools'

// Diretório CONCISO de todas as ferramentas do Phlox — usado SÓ para encaminhar
// quando o utilizador pede explicitamente uma funcionalidade ("onde faço X").
// NUNCA é uma alternativa a responder à pergunta feita.
function toolDirectory(mode?: string): string {
  const m = (['personal', 'caregiver', 'student', 'clinical'].includes(mode || '') ? mode : null) as ToolMode | null
  const list = (m ? TOOLS.filter(t => t.modes.includes(m)) : TOOLS)
  return list.map(t => `${t.id} = ${t.desc || t.label}`).join('\n')
}

// Descrição curta do "modo de pensar" da página — já NÃO sugere rotas (isso
// era a causa da queixa "aponta para ferramentas em vez de responder").
function routeContext(path: string): string {
  const map: [RegExp, string][] = [
    [/^\/study\/notas/, 'Está nas notas clínicas (revisão espaçada).'],
    [/^\/study\/ecg/, 'Está a treinar interpretação de ECG. Ajuda a ler o traçado por passos (ritmo, eixo, intervalos, ST/T).'],
    [/^\/study\/plano|^\/study360/, 'Está no plano de estudo. Ajuda a priorizar o que estudar a seguir.'],
    [/^\/simulador|^\/osce/, 'Está num caso clínico simulado. NÃO entregues a resposta de bandeja — guia o raciocínio.'],
    [/^\/tutor/, 'Está com o AI Tutor (método socrático). Reforça o raciocínio em vez de dar respostas diretas.'],
    [/^\/arena/, 'Está na Arena de ligas (quiz competitivo). Pode pedir para explicar uma questão que errou.'],
    [/^\/estagio/, 'Está a gerir o estágio clínico (casos vistos, competências, reflexões). Ajuda a estruturar registos e a refletir.'],
    [/^\/interactions/, 'Está a verificar interações medicamentosas. Explica mecanismo e gravidade com rigor.'],
    [/^\/medicamento|^\/bula|^\/quickcheck/, 'Está a consultar/analisar medicação. Responde sobre ESSE fármaco/lista.'],
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

interface CopilotDecision {
  mode: 'answer' | 'tool'
  answer?: string | null
  tool?: 'check_interactions' | 'patient_data' | null
  args?: { drugs?: string[] } & Record<string, any>
  remember?: string | null
  proposedAction?: { type: 'save_summary' | 'log_resident_request'; label: string; content: string } | null
}

function buildContextBlock(opts: {
  modeCtx: string; ctx: string; profileCtx: string; pageCtx: string; memoryBlock: string; sel: string
}): string {
  const { modeCtx, ctx, profileCtx, pageCtx, memoryBlock, sel } = opts
  return [
    modeCtx ? `QUEM: ${modeCtx}` : '',
    `ONDE: ${ctx}`,
    profileCtx ? `SOBRE QUEM: ${profileCtx}` : '',
    pageCtx ? `\nCONTEXTO ATUAL (o que o utilizador está mesmo a ver/fez nesta página — trata como verdade, é a base da resposta):\n${pageCtx}` : '',
    memoryBlock ? `\nO QUE JÁ SEI SOBRE ISTO (de conversas anteriores):\n${memoryBlock}` : '',
    sel ? `\nO utilizador tem isto selecionado/em foco:\n"""${sel}"""` : '',
  ].filter(Boolean).join('\n')
}

export async function POST(req: NextRequest) {
  if (!checkRateLimit(getIP(req), 40, 60_000).allowed) return rateLimitResponse()
  const { userId, plan } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!isPlanSufficient(plan, 'pro')) return planGateResponse('pro', 'Phlox Copilot')

  const body = await req.json().catch(() => null) as {
    message?: string; path?: string; selection?: string; context?: string; profile?: string
    profileId?: string; profileType?: 'self' | 'family' | 'patient'
    mode?: string; history?: { role: string; content: string }[]
  } | null
  if (!body?.message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 })

  const ctx = routeContext(body.path || '')
  const sel = (body.selection || '').slice(0, 1500)
  const pageCtx = (body.context || '').slice(0, 2000)
  const profileCtx = (body.profile || '').slice(0, 500)
  const modeCtx = MODE_CTX[body.mode || ''] || ''
  const hasProfile = !!body.profileId && body.profileType && body.profileType !== 'self'
  const canLogRequest = body.profileType === 'patient'
  const scopeKey = hasProfile ? body.profileId! : 'self'

  // Cliente autenticado com o token do próprio pedido — respeita RLS, sem
  // service role. Usado para memória persistente e para o tool patient_data.
  const token = extractToken(req)
  const authedSupabase = token
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
    : null

  // Memória: melhor-esforço — a tabela pode ainda não existir (sprint100 por correr).
  let memoryBlock = ''
  if (authedSupabase) {
    try {
      const { data } = await authedSupabase.from('copilot_memory').select('fact').eq('user_id', userId).eq('scope_key', scopeKey).order('created_at', { ascending: false }).limit(8)
      if (data?.length) memoryBlock = data.map((d: any) => `- ${d.fact}`).join('\n')
    } catch { /* tabela ainda não existe */ }
  }

  const contextBlock = buildContextBlock({ modeCtx, ctx, profileCtx, pageCtx, memoryBlock, sel })

  const baseSystem = `És o Phlox Copilot, o assistente do Phlox, em PT-PT. A tua função é RESPONDER — não encaminhar. Sabes QUEM é o utilizador, ONDE está, SOBRE QUEM trabalha, o que já viste antes, e tens acesso a ferramentas internas reais para fundamentar a resposta (verificação de interações, registo atual do doente/familiar).

${contextBlock}

MAPA DE ROTAS DO PHLOX (usa isto SÓ se o utilizador perguntar explicitamente "onde faço X" / "como acedo a Y" — nunca como substituto de responder):
${toolDirectory(body.mode)}

Regras (importantes, não as quebres):
- RESPONDE SEMPRE à pergunta feita, de forma direta e concreta. NUNCA respondas apenas "vai a /X" ou "usa a ferramenta Y" — só menciona uma rota do Phlox se o utilizador perguntar explicitamente "onde faço X" ou "como acedo a Y". Fora isso, é proibido desviar — resolve tu mesmo.
- Uma resposta vaga ou evasiva é PIOR do que uma resposta clara com a ressalva de segurança adequada. Não te escondas atrás de "consulta um profissional" sem antes dares a informação concreta que tens.
- Curto e prático (até ~6 frases ou uma lista breve). Vai direto ao que ajuda.
- Rigor: nunca inventes doses, valores ou interações. Se não sabes com certeza, di-lo — mas dá sempre o que SABES primeiro.
- Adapta o tom a QUEM (estudante→raciocínio; profissional→técnico; pessoal/cuidador→simples).
- Informas, organizas e ajudas a decidir o passo seguinte — não substituis um profissional de saúde, mas isso não é desculpa para evasão.`

  // ─── Passo 1: decisão — responde já, ou pede uma ferramenta real primeiro? ──
  const decisionSystem = `${baseSystem}

FERRAMENTAS INTERNAS que podes pedir para fundamentar a resposta (o SERVIDOR executa-as a sério, não adivinhes o resultado):
- check_interactions: verificação REAL (RxNorm + farmacologia clínica) de interações entre fármacos. SÓ uses isto se já souberes os NOMES EXATOS de pelo menos 2 fármacos (da pergunta, do CONTEXTO ATUAL, ou do histórico da conversa). args: {"drugs": ["nome1","nome2",...]}. Se NÃO souberes os nomes (ex.: "há interações na medicação dele?" sem saberes quais são), usa patient_data em vez disto — o servidor encadeia automaticamente a verificação de interações a seguir, com os nomes reais encontrados no registo.
- patient_data: consulta o registo ATUAL e completo (medicação ativa, condições, alergias, vitais) da pessoa em foco — mais completo que o resumo em CONTEXTO ATUAL. Usa sempre que precises de dados que não estão no contexto, incluindo para saber que fármacos a pessoa toma antes de veres se há interações.${hasProfile ? '' : ' (Sem pessoa em foco agora — não uses nenhum destes dois tools.)'}

Podes também PROPOR uma ação concreta (no máximo uma), só quando fizer sentido real na conversa — nunca por rotina:
- save_summary: guardar um resumo/nota (ex.: o utilizador pediu um resumo, ou a resposta é longa e vale a pena consultar depois). Disponível sempre.
- log_resident_request: registar um pedido/queixa/observação que a pessoa em foco fez (ex.: "queixou-se de dores", "pediu para ligar à filha"). ${canLogRequest ? 'Disponível agora — há um utente em foco.' : 'NÃO disponível agora (sem utente institucional em foco) — nunca proponhas isto.'}

Responde APENAS com JSON válido, sem markdown:
{
  "mode": "answer" | "tool",
  "answer": "resposta completa e direta, PT-PT, SE mode=answer; caso contrário null",
  "tool": "check_interactions" | "patient_data" | null,
  "args": { "drugs": ["..."] } ou {},
  "remember": "facto curto e NOVO e durável a lembrar (ex: alergia confirmada, preferência) — ou null se nada digno de memória. Não repitas o que já está em O QUE JÁ SEI.",
  "proposedAction": { "type": "save_summary"|"log_resident_request", "label": "texto curto do botão de confirmação", "content": "o texto a guardar/registar" } ou null
}`

  let decision: CopilotDecision | null = null
  try {
    decision = await aiJSON<CopilotDecision>([
      { role: 'system', content: decisionSystem },
      ...((body.history || []).slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content).slice(0, 1500) }))),
      { role: 'user', content: body.message.slice(0, 1500) },
    ], { maxTokens: 900, temperature: 0.2 })
  } catch { /* cai no fallback abaixo */ }

  let finalAnswer = ''
  let usedTool: string | null = null

  try {
    if (decision && decision.mode === 'tool' && decision.tool) {
      usedTool = decision.tool
      let toolResult = ''
      if (decision.tool === 'check_interactions') {
        toolResult = await checkInteractionsTool(Array.isArray(decision.args?.drugs) ? decision.args!.drugs : [])
      } else if (decision.tool === 'patient_data') {
        if (authedSupabase) {
          const pd = await patientDataTool(authedSupabase, hasProfile ? { id: body.profileId!, type: body.profileType! } : null)
          toolResult = pd.text
          // Encadeia automaticamente check_interactions quando a pergunta é sobre
          // interações e o registo revelou ≥2 fármacos — evita obrigar a um 2º turno
          // só para descobrir que medicação a pessoa toma antes de verificar.
          if (pd.meds.length >= 2 && /interaç|dão-se bem|dá-se bem|seguro tomar|combinam|misturar/i.test(body.message)) {
            const interactionResult = await checkInteractionsTool(pd.meds)
            toolResult += `\n\n${interactionResult}`
            usedTool = 'patient_data_interactions'
          }
        } else {
          toolResult = 'Sem sessão para consultar o registo.'
        }
      }
      const { text } = await aiComplete([
        { role: 'system', content: `${baseSystem}\n\nRESULTADO REAL DA FERRAMENTA (usa isto como base factual da resposta — é informação verificada, não uma suposição):\n${toolResult}` },
        { role: 'user', content: body.message.slice(0, 1500) },
      ], { maxTokens: 700, temperature: 0.25 })
      finalAnswer = text
    } else if (decision?.answer) {
      finalAnswer = decision.answer
    } else {
      // Fallback: JSON falhou ou veio vazio — resposta simples em texto puro.
      const { text } = await aiComplete([
        { role: 'system', content: baseSystem },
        ...((body.history || []).slice(-6).map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content).slice(0, 1500) }))),
        { role: 'user', content: body.message.slice(0, 1500) },
      ], { maxTokens: 700, temperature: 0.3 })
      finalAnswer = text
    }

    // Memória: melhor-esforço, nunca falha o pedido principal.
    if (authedSupabase && decision?.remember) {
      authedSupabase.from('copilot_memory').insert({ user_id: userId, scope_key: scopeKey, fact: String(decision.remember).slice(0, 240) }).then(() => {}, () => {})
    }

    return NextResponse.json({
      reply: finalAnswer,
      usedTool,
      proposedAction: decision?.proposedAction || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Falha do copiloto' }, { status: 500 })
  }
}
