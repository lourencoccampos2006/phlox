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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`,
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
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.5-flash-preview-04-17' }),
      ]
    : [
        async () => ({ text: await callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature), provider: 'Groq', model: 'llama-3.3-70b-versatile' }),
        async () => ({ text: await callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature), provider: 'Groq', model: 'llama-3.1-8b-instant' }),
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.5-flash-preview-04-17' }),
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
  const clean = result.text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(clean) as T
}

// ─── Gemini Vision: image analysis ───────────────────────────────────────────

export async function callGeminiVision(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurado. Adiciona a variável no Cloudflare.')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          maxOutputTokens: opts.maxTokens || 1500,
          temperature: opts.temperature ?? 0.1,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  )

  if (res.status === 429) throw new Error('Serviço temporariamente sobrecarregado. Tenta daqui a pouco.')
  if (res.status === 400) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(`Imagem inválida: ${errData?.error?.message || 'formato não suportado'}`)
  }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(`Erro Gemini ${res.status}: ${errData?.error?.message || 'tenta novamente'}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) throw new Error('Resposta vazia do serviço de visão. Tenta uma foto com melhor iluminação.')
  return text
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