// app/api/org/audit/route.ts
// Painel do dono: linha do tempo "quem fez o quê a quem", da organização.
// SÓ owner/admin. Junta medicação dada, registos do dia e ocorrências, com o
// nome de quem fez e de que utente se trata. Dentro do legal: o dono é o
// responsável pelo tratamento e vê os registos da SUA instituição.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('[phlox:org-audit] SUPABASE_SERVICE_ROLE_KEY missing'); return NextResponse.json({ error: 'Esta parte ainda não está disponível nesta conta.' }, { status: 503 }) }
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || ''
  if (!token) return NextResponse.json({ error: 'Sessão em falta.' }, { status: 401 })
  const a = admin()
  const { data: { user } } = await a.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: prof } = await a.from('profiles').select('active_org_id, org_id').eq('id', user.id).single()
  const orgId = prof?.active_org_id || prof?.org_id || null
  if (!orgId) return NextResponse.json({ error: 'Sem organização.' }, { status: 400 })
  const { data: mem } = await a.from('org_members').select('role').eq('org_id', orgId).eq('user_id', user.id).eq('active', true).maybeSingle()
  if (!mem || !['owner', 'admin'].includes(mem.role)) return NextResponse.json({ error: 'Só o dono/admin.' }, { status: 403 })

  // Intervalo de datas: aceita from/to (vista multi-dia no ecrã) ou o antigo
  // "date" isolado (compatibilidade). Sem isto, o ecrã só mostrava UM dia de
  // cada vez e só o Excel (route /api/org/export) suportava intervalos — o
  // utilizador não conseguia VER no ecrã os registos de vários dias seguidos.
  const singleDay = req.nextUrl.searchParams.get('date')
  const from = req.nextUrl.searchParams.get('from') || singleDay || new Date().toISOString().slice(0, 10)
  const to = req.nextUrl.searchParams.get('to') || singleDay || new Date().toISOString().slice(0, 10)
  // Limite de segurança: no máximo ~3 meses por pedido, para não martelar a
  // base de dados com um intervalo enorme por engano.
  const MAX_RANGE_DAYS = 92
  const spanDays = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
  if (spanDays < 0) return NextResponse.json({ error: 'Data inicial depois da final.' }, { status: 400 })
  if (spanDays > MAX_RANGE_DAYS) return NextResponse.json({ error: `Intervalo máximo de ${MAX_RANGE_DAYS} dias.` }, { status: 400 })

  const EVENTS_CAP = 500
  const [mar, care, inc, pats, staff] = await Promise.all([
    a.from('mar_records').select('patient_id, med_id, status, recorded_at, recorded_by, recorded_by_id, shift, source, home_by').eq('org_id', orgId).gte('date', from).lte('date', to),
    a.from('care_records').select('patient_id, shift, created_at, recorded_by, recorded_by_id').eq('org_id', orgId).gte('date', from).lte('date', to),
    a.from('incidents').select('patient_id, type, severity, created_at, recorded_by_id').eq('org_id', orgId).gte('date', from).lte('date', to),
    a.from('patients').select('id, name').eq('org_id', orgId),
    a.from('org_members').select('user_id').eq('org_id', orgId).eq('active', true),
  ])

  const patName: Record<string, string> = {}
  ;(pats.data || []).forEach((p: any) => { patName[p.id] = p.name })
  const staffIds = (staff.data || []).map((s: any) => s.user_id)
  const { data: staffProfs } = staffIds.length ? await a.from('profiles').select('id, name').in('id', staffIds) : { data: [] as any[] }
  const staffName: Record<string, string> = {}
  ;(staffProfs || []).forEach((p: any) => { staffName[p.id] = p.name })

  const who = (id?: string | null, fallback?: string | null) => (id && staffName[id]) || fallback || '—'

  const allEvents = [
    // Doses dadas em CASA pela família não são trabalho da equipa — não têm
    // recorded_by_id (não são funcionários) e vêm identificadas por home_by.
    // Aparecem no registo (é um facto relevante para a auditoria), mas
    // marcadas como família, nunca contadas como atividade de funcionário.
    ...(mar.data || []).map((m: any) => ({
      kind: 'med', icon: '💊', at: m.recorded_at,
      who: m.source === 'home' ? `${m.home_by || 'Família'} (em casa)` : who(m.recorded_by_id, m.recorded_by),
      isFamily: m.source === 'home',
      patient: patName[m.patient_id] || '—',
      detail: m.status === 'administered' ? 'deu a medicação' : m.status === 'refused' ? 'medicação recusada' : m.status === 'held' ? 'medicação suspensa' : 'medicação',
      shift: m.shift,
    })),
    ...(care.data || []).map((c: any) => ({
      kind: 'care', icon: '📝', at: c.created_at, isFamily: false,
      who: who(c.recorded_by_id, c.recorded_by), patient: patName[c.patient_id] || '—',
      detail: 'registou o dia', shift: c.shift,
    })),
    ...(inc.data || []).map((i: any) => ({
      kind: 'incident', icon: '⚠️', at: i.created_at, isFamily: false,
      who: who(i.recorded_by_id, null), patient: patName[i.patient_id] || '—',
      detail: `ocorrência: ${i.type}`, severity: i.severity,
    })),
  ].sort((x, y) => (y.at || '').localeCompare(x.at || ''))

  const truncated = allEvents.length > EVENTS_CAP
  const events = allEvents.slice(0, EVENTS_CAP)

  // resumo por funcionário — família (medicação dada em casa) fica de fora,
  // não é trabalho da equipa (conta sobre TODOS os eventos do intervalo, não só os mostrados)
  const byStaff: Record<string, number> = {}
  allEvents.forEach(e => { if (!e.isFamily) byStaff[e.who] = (byStaff[e.who] || 0) + 1 })

  return NextResponse.json({
    from, to, events, byStaff, truncated, totalEvents: allEvents.length,
    totals: { meds: mar.data?.length || 0, care: care.data?.length || 0, incidents: inc.data?.length || 0 },
  })
}
