'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import StockSection from '@/components/StockSection'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'
import { useInstitutionProfile } from '@/lib/useInstitutionProfile'
import { analyzeResident, SEVERITY_STYLE, type Severity, type Signal } from '@/lib/residentSignals'

type Shift = 'manha' | 'tarde' | 'noite'

interface Patient {
  id: string; name: string; room_number?: string | null; age?: number | null
  conditions?: string | null; allergies?: string | null
  risk_level?: string | null; fall_risk?: string | null; pressure_risk?: string | null
  admission_date?: string | null; discharge_date?: string | null; active?: boolean
}
interface CareRec { patient_id: string; shift: Shift; date: string }
interface MarRec { patient_id: string; shift: Shift; date: string; status: string | null }
interface Incident { id: string; patient_id: string; type: string; severity: string; status: string; date: string }
interface TeamMember { id: string; name: string; role: string; status: string }
interface ShiftAssign { team_member_id: string; shift: Shift; date: string }
interface Assessment { patient_id: string; scale: string; date: string }
interface Wound { id: string; patient_id: string; status: string; stage?: string | null }

const INC_LABELS: Record<string, string> = { fall: 'Quedas', medication_error: 'Erros med.', pressure_ulcer: 'Úlceras', behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeções', other: 'Outras' }
const ROLE_LABELS: Record<string, string> = { nurse: 'Enfermeiro(a)', caregiver: 'Ajudante', pharmacist: 'Farmacêutico(a)', doctor: 'Médico(a)', coordinator: 'Coordenador(a)', director: 'Diretor(a)', admin: 'Administrativo(a)' }
const SHIFT_LABEL: Record<Shift, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const SHIFT_COLOR: Record<Shift, string> = { manha: '#d97706', tarde: '#2563eb', noite: '#6d28d9' }

const today = () => new Date().toISOString().slice(0, 10)
const curShift = (): Shift => { const h = new Date().getHours(); if (h >= 7 && h < 14) return 'manha'; if (h >= 14 && h < 21) return 'tarde'; return 'noite' }

function Ring({ pct, color, label, sub, size = 78 }: { pct: number; color: string; label: string; sub: string; size?: number }) {
  const r = (size - 9) / 2, c = 2 * Math.PI * r, off = c - (Math.min(pct, 100) / 100) * c
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef0f3" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" style={{ fontSize: 17, fontWeight: 800, fill: color, fontFamily: 'var(--font-mono)' }}>{pct}%</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', marginTop: 6 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{sub}</div>
    </div>
  )
}

export default function NursingHomeGestao() {
  const { user, supabase } = useAuth() as any
  const profile = useInstitutionProfile()
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState<Patient[]>([])
  const [care, setCare] = useState<CareRec[]>([])
  const [mar, setMar] = useState<MarRec[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [shifts, setShifts] = useState<ShiftAssign[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [wounds, setWounds] = useState<Wound[]>([])
  const [medsByPt, setMedsByPt] = useState<Record<string, string[]>>({})
  const [weightsByPt, setWeightsByPt] = useState<Record<string, { date: string; weight: number }[]>>({})
  const [vitalsByPt, setVitalsByPt] = useState<Record<string, any>>({})
  const [fluidByPt, setFluidByPt] = useState<Record<string, number>>({})
  const [bowelByPt, setBowelByPt] = useState<Record<string, number>>({})
  const [tab, setTab] = useState<'painel' | 'stock'>('painel')

  const d = today(), shift = curShift(), month = d.slice(0, 7)
  const totalBeds = profile?.total_beds || 30

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)
    const since365 = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const since14 = new Date(Date.now() - 14 * 86400000).toISOString()
    const yearStart = `${new Date().getFullYear()}-01-01`
    const [p, c, m, i, t, sa, a, w, meds, allCare, hyd] = await Promise.all([
      supabase.from('patients').select('*').eq('user_id', user.id),
      supabase.from('care_records').select('patient_id,shift,date').eq('user_id', user.id).eq('date', d),
      supabase.from('mar_records').select('patient_id,shift,date,status').eq('user_id', user.id).eq('date', d),
      supabase.from('incidents').select('id,patient_id,type,severity,status,date').eq('user_id', user.id).gte('date', yearStart),
      supabase.from('team_members').select('id,name,role,status').eq('user_id', user.id),
      supabase.from('shift_assignments').select('team_member_id,shift,date').eq('user_id', user.id).eq('date', d),
      supabase.from('assessments').select('patient_id,scale,date').eq('user_id', user.id).gte('date', since),
      supabase.from('wounds').select('id,patient_id,status,stage').eq('user_id', user.id),
      supabase.from('patient_meds').select('patient_id,name').eq('user_id', user.id),
      supabase.from('care_records').select('patient_id,date,vitals').eq('user_id', user.id).gte('date', since365),
      supabase.from('hydration_logs').select('patient_id,at,kind,fluid_ml').eq('user_id', user.id).gte('at', since14),
    ])
    setPatients((p.data || []).filter((x: Patient) => x.active !== false))
    setCare(c.data || []); setMar(m.data || []); setIncidents(i.data || [])
    setTeam(t.data || []); setShifts(sa.data || []); setAssessments(a.data || [])
    setWounds(w.error ? [] : (w.data || []))

    const md: Record<string, string[]> = {}
    ;(meds.error ? [] : meds.data || []).forEach((x: any) => { (md[x.patient_id] ||= []).push(x.name) })
    setMedsByPt(md)
    const wt: Record<string, { date: string; weight: number }[]> = {}
    const vitLatest: Record<string, { date: string; v: any }> = {}
    ;(allCare.error ? [] : allCare.data || []).forEach((x: any) => {
      if (x.vitals?.weight) (wt[x.patient_id] ||= []).push({ date: x.date, weight: Number(x.vitals.weight) })
      const v = x.vitals
      if (v && (v.temp != null || v.spo2 != null || v.bp_sys != null || v.hr != null)) {
        if (!vitLatest[x.patient_id] || x.date > vitLatest[x.patient_id].date) vitLatest[x.patient_id] = { date: x.date, v }
      }
    })
    setWeightsByPt(wt)
    const vit: Record<string, any> = {}
    Object.entries(vitLatest).forEach(([pid, { date, v }]) => { if (Date.now() - new Date(date).getTime() <= 3 * 86400000) vit[pid] = { ...v, at: date } })
    setVitalsByPt(vit)
    const fl: Record<string, number> = {}; const bLast: Record<string, string> = {}
    ;(hyd.error ? [] : hyd.data || []).forEach((l: any) => {
      if (l.kind === 'fluid' && l.at.slice(0, 10) === d) fl[l.patient_id] = (fl[l.patient_id] || 0) + (l.fluid_ml || 0)
      if (l.kind === 'bowel' && (!bLast[l.patient_id] || l.at > bLast[l.patient_id])) bLast[l.patient_id] = l.at
    })
    setFluidByPt(fl)
    const bw: Record<string, number> = {}
    Object.entries(bLast).forEach(([pid, at]) => { bw[pid] = Math.floor((Date.now() - new Date(at).getTime()) / 86400000) })
    setBowelByPt(bw)
    setLoading(false)
  }, [user, supabase, d])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: ['patients', 'care_records', 'mar_records', 'incidents', 'team_members', 'shift_assignments', 'wounds', 'patient_meds', 'hydration_logs'], userId: user?.id, onChange: load })

  // ── Motor de ecossistema: risco por residente (consistente com Cockpit/Turno/ficha) ──
  const ranked = patients.map(p => {
    const a = analyzeResident({
      age: p.age, conditions: p.conditions, allergies: p.allergies,
      meds: medsByPt[p.id] || [],
      incidents: incidents.filter(x => x.patient_id === p.id && x.status !== 'closed').map(x => ({ type: x.type, severity: x.severity, status: x.status })),
      assessments: assessments.filter(x => x.patient_id === p.id).map(x => ({ scale: x.scale, date: x.date })),
      wounds: wounds.filter(x => x.patient_id === p.id).map(x => ({ status: x.status, stage: x.stage })),
      weightSeries: weightsByPt[p.id] || [],
      fluidToday: fluidByPt[p.id] ?? null,
      lastBowelDays: bowelByPt[p.id] ?? null,
      latestVitals: vitalsByPt[p.id] ?? null,
    })
    return { p, ...a }
  }).sort((a, b) => b.score - a.score)
  const criticalCount = ranked.filter(r => r.level === 'critical').length
  const warningCount = ranked.filter(r => r.level === 'warning').length

  // ── Derived metrics ──
  const occupied = patients.filter(p => p.room_number).length
  const occupancyPct = totalBeds > 0 ? Math.round((occupied / totalBeds) * 100) : 0
  const onShift = team.filter(m => m.status === 'on_shift' || m.status === 'active').length
  const openInc = incidents.filter(i => i.status !== 'closed')
  const activeWounds = wounds.filter(w => w.status !== 'healed')
  const severeWounds = activeWounds.filter(w => w.stage === 'III' || w.stage === 'IV' || w.stage === 'unstageable')
  const careThisShift = new Set(care.filter(c => c.shift === shift).map(c => c.patient_id))
  const carePct = patients.length > 0 ? Math.round((careThisShift.size / patients.length) * 100) : 0
  const marDone = new Set(mar.filter(m => m.status === 'administered').map(m => m.patient_id))
  const marPct = patients.length > 0 ? Math.round((marDone.size / patients.length) * 100) : 0
  const admissionsMonth = patients.filter(p => (p.admission_date || '').slice(0, 7) === month).length
  const dischargesMonth = patients.filter(p => (p.discharge_date || '').slice(0, 7) === month).length

  // Quality this month — incidents by type
  const incMonth = incidents.filter(i => i.date.slice(0, 7) === month)
  const incByType: Record<string, number> = {}
  incMonth.forEach(i => { incByType[i.type] = (incByType[i.type] || 0) + 1 })
  const maxInc = Math.max(1, ...Object.values(incByType))

  // Overdue barthel
  const barthel: Record<string, string> = {}
  assessments.filter(a => a.scale === 'barthel').forEach(a => { if (!barthel[a.patient_id] || a.date > barthel[a.patient_id]) barthel[a.patient_id] = a.date })
  const overdueAssess = patients.filter(p => { const last = barthel[p.id]; return !last || (Date.now() - new Date(last).getTime()) > 90 * 86400000 }).length

  // Team on shift today (scheduled)
  const teamMap: Record<string, TeamMember> = {}; team.forEach(m => { teamMap[m.id] = m })
  const shiftTeam = (s: Shift) => shifts.filter(x => x.shift === s).map(x => teamMap[x.team_member_id]).filter(Boolean)

  const nameOf = (id: string) => patients.find(p => p.id === id)?.name || 'Residente'
  const roomOf = (id: string) => { const r = patients.find(p => p.id === id)?.room_number; return r ? `Q${r}` : '' }

  // ── Consolidated alerts feed ──
  interface Alert { id: string; prio: number; color: string; cat: string; text: string; href: string }
  const alerts: Alert[] = []
  if (criticalCount > 0) alerts.push({ id: 'risk-crit', prio: 0, color: '#dc2626', cat: 'Risco clínico crítico', text: `${criticalCount} residente${criticalCount !== 1 ? 's' : ''} a precisar de atenção prioritária`, href: '/rounds' })
  openInc.filter(i => i.severity === 'critical' || i.severity === 'major').forEach(i => alerts.push({ id: `i${i.id}`, prio: 0, color: '#dc2626', cat: 'Ocorrência grave', text: `${INC_LABELS[i.type] || i.type} · ${nameOf(i.patient_id)} ${roomOf(i.patient_id)}`, href: '/incidents' }))
  severeWounds.forEach(w => alerts.push({ id: `w${w.id}`, prio: 1, color: '#991b1b', cat: `Ferida Cat. ${w.stage}`, text: `${nameOf(w.patient_id)} ${roomOf(w.patient_id)}`, href: '/feridas' }))
  openInc.filter(i => i.severity !== 'critical' && i.severity !== 'major').forEach(i => alerts.push({ id: `i${i.id}`, prio: 2, color: '#d97706', cat: 'Ocorrência aberta', text: `${INC_LABELS[i.type] || i.type} · ${nameOf(i.patient_id)}`, href: '/incidents' }))
  if (overdueAssess > 0) alerts.push({ id: 'assess', prio: 3, color: '#2563eb', cat: 'Avaliações vencidas', text: `${overdueAssess} residentes com Barthel > 90 dias`, href: '/assessments' })
  if (carePct < 60) alerts.push({ id: 'care', prio: 3, color: '#d97706', cat: 'Registos em atraso', text: `Só ${carePct}% dos registos do turno ${SHIFT_LABEL[shift]} estão feitos`, href: '/care-log' })
  alerts.sort((a, b) => a.prio - b.prio)

  const instName = profile?.short_name || profile?.name || 'o teu lar'

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }
  const secTitle = (t: string, href?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{t}</span>
      {href && <Link href={href} style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Abrir →</Link>}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1040 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Gestão · Tempo real</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Painel de Gestão</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Visão completa de {instName} — ocupação, equipa, clínica, qualidade.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', background: 'white', border: '1px solid var(--border)', borderRadius: 9 }}>
            <span className="live-dot" />
            <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>Turno {SHIFT_LABEL[shift]}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['painel', 'Painel'], ['stock', 'Stock & Validades']] as [typeof tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 9, border: `1.5px solid ${tab === t ? '#0d6e42' : 'var(--border)'}`, background: tab === t ? '#eef6f1' : 'white', color: tab === t ? '#0d6e42' : 'var(--ink-4)', fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{l}</button>
          ))}
        </div>

        {tab === 'stock' ? <StockSection /> : (<>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Ocupação', value: `${occupied}/${totalBeds}`, sub: `${occupancyPct}%`, color: occupancyPct >= 90 ? '#dc2626' : '#0d6e42', href: '/census' },
            { label: 'Equipa em serviço', value: onShift, sub: `de ${team.length}`, color: '#2563eb', href: '/schedule' },
            { label: 'Risco crítico', value: criticalCount, sub: warningCount ? `+${warningCount} a vigiar` : 'residentes', color: criticalCount ? '#dc2626' : warningCount ? '#d97706' : '#16a34a', href: '/rounds' },
            { label: 'Ocorrências abertas', value: openInc.length, sub: 'por resolver', color: openInc.length ? '#dc2626' : '#16a34a', href: '/incidents' },
            { label: 'Feridas ativas', value: activeWounds.length, sub: severeWounds.length ? `${severeWounds.length} cat. III/IV` : 'acompanhamento', color: severeWounds.length ? '#991b1b' : '#d97706', href: '/feridas' },
          ].map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
              <div style={{ ...card, padding: '14px 16px', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: k.color, lineHeight: 1 }}>{loading ? '—' : k.value}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{k.sub}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 6 }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        <div className="gestao-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

          {/* Conclusão do turno */}
          <div style={card}>
            {secTitle(`Conclusão do turno · ${SHIFT_LABEL[shift]}`)}
            <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12 }}>
              <Ring pct={loading ? 0 : carePct} color="#2563eb" label="Registos diários" sub={`${careThisShift.size}/${patients.length}`} />
              <Ring pct={loading ? 0 : marPct} color="#0d6e42" label="MAR administrado" sub={`${marDone.size}/${patients.length}`} />
            </div>
          </div>

          {/* Residentes de maior risco — motor de ecossistema */}
          <div style={{ ...card, gridColumn: '1 / -1' }}>
            {secTitle(`Residentes de maior risco${criticalCount + warningCount ? ` · ${criticalCount + warningCount}` : ''}`, '/rounds')}
            {loading ? (
              <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A analisar…</div>
            ) : ranked.filter(r => r.level === 'critical' || r.level === 'warning').length === 0 ? (
              <div style={{ fontSize: 12, color: '#16a34a' }}>Nenhum residente com sinais de alerta neste momento.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                {ranked.filter(r => r.level === 'critical' || r.level === 'warning').slice(0, 9).map(({ p, score, level, signals }) => {
                  const st = SEVERITY_STYLE[level as Severity]
                  const top = (signals as Signal[]).filter(s => s.severity === 'critical' || s.severity === 'warning').slice(0, 2)
                  return (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ textDecoration: 'none', display: 'flex', gap: 10, padding: '10px 12px', border: `1px solid ${st.border}`, background: st.bg, borderRadius: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'white', border: `1.5px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: st.color }}>{score}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}{p.room_number ? ` · Q${p.room_number}` : ''}</div>
                        <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{top.map(s => s.title).join(' · ') || st.label}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Movimento + avaliações */}
          <div style={card}>
            {secTitle('Movimento & conformidade · este mês')}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { l: 'Admissões', v: admissionsMonth, c: '#0d6e42' },
                { l: 'Saídas', v: dischargesMonth, c: '#64748b' },
                { l: 'Ocorrências', v: incMonth.length, c: incMonth.length ? '#d97706' : '#16a34a' },
                { l: 'Avaliações vencidas', v: overdueAssess, c: overdueAssess ? '#dc2626' : '#16a34a' },
              ].map(s => (
                <div key={s.l} style={{ background: 'var(--bg-2)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.v}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Qualidade — ocorrências por tipo */}
          <div style={card}>
            {secTitle('Qualidade · ocorrências este mês', '/quality')}
            {Object.keys(incByType).length === 0 ? (
              <div style={{ fontSize: 12, color: '#16a34a' }}>Sem ocorrências registadas este mês.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {Object.entries(incByType).sort((a, b) => b[1] - a[1]).map(([type, n]) => (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{INC_LABELS[type] || type}</span>
                      <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{n}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(n / maxInc) * 100}%`, background: '#d97706', borderRadius: 3 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Equipa hoje por turno */}
          <div style={card}>
            {secTitle('Equipa de hoje', '/schedule')}
            {shifts.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>Sem escala marcada para hoje. <Link href="/schedule" style={{ color: '#2563eb' }}>Marcar turnos →</Link></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(['manha', 'tarde', 'noite'] as Shift[]).map(s => {
                  const members = shiftTeam(s)
                  return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: SHIFT_COLOR[s], flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', width: 48, flexShrink: 0 }}>{SHIFT_LABEL[s]}</span>
                      <span style={{ fontSize: 12, color: members.length ? 'var(--ink)' : 'var(--ink-5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {members.length ? members.map(m => m.name.split(' ')[0]).join(', ') : '— sem ninguém —'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Alerts feed — full width */}
        <div style={{ ...card, marginTop: 12 }}>
          {secTitle(`Alertas a precisar de atenção${alerts.length ? ` · ${alerts.length}` : ''}`)}
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--ink-5)' }}>A carregar…</div>
          ) : alerts.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontSize: 13 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              Tudo em ordem — sem alertas neste momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {alerts.slice(0, 12).map(a => (
                <Link key={a.id + a.cat} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 9, border: '1px solid var(--border)', borderLeft: `3px solid ${a.color}`, textDecoration: 'none', background: 'white' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: a.color, minWidth: 130, flexShrink: 0 }}>{a.cat}</span>
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                </Link>
              ))}
            </div>
          )}
        </div>
        </>)}
      </div>
      <style>{`@media (max-width: 760px){ .gestao-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
