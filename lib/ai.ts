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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.0-flash' }),
      ]
    : [
        async () => ({ text: await callGroq(messages, 'llama-3.3-70b-versatile', maxTokens, temperature), provider: 'Groq', model: 'llama-3.3-70b-versatile' }),
        async () => ({ text: await callGroq(messages, 'llama-3.1-8b-instant', maxTokens, temperature), provider: 'Groq', model: 'llama-3.1-8b-instant' }),
        async () => ({ text: await callGemini(messages, maxTokens, temperature), provider: 'Gemini', model: 'gemini-2.0-flash' }),
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