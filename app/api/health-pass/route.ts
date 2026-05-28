import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Phlox Health Pass — lado PÚBLICO (profissional, sem conta).
// GET  ?token&pin  → resumo clínico das secções partilhadas (valida PIN + expiração)
// POST {token,pin,kind,payload,from} → profissional devolve medicação/consulta/nota ao doente

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}
const NO_TABLE = (m: string) => /relation .*health_pass_sessions.* does not exist/i.test(m)

async function resolveSession(token: string, pin: string) {
  const sb = admin()
  const { data, error } = await sb.from('health_pass_sessions').select('*').eq('token', token).maybeSingle()
  if (error) return { err: NO_TABLE(error.message) ? 'no_table' : 'db' }
  if (!data) return { err: 'not_found' }
  if (data.revoked) return { err: 'revoked' }
  if (new Date(data.expires_at).getTime() < Date.now()) return { err: 'expired' }
  if (String(pin).trim() !== String(data.pin)) return { err: 'pin' }
  return { session: data }
}

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 30, 60_000).allowed) return rateLimitResponse()
  const token = req.nextUrl.searchParams.get('token') || ''
  const pin = req.nextUrl.searchParams.get('pin') || ''
  if (!token) return NextResponse.json({ error: 'Token em falta' }, { status: 400 })

  const sb = admin()
  // Sem PIN → indica que precisa de PIN (e se a sessão existe/está válida)
  const { data: meta, error: mErr } = await sb.from('health_pass_sessions').select('expires_at,revoked').eq('token', token).maybeSingle()
  if (mErr && NO_TABLE(mErr.message)) return NextResponse.json({ error: 'Health Pass não está ativo nesta conta (aplicar sprint29_healthpass.sql).' }, { status: 503 })
  if (!meta) return NextResponse.json({ error: 'Sessão inválida ou inexistente.' }, { status: 404 })
  if (meta.revoked || new Date(meta.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Esta partilha expirou ou foi terminada pelo doente.' }, { status: 410 })
  if (!pin) return NextResponse.json({ needsPin: true }, { status: 200 })

  const r = await resolveSession(token, pin)
  if ('err' in r) {
    const map: any = { pin: ['PIN incorreto.', 401], expired: ['Partilha expirada.', 410], revoked: ['Partilha terminada.', 410], not_found: ['Sessão inválida.', 404], no_table: ['Health Pass não ativo.', 503], db: ['Erro de ligação.', 500] }
    const [msg, code] = map[String(r.err)] || ['Erro', 500]
    return NextResponse.json({ error: msg }, { status: code })
  }
  const s = r.session
  const uid = s.user_id, pid = s.profile_id
  const sect: string[] = s.sections || []
  const byProfile = <T,>(q: any) => pid ? q.eq('profile_id', pid) : q.eq('user_id', uid).is('profile_id', null)

  // Identificação base (do cartão de emergência, se existir)
  const out: any = { profile: {}, sections: sect, sessionId: s.id }
  const { data: card } = await sb.from('emergency_tokens').select('name,blood_type,allergies,emergency_contact').eq('user_id', uid).maybeSingle()
  out.profile = { name: card?.name || 'Doente', blood_type: card?.blood_type || null, emergency_contact: card?.emergency_contact || null }
  if (sect.includes('allergies')) out.allergies = card?.allergies || null

  if (sect.includes('meds')) {
    const tbl = pid ? 'family_profile_meds' : 'personal_meds'
    const { data } = pid
      ? await sb.from('family_profile_meds').select('name,dose,frequency,indication').eq('profile_id', pid)
      : await sb.from('personal_meds').select('name,dose,frequency,indication').eq('user_id', uid)
    out.meds = data || []
  }
  if (sect.includes('symptoms')) {
    const { data } = await byProfile(sb.from('symptom_logs').select('at,feeling,symptoms,pain,temperature,notes').order('at', { ascending: false }).limit(8))
    out.symptoms = data || []
  }
  if (sect.includes('vitals')) {
    const { data } = await byProfile(sb.from('vitals').select('recorded_at,hr,bp_sys,bp_dia,spo2,temp,glucose,weight').order('recorded_at', { ascending: false }).limit(6))
    out.vitals = data || []
  }
  if (sect.includes('visits')) {
    const { data } = await byProfile(sb.from('health_visits').select('at,professional_name,institution,institution_type,reason').order('at', { ascending: false }).limit(12))
    out.visits = data || []
  }

  await sb.from('health_pass_sessions').update({ opened_count: (s.opened_count || 0) + 1 }).eq('id', s.id)
  return NextResponse.json(out)
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  if (!checkRateLimit(ip, 15, 60_000).allowed) return rateLimitResponse()
  const body = await req.json().catch(() => null)
  if (!body?.token) return NextResponse.json({ error: 'Token em falta' }, { status: 400 })

  const r = await resolveSession(body.token, body.pin || '')
  if ('err' in r) return NextResponse.json({ error: 'Sessão inválida ou PIN incorreto.' }, { status: 401 })
  const s = r.session
  const kind = String(body.kind || '')
  if (!['medication', 'appointment', 'note', 'visit'].includes(kind)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  const sb = admin()

  // 'visit' = registar a ida (vantagem dual). Outras = devolução pendente de aceitação.
  if (kind === 'visit') {
    await sb.from('health_visits').insert({
      user_id: s.user_id, profile_id: s.profile_id, source: 'healthpass',
      professional_name: String(body.from || '').slice(0, 80) || null,
      professional_role: String(body.role || '').slice(0, 60) || null,
      institution: String(body.institution || '').slice(0, 80) || null,
      institution_type: String(body.institution_type || '').slice(0, 40) || null,
      reason: String(body.reason || '').slice(0, 200) || null,
      notes: String(body.note || '').slice(0, 600) || null,
    })
    return NextResponse.json({ ok: true })
  }

  await sb.from('health_pass_returns').insert({
    session_id: s.id, user_id: s.user_id, profile_id: s.profile_id, kind,
    payload: body.payload || {}, from_professional: String(body.from || '').slice(0, 80) || null,
  })
  return NextResponse.json({ ok: true })
}
