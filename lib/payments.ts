// lib/payments.ts
// Métodos de pagamento. Gera Referências Multibanco com o algoritmo de check-digit
// 991 (norma SIBS) e prepara pedidos MB WAY / gateways. As referências geradas
// localmente são DEMONSTRATIVAS até uma entidade real estar configurada — uma
// entidade Multibanco verdadeira é atribuída pela SIBS ao aderente.

export const PAY_PROVIDERS = [
  { id: 'manual', label: 'Manual / TPA físico', desc: 'Regista o método; o pagamento é feito no terminal físico.', needsKey: false },
  { id: 'mb_referencia', label: 'Referência Multibanco', desc: 'Gera Entidade + Referência + Montante para o utente pagar em MB/homebanking.', needsKey: false, needsEntity: true },
  { id: 'mbway', label: 'MB WAY', desc: 'Pedido de pagamento por número de telemóvel (via gateway).', needsKey: true },
  { id: 'sibs', label: 'SIBS Gateway', desc: 'SIBS Payments (MB, MB WAY, cartão).', needsKey: true, needsEntity: true },
  { id: 'easypay', label: 'Easypay', desc: 'Gateway Easypay (MB, MB WAY, cartão).', needsKey: true },
  { id: 'stripe', label: 'Stripe', desc: 'Cartão internacional.', needsKey: true },
] as const

export type PayProvider = typeof PAY_PROVIDERS[number]['id']

// ── Check digits de Referência Multibanco (algoritmo 991 / mod 97) ─────────────
// entidade(5) + referência(7) + montante em cêntimos(8, zero-padded) → 2 dígitos.
export function mbCheckDigits(entity: string, reference7: string, amountCents: number): string {
  const amount8 = String(Math.round(amountCents)).padStart(8, '0').slice(-8)
  const base = `${entity}${reference7}${amount8}`
  // mod 97 sobre a string numérica (processado em blocos para evitar overflow)
  let rem = 0
  for (const ch of base) rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97
  const cd = 98 - rem
  return String(cd).padStart(2, '0')
}

// Gera uma referência de 9 dígitos (7 sequenciais + 2 check digits) para um montante.
export function makeMBReference(entity: string, seq: number, amountEuros: number): { entity: string; reference: string; amount: string } {
  const ent = (entity || '00000').replace(/\D/g, '').padStart(5, '0').slice(-5)
  const ref7 = String(seq % 10_000_000).padStart(7, '0')
  const cents = Math.round(amountEuros * 100)
  const cd = mbCheckDigits(ent, ref7, cents)
  const full = `${ref7}${cd}` // 9 dígitos
  // formatação visual: 3 grupos de 3
  const pretty = `${full.slice(0, 3)} ${full.slice(3, 6)} ${full.slice(6, 9)}`
  return { entity: ent, reference: pretty, amount: amountEuros.toFixed(2) }
}

export function validPhonePT(phone: string): boolean {
  return /^9[1236]\d{7}$/.test(phone.replace(/\s/g, ''))
}
