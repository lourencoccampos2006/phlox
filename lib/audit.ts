// lib/audit.ts
// Phlox Audit Trail. Hash SHA-256 encadeado por utilizador. Inviolabilidade interna.
// Categorias e ações canónicas — mantém consistência entre quem regista (servidor)
// e quem lê (página /auditoria).

export type AuditCategory = 'clinical' | 'billing' | 'auth' | 'settings' | 'data' | 'integration'

export interface AuditEventInput {
  user_id: string
  action: string
  category?: AuditCategory
  resource?: string
  resource_id?: string
  ip?: string
  user_agent?: string
  detail?: any
}

// Catálogo de ações para a UI (não obrigatório nas inserções)
export const AUDIT_ACTIONS: Record<string, { label: string; category: AuditCategory }> = {
  // auth
  'auth.login':              { label: 'Início de sessão', category: 'auth' },
  'auth.logout':             { label: 'Termo de sessão', category: 'auth' },
  'auth.password_changed':   { label: 'Palavra-passe alterada', category: 'auth' },
  // clinical
  'patient.viewed':          { label: 'Ficha consultada', category: 'clinical' },
  'patient.created':         { label: 'Doente criado', category: 'clinical' },
  'patient.updated':         { label: 'Doente atualizado', category: 'clinical' },
  'patient.deleted':         { label: 'Doente removido', category: 'clinical' },
  'health_pass.opened':      { label: 'Health Pass aberto', category: 'clinical' },
  // billing / sales
  'sale.created':            { label: 'Venda criada', category: 'billing' },
  'sale.finalized':          { label: 'Documento finalizado', category: 'billing' },
  'credit_note.issued':      { label: 'Nota de crédito', category: 'billing' },
  'payment.charged':         { label: 'Pagamento iniciado', category: 'billing' },
  // settings
  'settings.changed':        { label: 'Definições alteradas', category: 'settings' },
  'plan.changed':            { label: 'Plano alterado', category: 'settings' },
  // data
  'data.exported':           { label: 'Dados exportados', category: 'data' },
  'data.imported':           { label: 'Dados importados', category: 'data' },
  // integrations
  'webhook.dispatched':      { label: 'Webhook enviado', category: 'integration' },
  'apikey.created':          { label: 'Chave de API criada', category: 'integration' },
  'apikey.revoked':          { label: 'Chave de API revogada', category: 'integration' },
}

const CATEGORY_LABEL: Record<AuditCategory, string> = {
  clinical: 'Clínico', billing: 'Faturação', auth: 'Autenticação', settings: 'Definições', data: 'Dados', integration: 'Integração',
}
export const categoryLabel = (c: AuditCategory) => CATEGORY_LABEL[c] || c
export const actionLabel = (a: string) => AUDIT_ACTIONS[a]?.label || a

// ── Canonical JSON (ordena chaves) + SHA-256 base64 ─────────────────────────────
function canonical(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']'
  const keys = Object.keys(obj).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}'
}

async function sha256b64(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return typeof btoa !== 'undefined' ? btoa(bin) : Buffer.from(bytes).toString('base64')
}

// Hash de um evento, incluindo o hash do anterior na cadeia.
export async function eventHash(e: {
  user_id: string; at: string; action: string; category?: string | null
  resource?: string | null; resource_id?: string | null; detail?: any; seq: number; prev_hash?: string | null
}): Promise<string> {
  const payload = canonical({
    user_id: e.user_id, at: e.at, action: e.action, category: e.category || 'general',
    resource: e.resource || null, resource_id: e.resource_id || null,
    detail: e.detail ?? {}, seq: e.seq, prev_hash: e.prev_hash || null,
  })
  return sha256b64(payload)
}

// Verifica a integridade da cadeia para um utilizador.
export interface ChainCheckResult { ok: boolean; checked: number; firstBreak?: { seq: number; reason: string } }
export async function verifyChain(events: Array<{ user_id: string; at: string; action: string; category?: string; resource?: string | null; resource_id?: string | null; detail?: any; seq: number; prev_hash?: string | null; event_hash: string }>): Promise<ChainCheckResult> {
  // Ordena por seq ascendente
  const sorted = [...events].sort((a, b) => a.seq - b.seq)
  let prev: string | null = null
  for (const e of sorted) {
    if ((e.prev_hash || null) !== prev) {
      return { ok: false, checked: sorted.indexOf(e), firstBreak: { seq: e.seq, reason: 'prev_hash não corresponde' } }
    }
    const expected = await eventHash({ ...e, at: typeof e.at === 'string' ? e.at : new Date(e.at).toISOString(), prev_hash: prev })
    if (expected !== e.event_hash) {
      return { ok: false, checked: sorted.indexOf(e), firstBreak: { seq: e.seq, reason: 'hash do evento não confere' } }
    }
    prev = e.event_hash
  }
  return { ok: true, checked: sorted.length }
}
