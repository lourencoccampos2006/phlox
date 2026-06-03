// lib/ai.ts
// Cliente de IA com fallback automático entre MUITOS providers + modelos.
//
// Sequência (default):
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
  temperature: number
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
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(25000),
    }
  )

  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
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
  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`)
  const data = await res.json()
  return data.content?.[0]?.text || ''
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
): Promise<AIResponse> {
  let lastErr: any = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const text = await fn()
      if (text?.trim()) return { text, provider, model }
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
  } = {}
): Promise<AIResponse> {
  const maxTokens = options.maxTokens ?? 800
  const temperature = options.temperature ?? 0.15

  // Lista completa de providers, na ordem que queremos tentar.
  const GROQ_LARGE: ProviderStep = { name: 'Groq', model: 'llama-3.3-70b-versatile', fn: () => callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature) }
  const GROQ_FAST:  ProviderStep = { name: 'Groq', model: 'llama-3.1-8b-instant',    fn: () => callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature) }
  // Modelos extra do Groq (nem sempre disponíveis — se 404, salta).
  const GROQ_EXTRA: ProviderStep[] = [
    { name: 'Groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct', fn: () => callGroq(messages, 'meta-llama/llama-4-maverick-17b-128e-instruct', maxTokens, temperature) },
    { name: 'Groq', model: 'llama-3.2-90b-vision-preview',                  fn: () => callGroq(messages, 'llama-3.2-90b-vision-preview', maxTokens, temperature) },
  ]

  // Gemini — múltiplos modelos como fallback de qualidade/quota.
  const GEMINI_FLASH:    ProviderStep = { name: 'Gemini', model: 'gemini-2.5-flash',      fn: () => callGemini(messages, 'gemini-2.5-flash', maxTokens, temperature) }
  const GEMINI_FLASH_20: ProviderStep = { name: 'Gemini', model: 'gemini-2.0-flash',      fn: () => callGemini(messages, 'gemini-2.0-flash', maxTokens, temperature) }
  const GEMINI_LITE_25:  ProviderStep = { name: 'Gemini', model: 'gemini-2.5-flash-lite', fn: () => callGemini(messages, 'gemini-2.5-flash-lite', maxTokens, temperature) }
  const GEMINI_LITE_20:  ProviderStep = { name: 'Gemini', model: 'gemini-2.0-flash-lite', fn: () => callGemini(messages, 'gemini-2.0-flash-lite', maxTokens, temperature) }

  // OpenAI / Anthropic — só entram se as chaves existirem
  const OPENAI: ProviderStep = { name: 'OpenAI', model: 'gpt-4o-mini',          fn: () => callOpenAI(messages, 'gpt-4o-mini', maxTokens, temperature) }
  const ANTHROPIC: ProviderStep = { name: 'Anthropic', model: 'claude-haiku-4-5-20251001', fn: () => callAnthropic(messages, 'claude-haiku-4-5-20251001', maxTokens, temperature) }

  const sequence: ProviderStep[] = options.preferFast
    ? [GROQ_FAST, GROQ_LARGE, ...GROQ_EXTRA, GEMINI_LITE_25, GEMINI_LITE_20, GEMINI_FLASH, GEMINI_FLASH_20, OPENAI, ANTHROPIC]
    : [GROQ_LARGE, GROQ_FAST, ...GROQ_EXTRA, GEMINI_FLASH, GEMINI_FLASH_20, GEMINI_LITE_25, GEMINI_LITE_20, OPENAI, ANTHROPIC]

  let lastError: any = null
  const errors: string[] = []

  for (const step of sequence) {
    try {
      return await tryProvider(step.fn, step.name, step.model)
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

export async function aiJSON<T>(
  messages: AIMessage[],
  options: Parameters<typeof aiComplete>[1] = {}
): Promise<T> {
  const result = await aiComplete(messages, options)
  if (!result.text?.trim()) throw new Error('Resposta vazia do serviço de IA. Tenta novamente.')

  const clean = result.text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Try to extract the first JSON object or array if the model added surrounding text
  const match = clean.match(/[\[{][\s\S]*[\]\}]/)
  const toParse = match ? match[0] : clean

  try {
    return JSON.parse(toParse) as T
  } catch {
    // Tentativa de reparo: quando max_tokens corta a resposta a meio (caso
    // comum em quizzes de 10+ perguntas), aproveita os items completos.
    const repaired = repairTruncatedJSON(toParse)
    if (repaired) {
      try { return JSON.parse(repaired) as T } catch {}
    }
    throw new Error('Não foi possível interpretar a resposta da IA. Tenta novamente.')
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
const VISION_MODELS = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']

export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado no ambiente do servidor.')

  const bodyStr = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens || 1500, temperature: opts.temperature ?? 0.1 },
  })

  let lastErr = 'tenta novamente'
  // Tenta vários modelos — se um não estiver disponível para a chave (404), passa ao seguinte.
  for (const model of VISION_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyStr, signal: AbortSignal.timeout(30000) }
      )
      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (text) return text
        lastErr = 'resposta vazia'
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
  opts: { maxTokens?: number } = {}
): Promise<T> {
  const text = await callGeminiVision(prompt, imageBase64, mimeType, opts)
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  // Find JSON object or array in response
  const match = clean.match(/[\[{][\s\S]*[\]\}]/)
  if (!match) throw new Error('Não foi possível interpretar a imagem. Tenta com uma foto mais nítida.')
  try {
    return JSON.parse(match[0]) as T
  } catch {
    throw new Error('Erro ao processar resposta. Tenta novamente.')
  }
}