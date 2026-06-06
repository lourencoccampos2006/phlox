import { NextRequest, NextResponse } from 'next/server'
import { getUserPlan } from '@/lib/planGate'
import { createClient } from '@supabase/supabase-js'
import { randomInt } from 'crypto'

// Lado AUTENTICADO do Health Pass (doente): criar/revogar sessão, listar visitas e devoluções.

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } })
}
// Tokens/PIN com CSPRNG (crypto) — não Math.random (previsível) por guardarem dados clínicos.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
const randToken = () => Array.from({ length: 22 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
const randPin = () => String(randomInt(1000, 10000))
const NO_TABLE = (m: string) => /relation .*health_(pass|visits).* does not exist/i.test(m)

// GET → sessão ativa + visitas + devoluções pendentes
export async function GET(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const profileId = req.nextUrl.searchParams.get('profile_id')
  const byP = <T,>(q: any) => profileId ? q.eq('profile_id', profileId) : q.is('profile_id', null)

  const [sess, visits, returns] = await Promise.all([
    db.from('health_pass_sessions').select('*').eq('user_id', userId).eq('revoked', false).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1),
    byP(db.from('health_visits').select('*').eq('user_id', userId).order('at', { ascending: false }).limit(30)),
    db.from('health_pass_returns').select('*').eq('user_id', userId).eq('applied', false).order('created_at', { ascending: false }),
  ])
  if (sess.error && NO_TABLE(sess.error.message)) return NextResponse.json({ error: 'Health Pass não está ativo (aplicar sprint29_healthpass.sql).' }, { status: 503 })
  const active = (sess.data || []).find((s: any) => (profileId ? s.profile_id === profileId : !s.profile_id)) || null
  return NextResponse.json({ session: active, visits: visits.data || [], returns: returns.data || [] })
}

// POST → criar sessão de partilha
export async function POST(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const body = await req.json().catch(() => null)
  const sections: string[] = Array.isArray(body?.sections) ? body.sections.filter((s: string) => ['meds', 'conditions', 'allergies', 'symptoms', 'vitals', 'visits'].includes(s)) : []
  const minutes = Math.min(120, Math.max(5, parseInt(String(body?.minutes || 15)) || 15))
  const record = {
    user_id: userId, profile_id: body?.profile_id || null,
    token: randToken(), pin: randPin(), sections,
    expires_at: new Date(Date.now() + minutes * 60000).toISOString(),
  }
  const { data, error } = await db.from('health_pass_sessions').insert(record).select().single()
  if (error) return NextResponse.json({ error: NO_TABLE(error.message) ? 'Health Pass não está ativo (aplicar sprint29_healthpass.sql).' : error.message }, { status: NO_TABLE(error.message) ? 503 : 500 })
  return NextResponse.json(data)
}

// PATCH → revogar sessão OU aplicar/dispensar uma devolução
export async function PATCH(req: NextRequest) {
  const { userId } = await getUserPlan(req)
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const db = sb(req)
  const body = await req.json().catch(() => null)
  if (body?.revoke) { await db.from('health_pass_sessions').update({ revoked: true }).eq('id', body.revoke).eq('user_id', userId); return NextResponse.json({ ok: true }) }
  if (body?.dismissReturn) { await db.from('health_pass_returns').update({ applied: true }).eq('id', body.dismissReturn).eq('user_id', userId); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
