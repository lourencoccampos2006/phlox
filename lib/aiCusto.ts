// lib/aiCusto.ts
// ─────────────────────────────────────────────────────────────────────────────
// Quanto custa cada chamada de IA, e o registo dela.
//
// Antes, o /admin mostrava 0 € depois de se gerarem ementas inteiras: das 101
// rotas que chamam a IA, só quatro registavam alguma coisa — e mesmo essas
// guardavam só a contagem, sem modelo nem tokens. Agora o registo é feito uma
// vez só, dentro do aiComplete, por onde tudo passa.
//
// Os preços são por milhão de tokens, em dólares, e estão à mão de propósito:
// mudam de mês a mês e é melhor terem uma data ao lado do que virem de um sítio
// que ninguém sabe onde é. Um modelo que não esteja aqui conta 0 e fica
// assinalado — melhor um zero visível do que um número inventado.
// ─────────────────────────────────────────────────────────────────────────────

/** USD por milhão de tokens [entrada, saída]. Atualizado a 2026-09-06. */
const PRECOS: Record<string, [number, number]> = {
  // Groq
  'llama-3.3-70b-versatile': [0.59, 0.79],
  'llama-3.1-8b-instant': [0.05, 0.08],
  'openai/gpt-oss-120b': [0.15, 0.60],
  'whisper-large-v3': [0.111, 0],
  'whisper-large-v3-turbo': [0.04, 0],
  // OpenAI
  'gpt-4o-mini': [0.15, 0.60],
  'gpt-4o': [2.50, 10.00],
  'gpt-4.1-mini': [0.40, 1.60],
  // Google
  'gemini-2.0-flash': [0.10, 0.40],
  'gemini-1.5-flash': [0.075, 0.30],
}

export function custoUsd(model: string, tokensIn: number, tokensOut: number): number | null {
  const p = PRECOS[model]
  if (!p) return null
  return (tokensIn / 1e6) * p[0] + (tokensOut / 1e6) * p[1]
}

/** Estimativa de tokens quando o fornecedor não os devolve. ~4 caracteres por token. */
export const estimarTokens = (texto: string) => Math.ceil(String(texto || '').length / 4)

export interface UsoIA {
  provider: string
  model: string
  tokensIn: number
  tokensOut: number
  ms: number
  ok: boolean
  feature?: string | null
  userId?: string | null
}

/**
 * Grava o consumo. Best-effort e sem await do lado de quem chama: um registo
 * de custo nunca pode fazer falhar uma resposta de IA que já foi dada.
 */
export function registarUso(u: UsoIA): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !chave) return   // sem chave de serviço não há onde escrever
  const linha = {
    user_id: u.userId || null,
    feature: u.feature || 'geral',
    provider: u.provider,
    model: u.model,
    tokens_in: u.tokensIn,
    tokens_out: u.tokensOut,
    cost_usd: custoUsd(u.model, u.tokensIn, u.tokensOut),
    ms: u.ms,
    ok: u.ok,
  }
  // fetch direto em vez do cliente Supabase: isto corre no caminho quente de
  // todas as chamadas de IA e não vale a pena instanciar um cliente por cada.
  fetch(`${url}/rest/v1/ai_usage_log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(linha),
  }).catch(() => {})
}
