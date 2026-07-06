// app/api/rounds/route.ts
// Rondas coordenadas (multi-funcionário) — ver sprint107.
//   GET ?id=            → estado de uma ronda (participantes + atribuições)
//   GET                 → ronda ATIVA de hoje da org (ou null)
//   POST {action:'start', participants, shift}
//                       → cria ronda, divide os utentes ativos pelos participantes
//   POST {action:'attend', assignment_id, outcome, note}
//                       → o funcionário atual atende: TRANSFERE para si + regista
//                         (care_records) e marca done. Auto-transfer se era de outro.
//   POST {action:'end', id}  → fecha a ronda
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function sb(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
async function ctx(db: any) {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return { error: 'Não autenticado', status: 401 as const }
  const { data: prof } = await db.from('profiles').select('active_org_id, org_id, name').eq('id', user.id).maybeSingle()
  return { user, orgId: prof?.active_org_id || prof?.org_id || null, name: prof?.name || 'Equipa' }
}
const setupErr = (m: string) => /rounds|round_assignments/.test(m) && /does not exist|relation/.test(m)

export async function GET(req: NextRequest) {
  const db = sb(req); const c = await ctx(db)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const id = req.nextUrl.searchParams.get('id')
  const scopeCol = c.orgId ? 'org_id' : 'user_id'
  const scopeVal = c.orgId || c.user.id
  let round
  if (id) {
    const r = await db.from('rounds').select('*').eq('id', id).maybeSingle()
    if (r.error && setupErr(r.error.message)) return NextResponse.json({ needsSetup: true })
    round = r.data
  } else {
    const today = new Date().toISOString().slice(0, 10)
    const r = await db.from('rounds').select('*').eq(scopeCol, scopeVal).eq('status', 'active').eq('date', today).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (r.error && setupErr(r.error.message)) return NextResponse.json({ needsSetup: true })
    round = r.data
  }
  if (!round) return NextResponse.json({ round: null })
  const { data: assignments } = await db.from('round_assignments').select('*').eq('round_id', round.id)
  return NextResponse.json({ round, assignments: assignments || [], me: c.user.id })
}

export async function POST(req: NextRequest) {
  const db = sb(req); const c = await ctx(db)
  if ('error' in c) return NextResponse.json({ error: c.error }, { status: c.status })
  const body = await req.json().catch(() => ({}))
  const stamp = (row: any) => (c.orgId ? { ...row, org_id: c.orgId } : row)

  if (body.action === 'start') {
    const participants: { id: string; name: string }[] = Array.isArray(body.participants) && body.participants.length ? body.participants : [{ id: c.user.id, name: c.name }]
    const shift = body.shift || null
    const today = new Date().toISOString().slice(0, 10)
    // utentes ativos da org (ou do próprio)
    const patQ = db.from('patients').select('id, name').eq('active', true)
    const { data: patients, error: pErr } = c.orgId ? await patQ.eq('org_id', c.orgId) : await patQ.eq('user_id', c.user.id)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 })
    const ins = await db.from('rounds').insert(stamp({ user_id: c.user.id, date: today, shift, participants, status: 'active', created_by: c.user.id })).select().single()
    if (ins.error) return NextResponse.json({ error: setupErr(ins.error.message) ? 'Rondas ainda não disponíveis — corre o sprint107_rounds.sql.' : ins.error.message }, { status: 400 })
    const round = ins.data
    // divide os utentes pelos participantes (round-robin) → cada um a UM só
    const rows = (patients || []).map((p: any, i: number) => {
      const who = participants[i % participants.length]
      return stamp({ round_id: round.id, patient_id: p.id, assigned_to: who.id, assigned_name: who.name, status: 'pending' })
    })
    if (rows.length) await db.from('round_assignments').insert(rows)
    return NextResponse.json({ ok: true, roundId: round.id })
  }

  if (body.action === 'attend') {
    const aid = String(body.assignment_id || '')
    if (!aid) return NextResponse.json({ error: 'atribuição em falta' }, { status: 400 })
    const { data: a } = await db.from('round_assignments').select('*, rounds(shift)').eq('id', aid).maybeSingle()
    if (!a) return NextResponse.json({ error: 'atribuição não encontrada' }, { status: 404 })
    // TRANSFERÊNCIA automática: quem atende passa a ser o attended_by (mesmo que
    // estivesse atribuído a outro). Fica registado quem o tinha e quem o fez.
    const upd = await db.from('round_assignments').update({
      status: 'done', attended_by: c.user.id, attended_name: c.name,
      assigned_to: c.user.id, assigned_name: c.name,   // reassigna para não voltar a aparecer a ninguém
      outcome: body.outcome || null, note: body.note || null, updated_at: new Date().toISOString(),
    }).eq('id', aid).select().single()
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    // Regista no care_records (o registo simples que "atualiza" o resto do sistema).
    const today = new Date().toISOString().slice(0, 10)
    const shift = (a as any).rounds?.shift || null
    await db.from('care_records').upsert(stamp({
      patient_id: a.patient_id, date: today, shift,
      mood: body.outcome ? { behavior: body.outcome } : null, notes: body.note || null,
    }), { onConflict: 'patient_id,date,shift' }).then(() => {}, () => {})
    return NextResponse.json({ ok: true, transferred: a.assigned_to !== c.user.id })
  }

  if (body.action === 'end') {
    const id = String(body.id || '')
    await db.from('rounds').update({ status: 'done', ended_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'ação inválida' }, { status: 400 })
}
