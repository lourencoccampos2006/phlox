// lib/signDoc.ts
// Assinatura HMAC-SHA256 de documentos canónicos. Chave secreta SOMENTE no servidor
// (PHLOX_SIGN_SECRET). A verificação é feita pelo servidor — o público nunca toca
// na chave. Mecanismo determinístico e auditável.

export interface SignedDocPayload {
  id: string
  user_id: string
  kind: string
  title: string
  data: Record<string, unknown>
  signed_at: string
}

// JSON canónico (chaves ordenadas) — garante que a mesma estrutura gera a mesma
// assinatura independentemente da ordem das chaves.
export function canonical(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}'
}

export async function signHmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Compara em tempo constante — proteção básica contra timing attacks.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}
