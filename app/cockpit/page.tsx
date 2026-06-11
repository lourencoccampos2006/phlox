'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { useLiveData } from '@/lib/useLiveData'
import { analyzeResident, SEVERITY_STYLE } from '@/lib/residentSignals'
import InstitutionHub from '@/components/InstitutionHub'
import OperationalPulse from '@/components/OperationalPulse'
import LivePulseBadge from '@/components/LivePulseBadge'
import { roleFocusLine } from '@/lib/institutionHub'

type Shift = 'manha' | 'tarde' | 'noite'

interface Patient {
  id: string; name: string; room_number?: string; age?: number
  conditions?: string; allergies?: string; fall_risk?: string; pressure_risk?: string
}
interface Incident { id: string; type: string; severity: string; status: string; date: string; patient_id: string }
interface CareRec { id: string; patient_id: string; shift: Shift; date: string }
interface MarRec { id: string; patient_id: string; shift: Shift; date: string; status: string }
interface Assessment { id: string; patient_id: string; scale: string; score: number; date: string }
interface TeamMember { id: string; name: string; role: string; status: string }

const SHIFTS: Record<Shift, { label: string; short: string; hours: string; color: string; bg: string }> = {
  manha: { label: 'Turno Manhã',  short: 'Manhã',  hours: '07–14h', color: '#d97706', bg: '#fffbeb' },
  tarde: { label: 'Turno Tarde',  short: 'Tarde',  hours: '14–21h', color: '#2563eb', bg: '#eff6ff' },
  noite: { label: 'Turno Noite',  short: 'Noite',  hours: '21–07h', color: '#4f46e5', bg: '#f5f3ff' },
}

const INC_LABELS: Record<string, string> = {
  fall: 'Queda', medication_error: 'Erro med.', pressure_ulcer: 'Úlcera',
  behavioral: 'Comportamental', choking: 'Engasgamento', infection: 'Infeção', other: 'Outro',
}
const SEV_COLOR: Record<string, string> = {
  minor: '#6b7280', moderate: '#d97706', major: '#dc2626', critical: '#7f1d1d',
}
const INST_LABELS: Record<string, string> = {
  hospital: 'Hospital', clinic: 'Clínica', pharmacy_hospital: 'Farmácia Hospitalar',
  pharmacy_community: 'Farmácia Comunitária', nursing_home: 'Lar / ERPI', health_center: 'Centro de Saúde',
}

function currentShift(): Shift {
  const h = new Date().getHours()
  if (h >= 7 && h < 14) return 'manha'
  if (h >= 14 && h < 21) return 'tarde'
  return 'noite'
}

function greet(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 19) return 'Boa tarde'
  return 'Boa noite'
}

export default function CockpitPage() {
  const { user, supabase } = useAuth() as any
  const { institution, role } = useClinicPrefs()
  const isNH = institution === 'nursing_home'

  const [patients, setPatients] = useState<Patient[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [careRecs, setCareRecs] = useState<CareRec[]>([])
  const [marRecs, setMarRecs] = useState<MarRec[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  // Ecosystem data (batch, for risk engine)
  const [medsByPt, setMedsByPt] = useState<Record<string, string[]>>({})
  const [woundsByPt, setWoundsByPt] = useState<Record<string, { status: string; stage?: string | null }[]>>({})
  const [weightsByPt, setWeightsByPt] = useState<Record<string, { date: string; weight: number }[]>>({})
  const [vitalsByPt, setVitalsByPt] = useState<Record<string, { temp?: number; spo2?: number; bp_sys?: number; hr?: number; at?: string }>>({})
  const [fluidByPt, setFluidByPt] = useState<Record<string, number>>({})
  const [bowelByPt, setBowelByPt] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())
  // Evita mismatch de hidratação: a data/hora só aparece depois de montar (a hora
  // do servidor difere da do cliente). Antes disso mostramos um placeholder vazio.
  const [mounted, setMounted] = useState(false)

  // Live clock
  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  const today = now.toISOString().slice(0, 10)
  const shift = currentShift()

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const queries: Promise<any>[] = [
      supabase.from('patients').select('id,name,room_number,age,conditions,allergies,fall_risk,pressure_risk').eq('user_id', user.id).eq('active', true).order('room_number', { nullsFirst: false }),
      supabase.from('incidents').select('id,type,severity,status,date,patient_id').eq('user_id', user.id).gte('date', new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
      supabase.from('care_records').select('id,patient_id,shift,date').eq('user_id', user.id).eq('date', today),
      supabase.from('team_members').select('id,name,role,status').eq('user_id', user.id).eq('status', 'active'),
      supabase.from('patient_meds').select('patient_id,name').eq('user_id', user.id),
    ]
    const MEDS_IDX = 4
    if (isNH) {
      const since60 = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
      const since365 = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
      const since14 = new Date(Date.now() - 14 * 86400000).toISOString()
      queries.push(
        supabase.from('mar_records').select('id,patient_id,shift,date,status').eq('user_id', user.id).eq('date', today),
        supabase.from('assessments').select('id,patient_id,scale,score,date').eq('user_id', user.id).gte('date', since60),
        // ── Ecosystem batch (risk engine; meds já carregados na base) ──
        supabase.from('wounds').select('patient_id,status,stage').eq('user_id', user.id),
        supabase.from('care_records').select('patient_id,date,vitals').eq('user_id', user.id).gte('date', since365),
        supabase.from('hydration_logs').select('patient_id,at,kind,fluid_ml').eq('user_id', user.id).gte('at', since14),
      )
    }
    const results = await Promise.all(queries)
    setPatients(results[0].data || [])
    setIncidents(results[1].data || [])
    setCareRecs(results[2].data || [])
    setTeamMembers(results[3].data || [])

    // meds by patient — carregado para TODAS as instituições (motor de risco no cockpit)
    const meds: Record<string, string[]> = {}
    ;(results[MEDS_IDX]?.data || []).forEach((m: any) => { (meds[m.patient_id] ||= []).push(m.name) })
    setMedsByPt(meds)

    if (isNH) {
      setMarRecs(results[5]?.data || [])
      setAssessments(results[6]?.data || [])

      const wounds: Record<string, { status: string; stage?: string | null }[]> = {}
      ;(results[7]?.data || []).forEach((w: any) => { (wounds[w.patient_id] ||= []).push({ status: w.status, stage: w.stage }) })
      setWoundsByPt(wounds)

      const weights: Record<string, { date: string; weight: number }[]> = {}
      const vitalsLatest: Record<string, { date: string; v: any }> = {}
      ;(results[8]?.data || []).forEach((c: any) => {
        if (c.vitals?.weight) (weights[c.patient_id] ||= []).push({ date: c.date, weight: Number(c.vitals.weight) })
        const v = c.vitals
        if (v && (v.temp != null || v.spo2 != null || v.bp_sys != null || v.hr != null)) {
          if (!vitalsLatest[c.patient_id] || c.date > vitalsLatest[c.patient_id].date) vitalsLatest[c.patient_id] = { date: c.date, v }
        }
      })
      setWeightsByPt(weights)
      const vit: Record<string, any> = {}
      // only trust vitals from the last 3 days for "current" signals
      Object.entries(vitalsLatest).forEach(([pid, { date, v }]) => {
        if (Date.now() - new Date(date).getTime() <= 3 * 86400000) vit[pid] = { ...v, at: date }
      })
      setVitalsByPt(vit)

      const fluid: Record<string, number> = {}
      const bowelLast: Record<string, string> = {}
      ;(results[9]?.data || []).forEach((l: any) => {
        if (l.kind === 'fluid' && l.at.slice(0, 10) === today) fluid[l.patient_id] = (fluid[l.patient_id] || 0) + (l.fluid_ml || 0)
        if (l.kind === 'bowel' && (!bowelLast[l.patient_id] || l.at > bowelLast[l.patient_id])) bowelLast[l.patient_id] = l.at
      })
      setFluidByPt(fluid)
      const bowel: Record<string, number> = {}
      Object.entries(bowelLast).forEach(([pid, at]) => { bowel[pid] = Math.floor((Date.now() - new Date(at).getTime()) / 86400000) })
      setBowelByPt(bowel)
    }
    setLoading(false)
  }, [user, supabase, isNH, today])

  useEffect(() => { load() }, [load])

  // Live dashboard: refresh when records change elsewhere or on return to app
  useLiveData({ supabase, table: ['care_records', 'mar_records', 'incidents', 'patients', 'wounds', 'hydration_logs', 'patient_meds'], userId: user?.id, onChange: load })

  // Stats
  const openIncidents = incidents.filter(i => i.status === 'open')
  const todayIncidents = incidents.filter(i => i.date === today)
  const thisMonthInc = incidents.filter(i => i.date.slice(0, 7) === today.slice(0, 7))
  const careToday = careRecs.filter(r => r.date === today)
  const careThisShift = careRecs.filter(r => r.date === today && r.shift === shift)
  const patientsWithCareToday = new Set(careToday.map(r => r.patient_id))
  const patientsWithoutCareToday = patients.filter(p => !patientsWithCareToday.has(p.id))
  const patientsWithCareThisShift = new Set(careThisShift.map(r => r.patient_id))

  // ── Ecosystem risk engine: analyze EVERY resident, consistent with the chart ──
  const ranked = patients.map(p => {
    const a = analyzeResident({
      age: p.age, conditions: p.conditions, allergies: p.allergies,
      meds: medsByPt[p.id] || [],
      incidents: incidents.filter(i => i.patient_id === p.id).map(i => ({ type: i.type, severity: i.severity, status: i.status })),
      assessments: assessments.filter(x => x.patient_id === p.id).map(x => ({ scale: x.scale, date: x.date })),
      wounds: woundsByPt[p.id] || [],
      weightSeries: weightsByPt[p.id] || [],
      fluidToday: fluidByPt[p.id] ?? null,
      lastBowelDays: bowelByPt[p.id] ?? null,
      careLoggedToday: patientsWithCareToday.has(p.id),
      latestVitals: vitalsByPt[p.id] ?? null,
    })
    return { p, ...a }
  }).sort((a, b) => b.score - a.score)

  const criticalResidents = ranked.filter(r => r.level === 'critical')
  const warningResidents = ranked.filter(r => r.level === 'warning')
  const attentionResidents = ranked.filter(r => r.level === 'critical' || r.level === 'warning')

  // High risk patients (engine critical/warning OR open incident OR risk flags)
  const highRiskPatients = patients.filter(p =>
    attentionResidents.some(r => r.p.id === p.id) ||
    openIncidents.some(i => i.patient_id === p.id) ||
    p.fall_risk === 'high' || p.pressure_risk === 'high'
  )

  // Barthel assessments in last 30 days
  const recentBarthel = assessments.filter(a =>
    a.scale === 'barthel' &&
    new Date(a.date).getTime() > Date.now() - 30 * 86400000
  )
  const patientsWithRecentBarthel = new Set(recentBarthel.map(a => a.patient_id))
  const pendingAssessments = patients.filter(p => !patientsWithRecentBarthel.has(p.id))

  // Occupation
  const patientsWithRoom = patients.filter(p => p.room_number)
  const occupancyPct = 100 // Will be meaningful once totalBeds is stored

  const ptDate = now.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const ptTime = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const NAME = user?.name?.split(' ')[0] || ''

  const shiftCfg = SHIFTS[shift]

  if (!isNH) {
    const instLabel = INST_LABELS[institution] || 'a tua instituição'
    return (
      <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0b1120', letterSpacing: '-0.02em' }}>
              {greet()}{NAME ? `, ${NAME}` : ''}.
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, textTransform: 'capitalize', minHeight: 18 }}>{mounted ? `${ptDate} · ${ptTime} · ${instLabel}` : instLabel}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 2 }}>{roleFocusLine(institution, role)}</div>
          </div>
          <LivePulseBadge />
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: institution === 'pharmacy_community' || institution === 'health_center' ? 'Utentes' : 'Doentes', value: loading ? '—' : patients.length, color: '#0b1120', bg: '#f9fafb', border: '#e5e7eb', href: '/patients' },
            { label: 'Ocorrências',  value: loading ? '—' : openIncidents.length,    color: openIncidents.length > 0 ? '#dc2626' : '#16a34a', bg: openIncidents.length > 0 ? '#fee2e2' : '#f0fdf4', border: openIncidents.length > 0 ? '#fecaca' : '#bbf7d0', href: '/incidents' },
            { label: 'Equipa ativa', value: loading ? '—' : teamMembers.length,      color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', href: '/schedule' },
          ].map(k => (
            <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: k.bg, border: `1.5px solid ${k.border}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: k.color, opacity: 0.75, marginTop: 4, fontWeight: 500 }}>{k.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Pulso operacional — sinais vivos das ferramentas de operações/legal */}
        <OperationalPulse supabase={supabase} userId={user?.id} institution={institution} />

        {/* Ecossistema completo da instituição — secções organizadas e adaptadas */}
        <div style={{ marginBottom: 20 }}>
          <InstitutionHub institution={institution} role={role} />
        </div>

        {/* Doentes a vigiar — motor de risco (polifarmácia, interações, condições) */}
        {attentionResidents.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #fffbeb', fontWeight: 700, fontSize: 13, color: '#0b1120', display: 'flex', alignItems: 'center', gap: 8 }}>
              Doentes a vigiar
              {criticalResidents.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: 5 }}>{criticalResidents.length} crítico{criticalResidents.length !== 1 ? 's' : ''}</span>}
            </div>
            {attentionResidents.slice(0, 8).map(({ p, score, level, signals }) => {
              const st = SEVERITY_STYLE[level]
              const top = signals.filter(s => s.severity === 'critical' || s.severity === 'warning').slice(0, 2)
              return (
                <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #f9fafb', textDecoration: 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: st.bg, border: `1.5px solid ${st.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: st.color }}>{score}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0b1120' }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: st.color, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{top.map(s => s.title).join(' · ') || st.label}</div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Open incidents (se houver) */}
        {openIncidents.length > 0 && (
          <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #fef2f2', fontWeight: 700, fontSize: 13, color: '#dc2626' }}>{openIncidents.length} ocorrência(s) em aberto</div>
            {openIncidents.slice(0, 5).map(inc => (
              <Link key={inc.id} href="/incidents" style={{ display: 'block', padding: '10px 16px', borderBottom: '1px solid #fef2f2', textDecoration: 'none', fontSize: 13, color: '#0b1120' }}>
                {INC_LABELS[inc.type] || inc.type} · {patients.find(p => p.id === inc.patient_id)?.name || 'Doente'}
              </Link>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
          Gere um Lar/ERPI? <Link href="/settings" style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}>Muda o tipo de instituição</Link> para o painel completo.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0b1120', letterSpacing: '-0.02em' }}>
            {greet()}{NAME ? `, ${NAME}` : ''}.
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, textTransform: 'capitalize', minHeight: 18 }}>
            {mounted ? `${ptDate} · ${ptTime}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: shiftCfg.bg, border: `1.5px solid ${shiftCfg.color}30`, borderRadius: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: shiftCfg.color }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: shiftCfg.color }}>{shiftCfg.label}</span>
          <span style={{ fontSize: 12, color: shiftCfg.color, opacity: 0.7 }}>{shiftCfg.hours}</span>
        </div>
      </div>

      {/* Centro de Turno CTA */}
      <Link href="/turno" style={{ textDecoration: 'none' }}>
        <div style={{ background: '#0d6e42', borderRadius: 14, padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>Centro de Turno</div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>Tarefas pendentes · ronda guiada · passagem de turno num só sítio</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.16)', padding: '8px 14px', borderRadius: 9, color: 'white', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
            Abrir <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </div>
      </Link>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Residentes',     value: loading ? '—' : patients.length, color: '#0b1120',  bg: '#f9fafb', border: '#e5e7eb', href: '/patients' },
          { label: 'Registos hoje',  value: loading ? '—' : careToday.length, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', href: '/care-log' },
          { label: 'Ocorrências',    value: loading ? '—' : openIncidents.length, color: openIncidents.length > 0 ? '#dc2626' : '#16a34a', bg: openIncidents.length > 0 ? '#fee2e2' : '#f0fdf4', border: openIncidents.length > 0 ? '#fecaca' : '#bbf7d0', href: '/incidents' },
          { label: 'Sem registo hoje', value: loading ? '—' : patientsWithoutCareToday.length, color: patientsWithoutCareToday.length > 0 ? '#d97706' : '#16a34a', bg: patientsWithoutCareToday.length > 0 ? '#fffbeb' : '#f0fdf4', border: patientsWithoutCareToday.length > 0 ? '#fde68a' : '#bbf7d0', href: '/care-log' },
          { label: 'Críticos',       value: loading ? '—' : criticalResidents.length, color: criticalResidents.length > 0 ? '#dc2626' : '#16a34a', bg: criticalResidents.length > 0 ? '#fef2f2' : '#f0fdf4', border: criticalResidents.length > 0 ? '#fecaca' : '#bbf7d0', href: '/rounds' },
          { label: 'Equipa ativa',   value: loading ? '—' : teamMembers.length, color: '#7c3aed', bg: '#faf5ff', border: '#e9d5ff', href: '/schedule' },
        ].map(k => (
          <Link key={k.label} href={k.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: k.bg, border: `1.5px solid ${k.border}`, borderRadius: 10, padding: '14px 16px', cursor: 'pointer', transition: 'opacity 0.15s' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: k.color, opacity: 0.75, marginTop: 4, fontWeight: 500 }}>{k.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pulso operacional — sala de espera, tarefas, stock, conformidade num relance */}
      <OperationalPulse supabase={supabase} userId={user?.id} institution={institution} />

      <div className="cockpit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Central de Risco: motor de ecossistema aplicado a todos os residentes ── */}
          {!loading && attentionResidents.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0b1120', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Central de risco
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: 5 }}>{criticalResidents.length} crítico{criticalResidents.length !== 1 ? 's' : ''}</span>
                  {warningResidents.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706', background: '#fffbeb', padding: '2px 7px', borderRadius: 5 }}>{warningResidents.length} a vigiar</span>}
                </div>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>análise automática</span>
              </div>
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                {attentionResidents.slice(0, 12).map(({ p, score, level, signals, summary }) => {
                  const st = SEVERITY_STYLE[level]
                  const top = signals.filter(s => s.severity === 'critical' || s.severity === 'warning').slice(0, 2)
                  return (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'block', padding: '11px 18px', borderBottom: '1px solid #f9fafb', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 9, background: st.bg, border: `1.5px solid ${st.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: st.color, lineHeight: 1 }}>{score}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0b1120', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {p.name}
                            {p.room_number && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 400 }}>Q.{p.room_number}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: st.color, fontWeight: 600 }}>{summary}</div>
                        </div>
                      </div>
                      {top.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7, paddingLeft: 50 }}>
                          {top.map((s, i) => {
                            const ss = SEVERITY_STYLE[s.severity]
                            return <span key={i} style={{ fontSize: 10.5, fontWeight: 600, color: ss.color, background: ss.bg, border: `1px solid ${ss.border}`, padding: '2px 7px', borderRadius: 5 }}>{s.title}</span>
                          })}
                          {signals.filter(s => s.severity === 'critical' || s.severity === 'warning').length > 2 && (
                            <span style={{ fontSize: 10.5, color: '#9ca3af', padding: '2px 4px' }}>+{signals.filter(s => s.severity === 'critical' || s.severity === 'warning').length - 2}</span>
                          )}
                        </div>
                      )}
                    </Link>
                  )
                })}
                {attentionResidents.length > 12 && (
                  <Link href="/rounds" style={{ display: 'block', padding: '10px 18px', textAlign: 'center', fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
                    Ver os {attentionResidents.length} residentes em alerta →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Residents needing attention this shift */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0b1120' }}>
                Residentes — {shiftCfg.short}
              </div>
              <Link href="/care-log" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver registo →</Link>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>A carregar...</div>
            ) : patients.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                Sem residentes. <Link href="/patients" style={{ color: '#2563eb' }}>Adicionar →</Link>
              </div>
            ) : (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {patients.slice(0, 20).map(p => {
                  const hasCarThisShift = patientsWithCareThisShift.has(p.id)
                  const hasOpenInc = openIncidents.some(i => i.patient_id === p.id)
                  const isHighRisk = p.fall_risk === 'high' || p.pressure_risk === 'high'
                  return (
                    <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid #f9fafb', textDecoration: 'none', transition: 'background 0.1s' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: hasCarThisShift ? '#f0fdf4' : '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                        {hasCarThisShift ? '✓' : '○'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0b1120', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {p.name}
                          {p.room_number && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 400 }}>Q.{p.room_number}</span>}
                          {hasOpenInc && <span style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Ocorrência</span>}
                          {isHighRisk && !hasOpenInc && <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>Alto risco</span>}
                        </div>
                        {p.conditions && <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.conditions}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: hasCarThisShift ? '#16a34a' : '#d97706', fontWeight: 600, flexShrink: 0 }}>
                        {hasCarThisShift ? 'Registado' : 'Pendente'}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Today's incidents */}
          {(openIncidents.length > 0 || todayIncidents.length > 0) && (
            <div style={{ background: '#fff', border: '1.5px solid #fecaca', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  {openIncidents.length} ocorrência{openIncidents.length !== 1 ? 's' : ''} em aberto
                </div>
                <Link href="/incidents" style={{ fontSize: 12, color: '#dc2626', textDecoration: 'none', fontWeight: 600 }}>Ver todas →</Link>
              </div>
              <div>
                {openIncidents.slice(0, 5).map(inc => {
                  const pat = patients.find(p => p.id === inc.patient_id)
                  return (
                    <Link key={inc.id} href="/incidents" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderBottom: '1px solid #fef2f2', textDecoration: 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEV_COLOR[inc.severity] || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0b1120' }}>{INC_LABELS[inc.type] || inc.type}</div>
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{pat?.name || 'Residente'} · {new Date(inc.date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: SEV_COLOR[inc.severity] || '#6b7280', background: '#fef2f2', padding: '2px 7px', borderRadius: 5 }}>
                        {inc.severity === 'critical' ? 'Crítico' : inc.severity === 'major' ? 'Grave' : inc.severity === 'moderate' ? 'Moderado' : 'Ligeiro'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick actions */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>Ações rápidas</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Reg. Diário', href: '/care-log', color: '#2563eb', bg: '#eff6ff' },
                { label: 'MAR',         href: '/mar',      color: '#16a34a', bg: '#f0fdf4' },
                { label: 'Passa-turno', href: '/handover', color: '#7c3aed', bg: '#faf5ff' },
                { label: 'Avaliação',   href: '/assessments', color: '#d97706', bg: '#fffbeb' },
                { label: 'Ocorrência',  href: '/incidents', color: '#dc2626', bg: '#fee2e2' },
                { label: 'Plano Cuid.', href: '/care-plans', color: '#0891b2', bg: '#ecfeff' },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration: 'none', padding: '10px 12px', background: a.bg, borderRadius: 8, display: 'block', transition: 'opacity 0.1s' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: a.color }}>{a.label}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* Pending assessments */}
          {isNH && pendingAssessments.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #fde68a', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>Barthel em falta</div>
                <Link href="/assessments" style={{ fontSize: 11, color: '#d97706', textDecoration: 'none', fontWeight: 600 }}>Avaliar →</Link>
              </div>
              <div style={{ padding: '8px 16px 12px', maxHeight: 180, overflowY: 'auto' }}>
                {pendingAssessments.slice(0, 8).map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #fef3c7' }}>
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{p.name}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{p.room_number ? `Q.${p.room_number}` : ''}</span>
                  </div>
                ))}
                {pendingAssessments.length > 8 && (
                  <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingTop: 6 }}>+{pendingAssessments.length - 8} mais</div>
                )}
              </div>
            </div>
          )}

          {/* Shift breakdown — today */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>Registos por turno · hoje</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {(['manha', 'tarde', 'noite'] as Shift[]).map(s => {
                const cfg = SHIFTS[s]
                const count = careToday.filter(r => r.shift === s).length
                const pct = patients.length > 0 ? Math.round((new Set(careToday.filter(r => r.shift === s).map(r => r.patient_id)).size / patients.length) * 100) : 0
                const isCurrent = s === shift
                return (
                  <div key={s}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: isCurrent ? cfg.color : '#6b7280', fontWeight: isCurrent ? 700 : 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                        {cfg.short}{isCurrent ? ' · atual' : ''}
                      </span>
                      <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{count} <span style={{ color: '#9ca3af', fontWeight: 400 }}>· {pct}%</span></span>
                    </div>
                    <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: cfg.color, borderRadius: 3, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Month stats */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 12 }}>Este mês</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Registos diários', value: careRecs.length, href: '/care-log' },
                { label: 'Ocorrências', value: thisMonthInc.length, href: '/incidents' },
                { label: 'Avaliações realizadas', value: assessments.length, href: '/assessments' },
              ].map(s => (
                <Link key={s.label} href={s.href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{s.value}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Team */}
          {teamMembers.length > 0 && (
            <div style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                Equipa <Link href="/schedule" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>Ver →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {teamMembers.slice(0, 5).map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#2563eb', flexShrink: 0 }}>
                      {m.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0b1120' }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>{m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Ecossistema do lar — gestão, famílias, legal e equipa (para além do cuidado) */}
      <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 4 }}>O lar como um todo</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Para além do cuidado clínico — gestão, famílias, conformidade e equipa.</div>
        <InstitutionHub institution={institution} role={role} />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @media (max-width: 768px) {
          .cockpit-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
