// lib/fhirAuth.ts
// Resolve credenciais para endpoints FHIR. Aceita 3 modos:
//   1. Bearer <Supabase JWT> — utilizador autenticado (RLS aplica)
//   2. Bearer <API key>      — chave servidor com scope 'fhir:read'/'fhir:write'
//   3. ?token=<webhook>      — só para POST /api/lab/webhook/<token>
//
// Retorna o cliente Supabase apropriado (anon-key + JWT OU service-role).

import { NextRequest } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { prefixOf, sha256hex } from '@/lib/apiKey'

export interface FhirAuthResult {
  ok: boolean
  mode?: 'user' | 'api_key' | 'webhook'
  user_id?: string
  org_id?: string | null
  scopes?: string[]
  client?: SupabaseClient
  error?: string
  status?: number
}

function anonClient(jwt?: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    jwt ? { global: { headers: { Authorization: `Bearer ${jwt}` } } } : {}
  )
}

function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// ─── Controlo de acesso por doente (anti-IDOR) ────────────────────────────────
// No modo API-key usamos a service-role key (RLS desligado). Por isso, ANTES de
// ler/escrever dados de um doente, temos de confirmar que esse doente pertence ao
// dono da chave (user_id/org_id). Sem isto, qualquer chave acederia a qualquer
// doente de qualquer clínica. No modo JWT a RLS já protege, mas validar aqui
// também é inócuo e mantém o comportamento uniforme.
//
// Retorna o conjunto de identificadores que o chamador PODE aceder para um dado
// `patientRef` (que pode ser o id da tabela `patients`, o seu fhir_id, ou — em
// contas pessoais — o próprio user_id). Se não pertencer ao dono, devolve null.
export async function resolveOwnedPatient(
  auth: FhirAuthResult,
  patientRef: string
): Promise<{ patientId: string; userId: string } | null> {
  if (!auth.ok || !auth.client || !auth.user_id) return null
  const ref = patientRef.replace(/^Patient\//, '')
  const db = auth.client

  // 1) Doente da tabela `patients` que pertence ao dono da chave (por user_id
  //    e, se houver, org_id).
  let q = db.from('patients').select('id, user_id, fhir_id').or(`id.eq.${ref},fhir_id.eq.${ref}`)
  q = q.eq('user_id', auth.user_id)
  const { data: pat } = await q.maybeSingle()
  if (pat) return { patientId: pat.id, userId: pat.user_id }

  // 2) Conta pessoal: o "doente" é o próprio utilizador da chave.
  if (ref === auth.user_id) return { patientId: ref, userId: ref }

  // Não pertence ao dono da chave → acesso negado.
  return null
}

export async function authFhir(req: NextRequest, requireScope: 'read' | 'write' = 'read'): Promise<FhirAuthResult> {
  const auth = req.headers.get('authorization') || ''

  // ── Bearer ───────────────────────────────────────────────────────────────
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (bearer) {
    // É API key?
    if (bearer.startsWith('pk_live_') && bearer.includes('.')) {
      const prefix = prefixOf(bearer)
      if (!prefix) return { ok: false, error: 'Invalid API key', status: 401 }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false, error: 'Server not configured', status: 503 }
      const db = adminClient()
      const hash = await sha256hex(bearer)
      const { data: key } = await db.from('api_keys').select('*').eq('hash', hash).eq('active', true).maybeSingle()
      if (!key) return { ok: false, error: 'Invalid or revoked API key', status: 401 }
      const scopes: string[] = key.scopes || []
      const need = `fhir:${requireScope}`
      if (!scopes.includes(need)) return { ok: false, error: `Missing scope ${need}`, status: 403 }
      // Toca last_used
      await db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id)
      return { ok: true, mode: 'api_key', user_id: key.user_id, org_id: key.org_id, scopes, client: db }
    }

    // JWT Supabase
    const db = anonClient(bearer)
    const { data: { user } } = await db.auth.getUser()
    if (!user) return { ok: false, error: 'Invalid JWT', status: 401 }
    // Lê org ativa via header opcional
    const orgHdr = req.headers.get('x-org-id')
    return { ok: true, mode: 'user', user_id: user.id, org_id: orgHdr || null, client: db }
  }

  return { ok: false, error: 'Missing Authorization header', status: 401 }
}
