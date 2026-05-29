// lib/webhooks.ts
// Eventos e assinatura HMAC dos webhooks de saída (Web Crypto — corre em Workers).

export const WEBHOOK_EVENTS = [
  { id: 'sale.created', label: 'Venda criada', desc: 'Cada venda/ato registado no POS' },
  { id: 'document.issued', label: 'Documento emitido', desc: 'Documento finalizado (nº, ATCUD)' },
  { id: 'stock.low', label: 'Stock baixo', desc: 'Produto atinge o mínimo' },
  { id: 'credit_note.issued', label: 'Nota de crédito', desc: 'Anulação de documento' },
  { id: 'shift.closed', label: 'Fecho de caixa', desc: 'Fecho de caixa diário' },
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]['id']

// HMAC-SHA256 hex de um payload string, com um segredo.
export async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function randomSecret(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return 'whsec_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
}
