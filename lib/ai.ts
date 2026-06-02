// lib/ai.ts
// Cliente de IA com fallback automático entre providers
// Ordem: Groq 70B → Groq 8B → Gemini Flash
// Quando um provider dá rate limit (429) ou erro, tenta o seguinte automaticamente

interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface AIResponse {
  text: string
  provider: string
  model: string
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
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  // Convert OpenAI-style messages to Gemini format
  const systemMsg = messages.find(m => m.role === 'system')?.content || ''
  const chatMessages = messages.filter(m => m.role !== 'system')

  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: systemMsg ? { parts: [{ text: systemMsg }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
      signal: AbortSignal.timeout(25000),
    }
  )

  if (res.status === 429) throw Object.assign(new Error('Rate limit'), { status: 429 })
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── Main: AI with fallback ───────────────────────────────────────────────────

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

  // Define provider sequence
  // preferFast: use 8B first (for simple tasks like translation, safety checks)
  // default: use 70B first (for complex clinical reasoning)
  const providers: Array<() => Promise<{ text: string; provider: string; model: string }>> = options.preferFast
    ? [
        async () => ({ text: await callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature), provider: 'Groq', model: 'llama-3.1-8b-instant' }),
        async () => ({ text: await callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature), provider: 'Groq', model: 'llama-3.3-70b-versatile' }),
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.5-flash' }),
      ]
    : [
        async () => ({ text: await callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature), provider: 'Groq', model: 'llama-3.3-70b-versatile' }),
        async () => ({ text: await callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature), provider: 'Groq', model: 'llama-3.1-8b-instant' }),
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.5-flash' }),
      ]

  let lastError: Error | null = null

  for (const provider of providers) {
    try {
      const result = await provider()
      if (result.text?.trim()) return result
    } catch (err: any) {
      lastError = err
      // Only retry on rate limit or timeout — other errors (bad API key, etc) skip to next
      const shouldRetry = err.status === 429 || err.name === 'TimeoutError' || err.message?.includes('Rate limit')
      if (!shouldRetry && !err.message?.includes('not set')) {
        console.error(`AI provider error (${err.message}) — trying next`)
      }
      continue
    }
  }

  throw new Error(`Todos os serviços de IA estão temporariamente indisponíveis. Tenta novamente em alguns minutos.`)
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