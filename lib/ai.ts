import { registarUso, estimarTokens } from './aiCusto'
// lib/ai.ts
// Cliente de IA com fallback automático entre MUITOS providers + modelos.
//
// Sequência (default): rápido primeiro, qualidade como rede.
// Com `{ qualidade: true }`: Claude Sonnet primeiro, depois Gemini 2.5 — para
// rotas onde ler mal tem consequências (análises, relatórios, receitas).
// A escada de VISÃO (VISION_MODELS) esteve ordenada do pior para o melhor até
// 2026-09-15; ver a nota lá em baixo.
//   1) Groq llama-3.3-70b-versatile
//   2) Groq llama-3.1-8b-instant
//   3) Groq llama-3.2-90b-vision-preview  (fallback de qualidade)
//   4) Gemini 2.5 Flash
//   5) Gemini 2.0 Flash
//   6) Gemini 2.5 Flash Lite
//   7) Gemini 2.0 Flash Lite
//   8) OpenAI gpt-4o-mini (se OPENAI_API_KEY definida)
//   9) Anthropic claude-haiku-4-5 (se ANTHROPIC_API_KEY definida)
//
// Para cada provider/modelo, em caso de 429 ou timeout, faz até 2 retries com
// backoff exponencial (1s, 3s) antes de saltar ao próximo. Isto resolve falhas
// transientes do Groq (free tier que reseta de segundos a segundos) sem expor
// o erro ao utilizador.

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  text: string
  provider: string
  model: string
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

function isRetryable(err: any): boolean {
  if (!err) return false
  if (err.status === 429) return true
  if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
  const msg = (err.message || '').toLowerCase()
  return msg.includes('rate limit') || msg.includes('timeout') || msg.includes('overloaded')
    || msg.includes('econnreset') || msg.includes('502') || msg.includes('503') || msg.includes('504')
}

// ─── Provider 1: Groq ─────────────────────────────────────────────────────────

async function callGroq(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(25000),
  })

  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`Groq error: ${res.status}`)

  const data = await res.json()
  return data.choices[0]?.message?.content || ''
}

// ─── Provider 2: Gemini ────────────────────────────────────────────────────────

async function callGemini(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number,
  json = false,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const systemMsg = messages.find(m => m.role === 'system')?.content || ''
  const chatMessages = messages.filter(m => m.role !== 'system')

  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          // ── O QUE PARTIU O /scan E O /vault (2026-09-17) ────────────────
          // Os Gemini modernos PENSAM antes de responder, e o pensamento sai
          // do MESMO orçamento de `maxOutputTokens`. Com 3000 tokens, o
          // modelo gastava a maior parte a pensar e a resposta saía cortada a
          // meio de uma string — JSON inválido, e o utilizador via "Não foi
          // possível interpretar a resposta da IA", três vezes seguidas,
          // porque o problema não era sorte nenhuma: era determinístico.
          //
          // Quando se quer JSON, não se quer prosa nem raciocínio visível.
          // Orçamento de pensamento a zero e o formato pedido à API em vez de
          // pedido por palavras — assim não vem dentro de ```json nem com um
          // "Aqui está:" à frente.
          ...(json ? { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(25000),
    }
  )

  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)

  const data = await res.json()
  const cand = data.candidates?.[0]
  // TODAS as partes, e nunca as de pensamento. Ler só `parts[0]` devolvia o
  // raciocínio (ou vazio) nos modelos que pensam.
  const texto = (cand?.content?.parts || [])
    .filter((x: any) => x && !x.thought && typeof x.text === 'string')
    .map((x: any) => x.text).join('')

  // Resposta cortada é resposta estragada. Mais vale falhar aqui e deixar a
  // escada tentar o modelo seguinte do que devolver meio JSON como se fosse bom.
  if (cand?.finishReason === 'MAX_TOKENS' && json) {
    throw new Error(`Gemini ${model}: resposta cortada por falta de espaço`)
  }
  return texto
}

// ─── Provider 3: OpenAI (fallback final, se chave configurada) ────────────────

async function callOpenAI(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    signal: AbortSignal.timeout(25000),
  })
  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
  const data = await res.json()
  return data.choices[0]?.message?.content || ''
}

// ─── Provider 4: Anthropic Claude (fallback final, se chave configurada) ──────

async function callAnthropic(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const system = messages.find(m => m.role === 'system')?.content
  const chat = messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: chat }),
    signal: AbortSignal.timeout(25000),
  })
  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) {
    // O 400 da Anthropic diz porquê no corpo. Sem isto, uma conta sem saldo
    // aparecia nos registos como "Anthropic error: 400" e ninguém percebia
    // que bastava carregar a conta.
    const d = await res.json().catch(() => ({} as any))
    throw new Error(d?.error?.message || `Anthropic error: ${res.status}`)
  }
  const data = await res.json()
  // Todos os blocos de texto, não só o primeiro: um modelo que devolva um
  // bloco de raciocínio à frente deixava isto a zero.
  return (data.content || [])
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text).join('\n') || ''
}

// ─── Wrapper de retry por (provider, modelo) ─────────────────────────────────

// Retry curto e por provider — para que com muitos providers em sequência
// o pior caso continue dentro do orçamento de uma resposta (chat ~20s).
async function tryProvider(
  fn: () => Promise<string>,
  provider: string,
  model: string,
  retries = 1,
  backoff = [500],
  messagesTexto = '',
): Promise<AIResponse> {
  let lastErr: any = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    const t0 = Date.now()
    try {
      const text = await fn()
      if (text?.trim()) {
        // ── Registo de consumo ────────────────────────────────────────────
        // Aqui, e não em cada rota: das 101 rotas que chamam a IA só quatro
        // registavam, e por isso o /admin mostrava 0 €. Os fornecedores não
        // devolvem contagem de tokens de forma uniforme, por isso estima-se
        // por caracteres — aproximado e assumido como tal, mas é uma ordem de
        // grandeza real em vez de um zero.
        registarUso({
          provider, model, ms: Date.now() - t0, ok: true,
          tokensIn: estimarTokens(messagesTexto), tokensOut: estimarTokens(text),
        })
        return { text, provider, model }
      }
      // resposta vazia — não vale a pena retry, salta para próximo
      throw new Error('Resposta vazia')
    } catch (err: any) {
      lastErr = err
      if (attempt < retries && isRetryable(err)) {
        await sleep(backoff[attempt] ?? 500)
        continue
      }
      throw err
    }
  }
  throw lastErr || new Error('Unknown error')
}

// ─── Main: AI with fallback ───────────────────────────────────────────────────

interface ProviderStep {
  name: string
  model: string
  fn: () => Promise<string>
}

export async function aiComplete(
  messages: AIMessage[],
  options: {
    maxTokens?: number
    temperature?: number
    preferFast?: boolean   // prefer the fast/small model first
    /** O melhor modelo primeiro, mesmo que demore mais.
     *
     *  Para escrever um resumo simpático, o llama-3.3-70b chega e sobra. Para
     *  INTERPRETAR análises clínicas ou um relatório médico, não: ler mal um
     *  valor ou trocar o sentido de uma frase tem consequências reais para
     *  quem está do outro lado. Nessas rotas pede-se qualidade e espera-se os
     *  segundos a mais. */
    qualidade?: boolean
    /** A resposta vai ser lida como JSON. Deixa os fornecedores que o suportam
     *  devolver JSON de raiz, em vez de o pedir por palavras e esperar. */
    json?: boolean
    /** Aceitar a resposta deste fornecedor?
     *
     *  Existe por causa de um erro que deitou abaixo o /scan e o /vault: um
     *  fornecedor devolvia texto — portanto "sucesso" — mas o texto não era
     *  JSON válido, e a escada parava ali. Um fornecedor a responder mal
     *  passava a valer mais do que três a responder bem, que estavam logo a
     *  seguir na fila e nunca eram chamados.
     *
     *  Com isto, "responder" e "responder uma coisa utilizável" passam a ser
     *  a mesma condição, e a escada faz o que existe para fazer. */
    validar?: (texto: string) => boolean
  } = {}
): Promise<AIResponse> {
  const maxTokens = options.maxTokens ?? 800
  const temperature = options.temperature ?? 0.15
  const json = options.json === true

  // Lista completa de providers, na ordem que queremos tentar.
  const GROQ_LARGE: ProviderStep = { name: 'Groq', model: 'llama-3.3-70b-versatile', fn: () => callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature) }
  const GROQ_FAST:  ProviderStep = { name: 'Groq', model: 'llama-3.1-8b-instant',    fn: () => callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature) }
  // Modelos extra do Groq (nem sempre disponíveis — se 404, salta).
  const GROQ_EXTRA: ProviderStep[] = [
    { name: 'Groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct', fn: () => callGroq(messages, 'meta-llama/llama-4-maverick-17b-128e-instruct', maxTokens, temperature) },
    { name: 'Groq', model: 'llama-3.2-90b-vision-preview',                  fn: () => callGroq(messages, 'llama-3.2-90b-vision-preview', maxTokens, temperature) },
  ]

  // Gemini — vários modelos como rede de segurança de qualidade/quota.
  //
  // O `gemini-2.0-flash` e o `gemini-2.0-flash-lite` foram DESLIGADOS pela
  // Google (404: "no longer available"). Estavam aqui como dois degraus da
  // escada e eram, na prática, dois degraus a menos. Verificado a 2026-09-17
  // contra a lista de modelos da API; substituídos pelos que existem hoje.
  // O `-latest` no fim é de propósito: é o degrau que sobrevive à próxima vez
  // que a Google desligar um modelo com nome e versão.
  const GEMINI_NOVO:     ProviderStep = { name: 'Gemini', model: 'gemini-3.8-flash',      fn: () => callGemini(messages, 'gemini-3.8-flash', maxTokens, temperature, json) }
  const GEMINI_FLASH:    ProviderStep = { name: 'Gemini', model: 'gemini-2.5-flash',      fn: () => callGemini(messages, 'gemini-2.5-flash', maxTokens, temperature, json) }
  const GEMINI_36:       ProviderStep = { name: 'Gemini', model: 'gemini-3.6-flash',      fn: () => callGemini(messages, 'gemini-3.6-flash', maxTokens, temperature, json) }
  const GEMINI_LITE_25:  ProviderStep = { name: 'Gemini', model: 'gemini-2.5-flash-lite', fn: () => callGemini(messages, 'gemini-2.5-flash-lite', maxTokens, temperature, json) }
  const GEMINI_ULTIMO:   ProviderStep = { name: 'Gemini', model: 'gemini-flash-latest',   fn: () => callGemini(messages, 'gemini-flash-latest', maxTokens, temperature, json) }

  // OpenAI / Anthropic — só entram se as chaves existirem
  const OPENAI: ProviderStep = { name: 'OpenAI', model: 'gpt-4o-mini',          fn: () => callOpenAI(messages, 'gpt-4o-mini', maxTokens, temperature) }
  const ANTHROPIC: ProviderStep = { name: 'Anthropic', model: 'claude-haiku-4-5-20251001', fn: () => callAnthropic(messages, 'claude-haiku-4-5-20251001', maxTokens, temperature) }

  // O Claude, quando se pede qualidade. Estava configurado e era o ÚLTIMO da
  // escada — ou seja, na prática nunca era usado. Ver a nota em `qualidade`.
  const CLAUDE_BOM: ProviderStep = { name: 'Anthropic', model: 'claude-sonnet-5', fn: () => callAnthropic(messages, 'claude-sonnet-5', maxTokens, temperature) }

  const sequence: ProviderStep[] = options.qualidade
    ? [CLAUDE_BOM, GEMINI_NOVO, GEMINI_FLASH, ANTHROPIC, GEMINI_36, GROQ_LARGE, ...GROQ_EXTRA, GEMINI_LITE_25, GEMINI_ULTIMO, OPENAI]
    : options.preferFast
      ? [GROQ_FAST, GROQ_LARGE, ...GROQ_EXTRA, GEMINI_LITE_25, GEMINI_NOVO, GEMINI_FLASH, GEMINI_ULTIMO, OPENAI, ANTHROPIC]
      : [GROQ_LARGE, GROQ_FAST, ...GROQ_EXTRA, GEMINI_NOVO, GEMINI_FLASH, GEMINI_36, GEMINI_LITE_25, GEMINI_ULTIMO, OPENAI, ANTHROPIC]

  let lastError: any = null
  const errors: string[] = []

  for (const step of sequence) {
    try {
      const r = await tryProvider(step.fn, step.name, step.model, 1, [500], messages.map(m => m.content).join(' '))
      // Responder não chega: tem de ser uma resposta que sirva. Ver `validar`.
      if (options.validar && !options.validar(r.text)) {
        errors.push(`${step.name}/${step.model}: respondeu, mas a resposta não serve`)
        lastError = new Error(`${step.model} devolveu uma resposta que não se consegue usar`)
        continue
      }
      return r
    } catch (err: any) {
      lastError = err
      const msg = (err?.message || '').toLowerCase()
      // Se a chave não existe, é silencioso — só ignora este provider.
      if (msg.includes('not set')) continue
      errors.push(`${step.name}/${step.model}: ${err.message}`)
      // Se for um erro irrecuperável definitivo (chave inválida) podemos saltar para o próximo provider sem retry.
      continue
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error('[aiComplete] todos os providers falharam:', errors)
  }
  const detail = lastError?.message ? ` (último: ${lastError.message})` : ''
  throw new Error(`Todos os serviços de IA estão temporariamente indisponíveis${detail}. Tenta novamente em alguns segundos.`)
}

// ─── JSON helper ─────────────────────────────────────────────────────────────

/** Tira JSON de uma resposta, venha ela como vier.
 *
 *  Devolve `undefined` quando não há nada de aproveitável — e é essa a
 *  diferença que interessa: `undefined` é o sinal para a escada tentar o
 *  fornecedor seguinte, em vez de desistir com a resposta do primeiro. */
export function extrairJSON<T>(texto: string): T | undefined {
  if (!texto?.trim()) return undefined

  const limpo = texto
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Do primeiro parêntesis ao último: apanha o objeto mesmo que o modelo tenha
  // escrito "Aqui está o resultado:" antes.
  const match = limpo.match(/[\[{][\s\S]*[\]\}]/)
  const candidatos = [match ? match[0] : null, limpo].filter(Boolean) as string[]

  for (const c of candidatos) {
    try { return JSON.parse(c) as T } catch { /* segue */ }
    // Cortado a meio (o orçamento de tokens acabou): aproveita-se o que está
    // completo em vez de deitar tudo fora.
    const reparado = repairTruncatedJSON(c)
    if (reparado) {
      try { return JSON.parse(reparado) as T } catch { /* segue */ }
    }
  }
  return undefined
}

export async function aiJSON<T>(
  messages: AIMessage[],
  options: Parameters<typeof aiComplete>[1] = {}
): Promise<T> {
  // ── O QUE ESTAVA ERRADO AQUI (2026-09-17) ────────────────────────────────
  // Isto pedia UMA resposta e tentava lê-la. Se o fornecedor do topo devolvia
  // texto que não era JSON — por estar cortado, por vir com prosa à frente, o
  // que fosse — a função desistia, e o utilizador via "Não foi possível
  // interpretar a resposta da IA. Tenta novamente". Tentar outra vez não
  // resolvia nada, porque a escada voltava a parar exatamente no mesmo sítio.
  // Havia quatro fornecedores a seguir na fila que nunca chegavam a ser
  // chamados.
  //
  // Agora a leitura do JSON faz parte da condição de sucesso: um fornecedor
  // que não devolva JSON utilizável é um fornecedor que falhou, e a escada
  // segue para o seguinte. É para isso que ela existe.
  let lido: T | undefined

  const result = await aiComplete(messages, {
    ...options,
    json: true,
    validar: (texto) => {
      const v = extrairJSON<T>(texto)
      if (v === undefined) return false
      lido = v
      return true
    },
  })

  if (lido !== undefined) return lido
  // Não devia acontecer (o `validar` já leu), mas se alguém chamar o
  // aiComplete com outro `validar` por cima, tenta-se à mesma.
  const ultima = extrairJSON<T>(result.text)
  if (ultima !== undefined) return ultima
  throw new Error('Não foi possível interpretar a resposta da IA. Tenta novamente.')
}

// ─── Verificação cruzada (interna, silenciosa) ───────────────────────────────
// Para decisões críticas: corre a resposta DUAS vezes (a 2ª com preferência de
// modelo diferente) e reconcilia num resultado final mais fiável.
// IMPORTANTE: o resultado devolvido NÃO indica que houve 2ª passagem nem que foi
// IA — é apenas o resultado final, mais robusto. Falha graciosamente para 1 só
// passagem se a 2ª ou a reconciliação falharem.
export async function aiJSONVerified<T>(
  messages: AIMessage[],
  reconcilePrompt: string,
  options: { maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  const first = await aiJSON<T>(messages, options)
  let second: T | null = null
  try {
    second = await aiJSON<T>(messages, { ...options, temperature: 0, preferFast: true } as any)
  } catch { return first }

  // Se forem idênticos, não vale a pena reconciliar.
  try { if (JSON.stringify(first) === JSON.stringify(second)) return first } catch {}

  try {
    const reconciled = await aiJSON<T>([
      { role: 'system', content: `${reconcilePrompt}\n\nRecebes DUAS análises do mesmo caso. Produz a resposta FINAL correta: mantém o que ambas concordam, resolve divergências pelo mais rigoroso/seguro, descarta erros. Responde no MESMO formato JSON. Sem markdown, PT-PT.` },
      { role: 'user', content: `Análise A:\n${JSON.stringify(first)}\n\nAnálise B:\n${JSON.stringify(second)}` },
    ], { maxTokens: options.maxTokens ?? 1500, temperature: 0 })
    return reconciled
  } catch {
    return first
  }
}

// Repara JSON truncado (típico de respostas cortadas por max_tokens).
// Estratégia: encontra o último item completo do array e fecha as estruturas
// pendentes. Suporta arrays no topo OU objeto { key: [ ... ] }.
function repairTruncatedJSON(text: string): string | null {
  // Caso 1: objeto com um array de items — { "questions": [ ... ] } ou similar
  // Procura o primeiro `[` depois do início e tenta recuperar items até ao último `}` válido.
  const arrayStart = text.indexOf('[')
  if (arrayStart < 0) return null

  // Walk balanced braces para encontrar o índice do último `}` que fecha um item completo
  let depth = 0
  let lastGoodIdx = -1
  let inString = false
  let escape = false
  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{' || ch === '[') depth++
    else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && ch === '}') lastGoodIdx = i  // item completo no array
      if (depth < 0) break
    }
  }

  if (lastGoodIdx < 0) return null

  // Trunca após o último item completo, fecha array e (se necessário) objeto exterior
  let result = text.substring(0, lastGoodIdx + 1) + ']'
  if (text.trimStart().startsWith('{')) result += '}'
  return result
}

// ─── Gemini Vision: image analysis ───────────────────────────────────────────

// Modelos atuais (jan 2026). gemini-1.5-* foi descontinuado na v1beta → removido.
// Os -lite são os mais baratos; ficam à frente para minimizar custo.
// ─── Visão: ler uma imagem ou um PDF ─────────────────────────────────────────
//
// ── A ORDEM IMPORTA, E ESTAVA AO CONTRÁRIO ─────────────────────────────────
// Até 2026-09-15 esta escada começava em `gemini-2.0-flash-lite` — o modelo
// mais fraco de todos — e só chegava ao `2.5-flash` no fim, se os outros
// falhassem. Como o primeiro quase nunca falha, era SEMPRE o mais fraco a ler
// os relatórios e as análises. Era essa a causa dos erros de leitura no /labs
// e da interpretação rasa no /scan: não é que a IA não consiga; é que se estava
// a pedir ao aprendiz em vez de ao especialista.
//
// Uma escada de fallback existe para aguentar falhas, não para poupar. Começa
// no melhor e desce só quando é preciso.
//
// ── E O CLAUDE NÃO ESTAVA CÁ ───────────────────────────────────────────────
// A ANTHROPIC_API_KEY já estava configurada e o Claude era o ÚLTIMO da escada
// de texto e não existia de todo na de visão. Para ler um relatório médico
// manuscrito, com siglas e uma estrutura que muda de hospital para hospital, é
// dos melhores que há. Agora é o primeiro quando se pede qualidade.
//
// ── E DOIS DELES JÁ NÃO EXISTIAM (2026-09-17) ──────────────────────────────
// `gemini-2.0-flash` e `gemini-2.0-flash-lite` foram desligados pela Google e
// respondiam 404. Metade da escada de visão era decorativa. Confirmado contra
// a lista de modelos da API e substituídos pelos que existem hoje.
const VISION_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']

/** Claude a ler uma imagem. O `messages` da API aceita blocos de imagem em
 *  base64 — é a mesma rota das mensagens normais, com outro tipo de conteúdo. */
async function callAnthropicVision(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  model: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  // Um PDF entra como `document`, não como imagem — e é aí que o Claude ganha
  // mais: lê o PDF inteiro, com as tabelas de valores de referência que as
  // folhas de análises trazem, em vez de o tratar como uma fotografia.
  const ehPdf = mimeType === 'application/pdf'
  const tipo = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType)
    ? mimeType : 'image/jpeg'
  const bloco = ehPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
    : { type: 'image', source: { type: 'base64', media_type: tipo, data: imageBase64 } }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens, temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          bloco,
          { type: 'text', text: prompt },
        ],
      }],
    }),
    signal: AbortSignal.timeout(60000),
  })
  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) {
    const d = await res.json().catch(() => ({} as any))
    throw new Error(d?.error?.message || `Anthropic vision ${res.status}`)
  }
  const data = await res.json()
  return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || ''
}

export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  opts: { maxTokens?: number; temperature?: number; qualidade?: boolean; json?: boolean; validar?: (t: string) => boolean } = {}
): Promise<string> {
  // Com `qualidade`, o Claude primeiro — e num PDF de análises isso conta a
  // dobrar: ele lê o documento inteiro, com as colunas de valores de
  // referência, em vez de o tratar como uma fotografia de texto.
  if (opts.qualidade && process.env.ANTHROPIC_API_KEY) {
    for (const m of ['claude-sonnet-5', 'claude-haiku-4-5-20251001']) {
      try {
        const t0 = Date.now()
        const t = await callAnthropicVision(prompt, imageBase64, mimeType, m, opts.maxTokens || 2400)
        if (t && (!opts.validar || opts.validar(t))) {
          registarUso({
            provider: 'Anthropic', model: m, ms: Date.now() - t0, ok: true, feature: 'visao',
            tokensIn: estimarTokens(prompt) + Math.round(imageBase64.length / 750),
            tokensOut: estimarTokens(t),
          })
          return t
        }
      } catch { /* cai para a escada do Gemini */ }
    }
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado no ambiente do servidor.')

  const bodyStr = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens || 1500,
      temperature: opts.temperature ?? 0.1,
      // Mesma razão do callGemini: o pensamento sai do orçamento da resposta e
      // deixava o JSON cortado a meio. Ver a nota lá em cima.
      ...(opts.json ? { responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  })

  let lastErr = 'tenta novamente'
  // Tenta vários modelos — se um não estiver disponível para a chave (404), passa ao seguinte.
  for (const model of VISION_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr, signal: AbortSignal.timeout(20000) }
      )
      if (res.ok) {
        const data = await res.json()
        const cand = data.candidates?.[0]
        // Todas as partes e nunca as de pensamento — ler só `parts[0]` dava o
        // raciocínio, ou vazio, nos modelos que pensam.
        const text = (cand?.content?.parts || [])
          .filter((x: any) => x && !x.thought && typeof x.text === 'string')
          .map((x: any) => x.text).join('')
        if (cand?.finishReason === 'MAX_TOKENS' && opts.json) {
          lastErr = 'resposta cortada por falta de espaço'
        } else if (text && opts.validar && !opts.validar(text)) {
          // Respondeu, mas não se consegue usar. É uma falha como outra
          // qualquer — segue para o modelo seguinte em vez de desistir.
          lastErr = 'a resposta não veio em formato utilizável'
        } else if (text) return text
        else lastErr = 'resposta vazia'
        continue
      }
      const errData = await res.json().catch(() => ({} as any))
      lastErr = errData?.error?.message || `HTTP ${res.status}`
      const msg = lastErr.toLowerCase()
      // Erros DEFINITIVOS da chave → parar já (não adianta tentar outros modelos):
      if (msg.includes('api key not valid') || msg.includes('api_key_invalid') || msg.includes('permission') && msg.includes('denied'))
        throw new Error('Chave Gemini inválida ou sem permissões. Verifica a GEMINI_API_KEY e se a Generative Language API está ativada no projeto Google.')
      // 404 (modelo não existe p/ esta chave) ou 400 (modelo não suporta) → tenta o próximo modelo
      if (res.status === 404 || res.status === 400) continue
      if (res.status === 429) { lastErr = 'quota/limite atingido'; continue }
      // outros (403, 5xx) → tenta o próximo também, antes de desistir
      continue
    } catch (e: any) {
      if (e?.message?.includes('Chave Gemini inválida')) throw e
      lastErr = e?.message || lastErr
      if (e?.name === 'TimeoutError') continue
      continue
    }
  }
  throw new Error(`Análise por imagem indisponível (${lastErr}). Tenta novamente; se persistir, a chave Gemini pode estar sem acesso a modelos de visão.`)
}

export async function callGeminiVisionJSON<T>(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  opts: { maxTokens?: number; qualidade?: boolean } = {}
): Promise<T> {
  // `qualidade: true` → o Claude primeiro. Para ler um relatório médico ou uma
  // folha de análises, a diferença entre o melhor modelo e o mais barato não é
  // de estilo: é ler "creatinina 1,9" ou "creatinina 19". Quem chama com
  // qualidade aceita esperar mais alguns segundos por isso.
  //
  // Se o Claude falhar (sem chave, quota, timeout), cai para a escada Gemini
  // sem dizer nada a ninguém — é para isso que uma escada serve.
  // A leitura do JSON faz parte da condição de sucesso, aqui como no aiJSON:
  // um modelo que responda com algo que não se consegue ler é um modelo que
  // falhou, e a escada segue. Antes bastava o primeiro responder qualquer
  // coisa para o pedido inteiro morrer ali.
  let lido: T | undefined
  const aceitar = (t: string) => {
    const v = extrairJSON<T>(t)
    if (v === undefined) return false
    lido = v
    return true
  }

  let text = ''
  if (opts.qualidade && process.env.ANTHROPIC_API_KEY) {
    for (const m of ['claude-sonnet-5', 'claude-haiku-4-5-20251001']) {
      try {
        const t0 = Date.now()
        text = await callAnthropicVision(prompt, imageBase64, mimeType, m, opts.maxTokens || 2400)
        if (text && !aceitar(text)) text = ''
        if (text) {
          registarUso({
            provider: 'Anthropic', model: m, ms: Date.now() - t0, ok: true, feature: 'visao',
            // Uma imagem custa tokens a valer. A regra da Anthropic é
            // ~(largura × altura) / 750; sem as dimensões aqui, aproxima-se
            // pelo tamanho do base64, que lhes é proporcional. É uma
            // estimativa e está assumida como tal — melhor isso do que
            // registar zero e o /admin voltar a dizer que a visão é grátis.
            tokensIn: estimarTokens(prompt) + Math.round(imageBase64.length / 750),
            tokensOut: estimarTokens(text),
          })
          break
        }
      } catch { text = '' }
    }
  }
  if (lido !== undefined) return lido

  await callGeminiVision(prompt, imageBase64, mimeType, { ...opts, json: true, validar: aceitar })
  if (lido !== undefined) return lido

  throw new Error('Não foi possível interpretar a imagem. Tenta com uma foto mais nítida, sem sombra e com o papel direito.')
}

// ─── Transcrição de áudio (Groq Whisper) ──────────────────────────────────────
// Transcreve áudio para texto. Por defeito usa whisper-large-v3-turbo (rápido,
// bom para gravações longas como aulas em /study/notas). Chamadores que
// precisam de mais RIGOR em vez de velocidade (gravações curtas, vocabulário
// técnico, sala ruidosa — ex. Regista falando institucional) devem pedir
// model:'whisper-large-v3' (o modelo completo, sem o corte de precisão do
// turbo) e podem passar um `prompt` curto com vocabulário esperado — é o
// mecanismo oficial do Whisper para enviesar o reconhecimento para termos que
// de outra forma seriam confundidos (nomes de medicamentos, jargão clínico).
// audioBase64 sem o prefixo data:; mimeType ex: 'audio/webm'.
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = 'audio/webm',
  language: string = 'pt',
  opts?: { model?: 'whisper-large-v3-turbo' | 'whisper-large-v3'; prompt?: string }
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set')

  // base64 → Blob
  const bin = atob(audioBase64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('mpeg') ? 'mp3' : mimeType.includes('wav') ? 'wav' : 'webm'

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), `audio.${ext}`)
  form.append('model', opts?.model || 'whisper-large-v3-turbo')
  form.append('language', language)
  form.append('response_format', 'text')
  if (opts?.prompt) form.append('prompt', opts.prompt.slice(0, 800))

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  })
  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`Groq Whisper error: ${res.status}`)
  return (await res.text()).trim()
}