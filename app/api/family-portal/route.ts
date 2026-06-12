import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'

// Portal família: acesso por código do residente, validado server-side (service role).
// Sem expor user_id nem outros residentes. Só o fio do residente correspondente ao código.

const HAS_SERVICE_KEY = !!process.env.SUPABASE_SERVICE_ROLE_KEY

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Devolve o residente OU um objeto de erro com causa, para a API dar mensagens claras.
async function resolveCode(code: string): Promise<{ patient: any } | { errorCode: 'short' | 'no_column' | 'not_found' | 'db' }> {
  const c = (code || '').toUpperCase().trim()
  if (!c || c.length < 4) return { errorCode: 'short' }
  const sb = admin()
  const { data, error } = await sb.from('patients').select('id, name, room_number, user_id').eq('family_code', c).maybeSingle()
  if (error) {
    // coluna family_code ainda não existe → a migração não foi corrida
    if (/column .*family_code.* does not exist/i.test(error.message) || error.code === '42703') return { errorCode: 'no_column' }
    return { errorCode: 'db' }
  }
  if (!data) return { errorCode: 'not_found' }
  return { patient: data }
}

function codeErrorResponse(errorCode: string) {
  if (errorCode === 'no_column') return NextResponse.json({ error: 'O portal família ainda não está ativo nesta conta. A instituição precisa de aplicar a configuração da base de dados (SETUP_CLINICO.sql).' }, { status: 503 })
  if (errorCode === 'db') return NextResponse.json({ error: 'Erro de ligação à base de dados. Tente novamente.' }, { status: 500 })
  if (errorCode === 'short') return NextResponse.json({ error: 'Código demasiado curto.' }, { status: 400 })
  return NextResponse.json({ error: 'Código inválido. Confirme com a instituição.' }, { status: 404 })
}

const last4 = (phone?: string | null) => (phone || '').replace(/\D/g, '').slice(-4)

// ── "O dia da mãe" — resumo diário caloroso para a família ───────────────────
// Construído DE FORMA DETERMINÍSTICA a partir dos registos que a equipa já faz
// (care_records por turno + mar_records). NÃO inventa nada, NÃO usa IA, NÃO
// diagnostica: só conta, em linguagem simples, o que ficou registado. Isto é o
// que torna o cuidado visível à família — e o argumento de venda do lar.
interface DaySummary { date: string; lines: string[]; mood?: number; attention: boolean }

const MEAL_WORD = (pct: number) => pct >= 75 ? 'comeu bem' : pct >= 40 ? 'comeu razoavelmente' : pct > 0 ? 'comeu pouco' : 'quase não comeu'
const MOOD_WORD = ['', 'esteve em baixo', 'esteve menos bem-disposta', 'esteve calma', 'esteve bem-disposta', 'esteve muito animada']

function summariseDay(date: string, recs: any[], marToday: any[], firstName: string): DaySummary {
  const lines: string[] = []
  let attention = false
  // Refeições (média do dia a partir dos turnos)
  const meals: number[] = []
  let moodLevel = 0, moodCount = 0
  const activities = new Set<string>()
  let fluid = 0
  for (const r of recs) {
    const n = r.nutrition || {}
    ;['breakfast', 'lunch', 'dinner'].forEach(m => { if (typeof n[m] === 'number') meals.push(n[m]) })
    if (typeof n.fluid_ml === 'number') fluid += n.fluid_ml
    const mo = r.mood || {}
    if (mo.level) { moodLevel += mo.level; moodCount++ }
    if (Array.isArray(mo.activities)) mo.activities.forEach((a: string) => a && activities.add(a))
    else if (typeof mo.activities === 'string' && mo.activities.trim()) activities.add(mo.activities.trim())
  }
  if (meals.length) {
    const avg = Math.round(meals.reduce((a, b) => a + b, 0) / meals.length)
    lines.push(`Às refeições, ${firstName} ${MEAL_WORD(avg)}.`)
    if (avg < 40) attention = true
  }
  if (fluid > 0) lines.push(`Bebeu cerca de ${fluid} ml de líquidos ao longo do dia.`)
  if (moodCount) {
    const m = Math.round(moodLevel / moodCount)
    lines.push(`${MOOD_WORD[m] ? MOOD_WORD[m].charAt(0).toUpperCase() + MOOD_WORD[m].slice(1) : 'Esteve estável'}.`)
    if (m <= 2) attention = true
  }
  if (activities.size) lines.push(`Participou em: ${Array.from(activities).slice(0, 4).join(', ')}.`)
  // Medicação do dia
  const marTaken = marToday.filter(m => m.status === 'taken' || m.status === 'given').length
  const marTotal = marToday.length
  if (marTotal > 0) {
    if (marTaken === marTotal) lines.push('Tomou toda a medicação prevista.')
    else { lines.push(`Tomou ${marTaken} de ${marTotal} medicamentos previstos.`); if (marTaken < marTotal) attention = true }
  }
  // Notas da equipa (uma, curta, se houver)
  const note = recs.map(r => r.notes).find((x: string) => x && x.trim())
  if (note) lines.push(`Nota da equipa: ${String(note).slice(0, 160)}`)
  return { date, lines, mood: moodCount ? Math.round(moodLevel / moodCount) : undefined, attention }
}

async function buildDailySummaries(patientId: string): Promise<DaySummary[]> {
  const sb = admin()
  const days = 3
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const [{ data: cr }, { data: mar }, { data: pat }] = await Promise.all([
    sb.from('care_records').select('date, nutrition, mood, notes').eq('patient_id', patientId).gte('date', since),
    sb.from('mar_records').select('date, status').eq('patient_id', patientId).gte('date', since),
    sb.from('patients').select('name').eq('id', patientId).maybeSingle(),
  ])
  const firstName = (pat?.name || 'O residente').split(' ')[0]
  const out: DaySummary[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const recs = (cr || []).filter((r: any) => r.date === d)
    const marDay = (mar || []).filter((m: any) => m.date === d)
    if (!recs.length && !marDay.length) continue // sem registos nesse dia → não mostra
    out.push(summariseDay(d, recs, marDay, firstName))
  }
  return out
}

// Verifica os últimos 4 dígitos do telemóvel contra os contactos registados do residente.
// Devolve o contacto correspondente, ou null.
//
// SEGURANÇA: antes, se o residente não tivesse telefones registados, o portal
// abria só com o código (fail-open) — qualquer pessoa que adivinhasse/obtivesse
// o código via dados clínicos. Agora, sem contactos verificáveis, NÃO abrimos:
// devolvemos `noContacts` para que o portal peça à instituição que registe o
// contacto da família. Verificação em 2 fatores: código + últimos 4 dígitos.
async function verifyFamily(patientId: string, digits: string): Promise<{ ok: boolean; gated: boolean; noContacts?: boolean; contact?: any }> {
  const sb = admin()
  const { data: contacts } = await sb.from('resident_contacts').select('id, name, phone').eq('patient_id', patientId)
  const withPhone = (contacts || []).filter((c: any) => last4(c.phone).length === 4)
  if (withPhone.length === 0) return { ok: false, gated: true, noContacts: true } // fechado por defeito
  const d = (digits || '').replace(/\D/g, '').slice(-4)
  const match = withPhone.find((c: any) => last4(c.phone) === d)
  return { ok: !!match, gated: true, contact: match }
}

export async function GET(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 60, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  // Diagnóstico (?diag=1): mostra se o portal está bem configurado, sem expor dados.
  if (req.nextUrl.searchParams.get('diag') === '1') {
    const sb = admin()
    const { error } = await sb.from('patients').select('family_code').limit(1)
    const columnOk = !error
    return NextResponse.json({
      serviceRoleKey: HAS_SERVICE_KEY,
      familyCodeColumn: columnOk,
      detail: error?.message || null,
      ready: HAS_SERVICE_KEY && columnOk,
    })
  }

  const code = req.nextUrl.searchParams.get('code') || ''
  const verify = req.nextUrl.searchParams.get('verify') || ''
  const r = await resolveCode(code)
  if ('errorCode' in r) return codeErrorResponse(r.errorCode)
  const pat = r.patient

  const v = await verifyFamily(pat.id, verify)
  if (v.noContacts) {
    // Sem contacto registado não há como verificar a identidade → portal fechado.
    return NextResponse.json({ needsVerify: true, noContacts: true, patientName: pat.name, error: 'Por segurança, peça à instituição para registar o seu contacto telefónico antes de aceder.' }, { status: 200 })
  }
  if (v.gated && !v.ok) {
    // código válido mas falta (ou está errada) a verificação por telemóvel
    return NextResponse.json({ needsVerify: true, patientName: pat.name, error: verify ? 'Os dígitos não correspondem ao contacto registado.' : '' }, { status: 200 })
  }

  const sb = admin()
  const [{ data: msgs }, dailySummaries] = await Promise.all([
    sb.from('family_thread_messages')
      .select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at')
      .eq('patient_id', pat.id).order('created_at', { ascending: true }).limit(200),
    buildDailySummaries(pat.id).catch(() => [] as DaySummary[]),
  ])

  return NextResponse.json({
    patient: { name: pat.name, room_number: pat.room_number },
    contactName: v.contact?.name || null,
    messages: msgs || [],
    dailySummaries,
  })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 30, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.code) return NextResponse.json({ error: 'Código em falta' }, { status: 400 })
  const content = String(body.content || '').trim()
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64 : ''
  if (!content && !imageBase64) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

  const r = await resolveCode(body.code)
  if ('errorCode' in r) return codeErrorResponse(r.errorCode)
  const pat = r.patient

  const v = await verifyFamily(pat.id, String(body.verify || ''))
  if (v.gated && !v.ok) return NextResponse.json({ error: 'Verificação necessária' }, { status: 403 })

  const sb = admin()

  // Upload de foto (opcional) — limite ~4MB de base64
  let photo_url: string | null = null
  if (imageBase64 && imageBase64.length < 5_500_000) {
    try {
      const buf = Buffer.from(imageBase64, 'base64')
      const path = `${pat.user_id}/${pat.id}/fam-${Date.now()}.jpg`
      const up = await sb.storage.from('family').upload(path, buf, { contentType: 'image/jpeg', upsert: false })
      if (!up.error) photo_url = sb.storage.from('family').getPublicUrl(path).data.publicUrl
    } catch { /* segue sem foto */ }
  }

  const { data, error } = await sb.from('family_thread_messages').insert({
    user_id: pat.user_id,
    patient_id: pat.id,
    author_side: 'family',
    contact_id: v.contact?.id || null,
    author_name: v.contact?.name || String(body.name || '').trim().slice(0, 60) || 'Família',
    kind: photo_url ? 'photo' : 'message',
    content: content.slice(0, 2000) || null,
    photo_url,
    read_by_family: true,
    read_by_staff: false,
  }).select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at').single()

  if (error) return NextResponse.json({ error: 'Não foi possível enviar' }, { status: 500 })
  return NextResponse.json({ message: data })
}
