// lib/auditServer.ts
// Inserção server-side de eventos no Audit Trail, com cadeia SHA-256 atómica por
// utilizador (lock via RPC next_audit_seq). Falha graciosamente.

import { createClient } from '@supabase/supabase-js'
import { eventHash, type AuditEventInput } from './audit'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

export async function recordAudit(e: AuditEventInput): Promise<{ ok: boolean; id?: string; seq?: number; error?: string }> {
  try {
    const sb = adminClient()
    // 1) seq atómico
    const rpc = await sb.rpc('next_audit_seq', { p_user: e.user_id })
    if (rpc.error) return { ok: false, error: rpc.error.message }
    const seq = Number(rpc.data)

    // 2) hash do anterior
    const { data: prev } = await sb.from('audit_events').select('event_hash').eq('user_id', e.user_id).order('seq', { ascending: false }).limit(1).maybeSingle()
    const prev_hash = prev?.event_hash || null

    const at = new Date().toISOString()
    const row = {
      user_id: e.user_id, at, action: e.action, category: e.category || 'general',
      resource: e.resource || null, resource_id: e.resource_id || null,
      ip: e.ip || null, user_agent: e.user_agent || null,
      detail: e.detail || {}, seq, prev_hash,
    }
    const event_hash = await eventHash({ ...row })

    const { data, error } = await sb.from('audit_events').insert({ ...row, event_hash }).select('id').single()
    if (error) return { ok: false, error: error.message }
    return { ok: true, id: data!.id, seq }
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err).slice(0, 200) }
  }
}
