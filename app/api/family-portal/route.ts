import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIP, rateLimitResponse } from '@/lib/rateLimit'
import { admin, resolveCode, codeErrorResponse as codeErrorInfo, verifyFamily, HAS_SERVICE_KEY } from '@/lib/familyPortal'

// Portal família: acesso por código do residente, validado server-side (service role).
// Sem expor user_id nem outros residentes. Só o fio do residente correspondente ao código.
// resolveCode/verifyFamily vivem em lib/familyPortal.ts (partilhado com
// /api/family-link, a ligação institucional persistida usada por /familia).

function codeErrorResponse(errorCode: string) {
  const { error, status } = codeErrorInfo(errorCode)
  if (errorCode === 'no_column') console.error('[phlox:family-portal] family_code column missing')
  return NextResponse.json({ error }, { status })
}

// ── "O dia da mãe" — resumo diário caloroso para a família ───────────────────
// Construído DE FORMA DETERMINÍSTICA a partir dos registos que a equipa já faz
// (care_records por turno + mar_records). NÃO inventa nada, NÃO usa IA, NÃO
// diagnostica: só conta, em linguagem simples, o que ficou registado. Isto é o
// que torna o cuidado visível à família — e o argumento de venda do lar.
interface DaySummary { date: string; lines: string[]; mood?: number; attention: boolean; photoUrl?: string | null }

const MEAL_WORD = (pct: number) => pct >= 75 ? 'comeu bem' : pct >= 40 ? 'comeu razoavelmente' : pct > 0 ? 'comeu pouco' : 'quase não comeu'
const MOOD_WORD = ['', 'esteve em baixo', 'esteve menos bem-disposta', 'esteve calma', 'esteve bem-disposta', 'esteve muito animada']

function summariseDay(date: string, recs: any[], marToday: any[], firstName: string, isToday: boolean): DaySummary {
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
  // Medicação do dia. /mar grava 'administered' (também aceitamos given/taken).
  // Antes só contava taken/given → família via "Tomou 0 de 2" tendo tomado.
  const GIVEN = new Set(['administered', 'given', 'taken'])
  const marTaken = marToday.filter(m => GIVEN.has(m.status)).length
  const marTotal = marToday.length
  if (marTotal > 0) {
    if (marTaken === marTotal) lines.push('Tomou toda a medicação prevista.')
    else if (isToday) {
      // O dia ainda decorre — mostramos progresso, sem alarme (a medicação da
      // tarde/noite pode simplesmente ainda não ter sido dada).
      lines.push(`Já tomou ${marTaken} de ${marTotal} medicamentos até agora.`)
    } else {
      lines.push(`Tomou ${marTaken} de ${marTotal} medicamentos previstos.`)
      attention = true
    }
  }
  // Notas da equipa (uma, curta, se houver)
  const note = recs.map(r => r.notes).find((x: string) => x && x.trim())
  if (note) lines.push(`Nota da equipa: ${String(note).slice(0, 160)}`)
  return { date, lines, mood: moodCount ? Math.round(moodLevel / moodCount) : undefined, attention }
}

// 30 dias em vez de 3 — dá o "diário do utente" navegável dia a dia (a família
// abre e percorre para trás, em vez de só ver os últimos 3 dias empilhados).
async function buildDailySummaries(patientId: string, days = 30): Promise<DaySummary[]> {
  const sb = admin()
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const [{ data: cr }, { data: mar }, { data: pat }] = await Promise.all([
    sb.from('care_records').select('date, nutrition, mood, notes').eq('patient_id', patientId).gte('date', since),
    sb.from('mar_records').select('date, status').eq('patient_id', patientId).gte('date', since),
    sb.from('patients').select('name').eq('id', patientId).maybeSingle(),
  ])
  const firstName = (pat?.name || 'O residente').split(' ')[0]
  const todayStr = new Date().toISOString().slice(0, 10)
  const out: DaySummary[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    const recs = (cr || []).filter((r: any) => r.date === d)
    const marDay = (mar || []).filter((m: any) => m.date === d)
    if (!recs.length && !marDay.length) continue // sem registos nesse dia → não mostra
    out.push(summariseDay(d, recs, marDay, firstName, d === todayStr))
  }
  return out
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
  const today = new Date().toISOString().slice(0, 10)
  const [{ data: msgs }, dailySummaries, homeMeds, todayDoses, visitRequests] = await Promise.all([
    sb.from('family_thread_messages')
      .select('id, patient_id, author_side, author_name, kind, content, photo_url, mood, meals, activity, created_at')
      .eq('patient_id', pat.id).order('created_at', { ascending: true }).limit(200),
    buildDailySummaries(pat.id).catch(() => [] as DaySummary[]),
    // medicação que a família dá em casa (take_location casa/ambos) — tolerante se a coluna não existir
    sb.from('patient_meds').select('id, name, dose, frequency, take_location').eq('patient_id', pat.id).eq('active', true).then(
      (r: any) => r.error ? [] : (r.data || []).filter((m: any) => m.take_location === 'casa' || m.take_location === 'ambos'),
      () => []
    ),
    // tomas de hoje (para mostrar o que já foi dado, em casa e no centro)
    sb.from('mar_records').select('med_id, status, source, home_by, recorded_at, shift').eq('patient_id', pat.id).eq('date', today).then(
      (r: any) => r.error ? [] : (r.data || []),
      () => []
    ),
    // pedidos de visita desta família — para a família VER os que pediu e o estado
    // (bug reportado: a visita marcada não aparecia de volta). Futuras + recentes.
    sb.from('visit_requests').select('id, requested_date, requested_time, status, notes, created_at')
      .eq('patient_id', pat.id).order('requested_date', { ascending: false }).limit(20).then(
        (r: any) => r.error ? [] : (r.data || []),
        () => []
      ),
  ])

  // "Foto do dia": a primeira foto que a equipa partilhou nesse dia, para o
  // diário do utente mostrar algo visual, não só texto (quando existir).
  const photoByDate = new Map<string, string>()
  for (const m of (msgs || [])) {
    if (m.photo_url) {
      const d = String(m.created_at).slice(0, 10)
      if (!photoByDate.has(d)) photoByDate.set(d, m.photo_url)
    }
  }
  const dailySummariesWithPhoto = dailySummaries.map(d => ({ ...d, photoUrl: photoByDate.get(d.date) || null }))

  // Tipo de instituição — para o portal se apresentar com a identidade do centro
  // (nome do produto + acento certos), em vez de uma cor genérica. Só o tipo; o
  // nome/acento derivam do blueprint no cliente.
  let institutionKind: string | null = null
  if (pat.org_id) {
    const { data: org } = await sb.from('organizations').select('kind').eq('id', pat.org_id).maybeSingle()
    institutionKind = org?.kind || null
  }

  return NextResponse.json({
    patient: { name: pat.name, room_number: pat.room_number },
    contactName: v.contact?.name || null,
    institutionKind,
    messages: msgs || [],
    dailySummaries: dailySummariesWithPhoto,
    homeMeds: homeMeds || [],
    todayDoses: todayDoses || [],
    visitRequests: visitRequests || [],
  })
}

export async function POST(req: NextRequest) {
  const ip = getIP(req)
  const rl = checkRateLimit(ip, 30, 60_000)
  if (!rl.allowed) return rateLimitResponse()

  const body = await req.json().catch(() => null)
  if (!body?.code) return NextResponse.json({ error: 'Código em falta' }, { status: 400 })

  // ── Ação: marcar uma toma DADA EM CASA pela família ──────────────────────────
  // Escreve um mar_records com source='home'. Aparece no /mar e no painel da
  // instituição (org-scoped) e na ficha do utente — a ponte casa→centro.
  if (body.action === 'mark_dose') {
    const r0 = await resolveCode(body.code)
    if ('errorCode' in r0) return codeErrorResponse(r0.errorCode)
    const pat0 = r0.patient
    const v0 = await verifyFamily(pat0.id, String(body.verify || ''))
    if (v0.gated && !v0.ok) return NextResponse.json({ error: 'Verificação necessária' }, { status: 403 })
    const medId = String(body.medId || '')
    if (!medId) return NextResponse.json({ error: 'Medicamento em falta' }, { status: 400 })
    const sb0 = admin()
    // confirma que o medicamento é mesmo deste utente e é de casa
    const { data: med } = await sb0.from('patient_meds').select('id, name, take_location').eq('id', medId).eq('patient_id', pat0.id).maybeSingle()
    if (!med) return NextResponse.json({ error: 'Medicamento não encontrado' }, { status: 404 })
    const date = new Date().toISOString().slice(0, 10)
    const who = (v0.contact?.name || String(body.name || '').trim() || 'Família').slice(0, 60)
    // O turno tem de ser um que a INSTITUIÇÃO use: um centro de dia só mostra
    // manhã/tarde no /mar, por isso uma toma gravada como "noite" ficaria
    // invisível à equipa (e a ponte casa→centro perdia-se). Sem turnos → tarde.
    const shift = await (async () => {
      const h = new Date().getHours()
      const raw = h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'
      if (raw !== 'noite' || !pat0.org_id) return raw
      const { data: org } = await sb0.from('organizations').select('kind').eq('id', pat0.org_id).maybeSingle()
      return org?.kind === 'day_care' ? 'tarde' : 'noite'
    })()
    const row: any = {
      user_id: pat0.user_id, patient_id: pat0.id, med_id: medId,
      date, shift, status: 'administered', source: 'home', home_by: who,
      recorded_by: `${who} (casa)`, recorded_at: new Date().toISOString(),
    }
    if (pat0.org_id) row.org_id = pat0.org_id
    // evita duplicar a mesma toma (mesmo med, mesmo turno, mesmo dia)
    const { data: existing } = await sb0.from('mar_records').select('id').eq('med_id', medId).eq('date', date).eq('shift', shift).eq('source', 'home').maybeSingle()
    if (existing) { await sb0.from('mar_records').delete().eq('id', existing.id); return NextResponse.json({ ok: true, toggled: 'off' }) }
    const { error } = await sb0.from('mar_records').insert(row)
    if (error) return NextResponse.json({ error: 'Não foi possível marcar a toma.' }, { status: 500 })
    return NextResponse.json({ ok: true, toggled: 'on', medName: med.name })
  }

  // ── Ação: família SUGERE um medicamento que dá em casa ───────────────────────
  // Cria um patient_meds com take_location='casa'. Aparece na ficha do utente e a
  // equipa confirma. É a ponte família→instituição da medicação de casa.
  if (body.action === 'suggest_med') {
    const r1 = await resolveCode(body.code)
    if ('errorCode' in r1) return codeErrorResponse(r1.errorCode)
    const pat1 = r1.patient
    const v1 = await verifyFamily(pat1.id, String(body.verify || ''))
    if (v1.gated && !v1.ok) return NextResponse.json({ error: 'Verificação necessária' }, { status: 403 })
    const medName = String(body.medName || '').trim().slice(0, 80)
    if (!medName) return NextResponse.json({ error: 'Indique o medicamento.' }, { status: 400 })
    const sb1 = admin()
    const row: any = {
      user_id: pat1.user_id, patient_id: pat1.id, name: medName,
      dose: String(body.dose || '').trim().slice(0, 40) || null,
      frequency: String(body.frequency || '').trim().slice(0, 40) || null,
      take_location: 'casa', active: true,
      indication: 'Sugerido pela família — confirmar',
    }
    if (pat1.org_id) row.org_id = pat1.org_id
    const { error } = await sb1.from('patient_meds').insert(row)
    if (error) return NextResponse.json({ error: 'Não foi possível guardar.' }, { status: 500 })
    return NextResponse.json({ ok: true, medName })
  }

  // ── Ação: família PEDE uma visita ────────────────────────────────────────────
  // Escreve um visit_requests. Aparece na aba "Visitas" do /family da instituição,
  // onde a equipa aprova/recusa. É a ponte família→instituição das visitas.
  if (body.action === 'request_visit') {
    const r2 = await resolveCode(body.code)
    if ('errorCode' in r2) return codeErrorResponse(r2.errorCode)
    const pat2 = r2.patient
    const v2 = await verifyFamily(pat2.id, String(body.verify || ''))
    if (v2.gated && !v2.ok) return NextResponse.json({ error: 'Verificação necessária' }, { status: 403 })
    const date = String(body.date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Indique a data.' }, { status: 400 })
    const sb2 = admin()
    const who = (v2.contact?.name || String(body.name || '').trim() || 'Família').slice(0, 60)
    // A tabela visit_requests (sprint12) NÃO tem coluna requested_by — o nome de
    // quem pede vem do contact_id → resident_contacts (é assim que o /family o
    // mostra). Quando a família não está ligada a um contacto (v2.contact nulo),
    // metemos o nome na nota para não se perder.
    const noteBase = String(body.notes || '').trim()
    const notes = (v2.contact?.id ? noteBase : [`Pedido por: ${who}`, noteBase].filter(Boolean).join(' — ')).slice(0, 300) || null
    const row: any = {
      user_id: pat2.user_id, patient_id: pat2.id,
      contact_id: v2.contact?.id || null,
      requested_date: date,
      // coluna é NOT NULL na BD original; string vazia satisfaz sem precisar da
      // migração (sprint99) e não parte o pedido quando a família não escolhe hora.
      requested_time: String(body.time || '').slice(0, 5),
      notes,
      status: 'pending',
    }
    if (pat2.org_id) row.org_id = pat2.org_id
    const { error } = await sb2.from('visit_requests').insert(row)
    if (error) {
      console.error('[phlox:family-portal] request_visit insert falhou:', error.message)
      return NextResponse.json({ error: 'Não foi possível pedir a visita agora. Tente novamente mais tarde.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Limite de tamanho — evita mensagens gigantes (abuso de armazenamento). Uma
  // mensagem à equipa nunca precisa de mais do que isto.
  const content = String(body.content || '').trim().slice(0, 4000)
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
