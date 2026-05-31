// lib/apiAuth.ts
// Autenticação por chave de API + scopes + rate limit por chave.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { prefixOf, sha256hex, type Scope } from './apiKey'
import { checkRateLimit } from './rateLimit'

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export interface ApiAuthOK { ok: true; userId: string; keyId: string; scopes: string[] }
export interface ApiAuthFail { ok: false; response: NextResponse }
export type ApiAuthResult = ApiAuthOK | ApiAuthFail

export async function authApiKey(req: NextRequest, required?: Scope): Promise<ApiAuthResult> {
  const auth = req.headers.get('authorization') || ''
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : (req.headers.get('x-api-key') || '').trim()
  if (!key) return { ok: false, response: NextResponse.json({ error: 'Missing API key' }, { status: 401 }) }

  const prefix = prefixOf(key)
  if (!prefix) return { ok: false, response: NextResponse.json({ error: 'Malformed key' }, { status: 401 }) }

  const sb = adminClient()
  const { data } = await sb.from('api_keys').select('id,user_id,hash,scopes,active,expires_at').eq('prefix', prefix).maybeSingle()
  if (!data || !data.active) return { ok: false, response: NextResponse.json({ error: 'Invalid key' }, { status: 401 }) }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return { ok: false, response: NextResponse.json({ error: 'Key expired' }, { status: 401 }) }

  const hash = await sha256hex(key)
  if (hash !== data.hash) return { ok: false, response: NextResponse.json({ error: 'Invalid key' }, { status: 401 }) }

  if (required && !(data.scopes || []).includes(required)) {
    return { ok: false, response: NextResponse.json({ error: `Missing scope: ${required}` }, { status: 403 }) }
  }

  // Rate limit por chave (60 req/min)
  const rl = checkRateLimit(`apikey:${data.id}`, 60, 60_000)
  if (!rl.allowed) return { ok: false, response: NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 }) }

  // Atualiza last_used_at e regista uso (fire-and-forget)
  const now = new Date().toISOString()
  sb.from('api_keys').update({ last_used_at: now }).eq('id', data.id).then(() => {}, () => {})

  return { ok: true, userId: data.user_id, keyId: data.id, scopes: data.scopes || [] }
}

export async function logApiUsage(keyId: string, userId: string, path: string, method: string, status: number, ms: number) {
  try {
    const sb = adminClient()
    await sb.from('api_usage').insert({ key_id: keyId, user_id: userId, path, method, status, ms })
  } catch { /* silent */ }
}
