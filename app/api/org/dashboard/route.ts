// app/api/org/dashboard/route.ts
// Painel do dono — VISÃO DE NEGÓCIO da instituição. Só owner/admin.
// Indicadores para gerir o negócio a partir do Phlox: ocupação, receita estimada,
// equipa, qualidade do cuidado e ligação às famílias.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } })
}
const safe = async (q: any) => { try { const r = await q; return r.error ? { data: [], count: 0 } : r } catch { return { data: [], count: 0 } } }

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('[phlox:org-dashboard] SUPABASE_SERVICE_ROLE_KEY missing'); return NextResponse.json({ error: 'Esta parte ainda não está disponível nesta conta.' }, { status: 503 }) }
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

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(); monthStart.setDate(1)
  const mStart = monthStart.toISOString().slice(0, 10)
  const last7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const { data: org } = await safe(a.from('organizations').select('name, kind, capacity, monthly_fee, logo_url, accent_color').eq('id', orgId))
    .then((r: any) => ({ data: r.data?.[0] || r.data || null })).catch(() => ({ data: null }))

  const [patients, members, careToday, marMonth, incOpen, family, careWeek, medsActive, incMonth, assessMonth, careMonth, vigil, finance, billing] = await Promise.all([
    safe(a.from('patients').select('id, name, room_number, created_at', { count: 'exact' }).eq('org_id', orgId).eq('active', true)),
    safe(a.from('org_members').select('user_id', { count: 'exact' }).eq('org_id', orgId).eq('active', true)),
    safe(a.from('care_records').select('patient_id').eq('org_id', orgId).eq('date', today)),
    safe(a.from('mar_records').select('status, source').eq('org_id', orgId).gte('date', mStart)),
    safe(a.from('incidents').select('id, type, severity, date').eq('org_id', orgId).eq('status', 'open')),
    safe(a.from('family_thread_messages').select('patient_id, author_side').eq('org_id', orgId).gte('created_at', last7 + 'T00:00:00')),
    safe(a.from('care_records').select('patient_id, date').eq('org_id', orgId).gte('date', last7)),
    safe(a.from('patient_meds').select('patient_id, shifts').eq('org_id', orgId).eq('active', true)),
    // — Cofre de valor (mês corrente): o que ficou registado e organizado —
    safe(a.from('incidents').select('id, status').eq('org_id', orgId).gte('date', mStart)),
    safe(a.from('assessments').select('id').eq('org_id', orgId).gte('date', mStart)),
    safe(a.from('care_records').select('patient_id, date').eq('org_id', orgId).gte('date', mStart)),
    // achados de vigilância farmacológica sinalizados para revisão (por utente)
    safe(a.from('patient_vigilance').select('flags, alerts').eq('org_id', orgId)),
    // movimentos financeiros do mês (despesas + outras receitas) — sprint104
    safe(a.from('finance_entries').select('kind, amount').eq('org_id', orgId).gte('date', mStart)),
    // mensalidades recebidas no mês (billing_entries pagas)
    safe(a.from('billing_entries').select('fee, subsidy, extras, discount, paid').eq('org_id', orgId).eq('month', mStart.slice(0, 7))),
  ])

  const nPatients = patients.count || (patients.data?.length ?? 0)
  const capacity = (org as any)?.capacity || null
  const monthlyFee = (org as any)?.monthly_fee || null
  const presentToday = new Set((careToday.data || []).map((c: any) => c.patient_id)).size
  const marGiven = (marMonth.data || []).filter((m: any) => ['administered', 'given', 'taken'].includes(m.status)).length
  const marHome = (marMonth.data || []).filter((m: any) => m.source === 'home').length
  const familiesEngaged = new Set((family.data || []).map((f: any) => f.patient_id)).size
  const familyReplies = (family.data || []).filter((f: any) => f.author_side === 'family').length
  // Ocorrências em aberto por gravidade — o dono precisa de saber se são graves.
  const incBySeverity = (incOpen.data || []).reduce((acc: Record<string, number>, i: any) => {
    const s = String(i.severity || 'minor')
    acc[s] = (acc[s] || 0) + 1; return acc
  }, {})
  const incidentsGrave = (incBySeverity.major || 0) + (incBySeverity.critical || 0) + (incBySeverity.serious || 0) + (incBySeverity.sentinel || 0)

  // adesão ao registo: dos últimos 7 dias, % de utente-dias com registo
  const careDays = new Set((careWeek.data || []).map((c: any) => `${c.patient_id}|${c.date}`)).size
  const expected = nPatients * 7
  const logAdherence = expected > 0 ? Math.round((careDays / expected) * 100) : null

  // ── COFRE DE VALOR — "o que ficou registado e organizado este mês" ──
  // Contagens REAIS e auditáveis (sem inventar). É o retrato do rigor que a casa
  // passa a ter — não uma promessa clínica.
  const monthLabel = monthStart.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  const careRecordsMonth = (careMonth.data || []).length
  const careDaysMonth = new Set((careMonth.data || []).map((c: any) => `${c.patient_id}|${c.date}`)).size
  const incidentsMonth = (incMonth.data || []).length
  const incidentsFollowed = (incMonth.data || []).filter((i: any) => i.status === 'closed' || i.status === 'resolved').length
  const assessmentsMonth = (assessMonth.data || []).length
  // achados farmacológicos sinalizados para revisão da equipa (flags + alertas)
  const vigilFindings = (vigil.data || []).reduce((s: number, v: any) =>
    s + (Array.isArray(v.flags) ? v.flags.length : 0) + (Array.isArray(v.alerts) ? v.alerts.length : 0), 0)
  // adesão da medicação do mês: doses dadas / doses PREVISTAS pelo horário —
  // NÃO doses dadas / total de registos existentes. Uma dose que a equipa
  // simplesmente não regista (esquecida ou propositadamente não dada) nunca
  // cria uma linha em mar_records — por isso dividir pelo nº de registos dava
  // sempre ~100%, mesmo com doses reais a falhar (o denominador só crescia
  // quando havia sucesso a registar). O previsto vem do horário real de cada
  // medicação ativa (patient_meds.shifts — 3 turnos/dia se vazio) × dias
  // decorridos no mês; é uma aproximação (não sabe se um fármaco só foi
  // adicionado a meio do mês), mas reflete doses PREVISTAS, não só registadas.
  const daysSoFarMonth = Math.floor((Date.now() - monthStart.getTime()) / 86400000) + 1
  const expectedDosesPerDay = (medsActive.data || []).reduce((s: number, m: any) => s + (Array.isArray(m.shifts) && m.shifts.length > 0 ? m.shifts.length : 3), 0)
  const marExpectedMonth = expectedDosesPerDay * daysSoFarMonth
  const marAdherence = marExpectedMonth > 0 ? Math.min(100, Math.round((marGiven / marExpectedMonth) * 100)) : null

  // ── FINANÇAS DO MÊS — resultado real: mensalidades recebidas + outras receitas
  // − despesas. Tolerante: sem finance_entries/billing_entries fica a zero.
  const expensesMonth = (finance.data || []).filter((f: any) => f.kind === 'expense').reduce((s: number, f: any) => s + Number(f.amount || 0), 0)
  const otherIncomeMonth = (finance.data || []).filter((f: any) => f.kind === 'income').reduce((s: number, f: any) => s + Number(f.amount || 0), 0)
  const feesReceivedMonth = (billing.data || []).filter((b: any) => b.paid).reduce((s: number, b: any) => s + (Number(b.fee || 0) + Number(b.extras || 0) - Number(b.subsidy || 0) - Number(b.discount || 0)), 0)
  const monthResult = feesReceivedMonth + otherIncomeMonth - expensesMonth

  return NextResponse.json({
    org: { name: (org as any)?.name || 'A sua instituição', kind: (org as any)?.kind || 'day_care', capacity, monthlyFee, logoUrl: (org as any)?.logo_url || null, accentColor: (org as any)?.accent_color || null },
    kpis: {
      patients: nPatients,
      capacity,
      occupancy: capacity ? Math.round((nPatients / capacity) * 100) : null,
      presentToday,
      teamSize: members.count || (members.data?.length ?? 0),
      revenueEstimate: monthlyFee ? nPatients * monthlyFee : null,
      marGivenMonth: marGiven,
      marHomeMonth: marHome,
      incidentsOpen: (incOpen.data || []).length,
      incidentsGrave,
      familiesEngaged,
      familyReplies,
      logAdherence,
      medsActive: (medsActive.data || []).length,
    },
    ledger: {
      monthLabel,
      careRecordsMonth,
      careDaysMonth,
      marGivenMonth: marGiven,
      marAdherence,
      incidentsMonth,
      incidentsFollowed,
      assessmentsMonth,
      vigilFindings,
    },
    finance: {
      monthLabel,
      feesReceived: feesReceivedMonth,
      otherIncome: otherIncomeMonth,
      expenses: expensesMonth,
      result: monthResult,
    },
    incidents: (incOpen.data || []).slice(0, 5),
  })
}
