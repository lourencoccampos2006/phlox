// lib/apiKey.ts
// Geração e verificação de chaves de API. Segredo é mostrado uma só vez; em BD
// guarda-se SHA-256 hex + prefixo. Web Crypto — Workers-safe.

const SCOPES = [
  'sales:read', 'sales:write',
  'stock:read', 'stock:write',
  'patients:read',
  'webhooks:read',
  // 2026-06-02: FHIR
  'fhir:read', 'fhir:write',
] as const
export type Scope = typeof SCOPES[number]
export const ALL_SCOPES: readonly Scope[] = SCOPES

export interface NewKey { secret: string; prefix: string; hash: string }

// Gera uma nova chave: "pk_live_" + 8 alfanum (prefix) + "." + 32 alfanum (secreto)
export async function newApiKey(): Promise<NewKey> {
  const alpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const rand = (n: number) => {
    const bytes = new Uint8Array(n); crypto.getRandomValues(bytes)
    return Array.from(bytes, b => alpha[b % alpha.length]).join('')
  }
  const prefix = 'pk_live_' + rand(8)
  const tail = rand(32)
  const secret = `${prefix}.${tail}`
  const hash = await sha256hex(secret)
  return { secret, prefix, hash }
}

export async function sha256hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Extrai o prefixo de uma chave apresentada para lookup rápido em BD.
export function prefixOf(secret: string): string | null {
  const m = secret.match(/^(pk_live_[A-Za-z0-9]{8})\./)
  return m ? m[1] : null
}
