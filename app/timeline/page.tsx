'use client'

// ─── NOVO: app/timeline/page.tsx ─── Phlox Timeline
// A linha do tempo clínica inteligente. Agrega automaticamente:
// - Medicamentos adicionados e removidos (personal_meds + family_profile_meds)
// - Entradas do diário de sintomas (diary_entries)
// - Registos de análises laboratoriais (lab_records)
// - Alertas do Phlox Watcher (phlox_alerts)
// E por cima disso, a AI identifica correlações temporais que ninguém mais consegue ver.
// É a história clínica digital que nenhum outro produto oferece.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { getActiveProfile } from '@/lib/profileContext'
import { printDoc } from '@/lib/print'
import Link from 'next/link'
import RiskIndexCard from '@/components/RiskIndexCard'
import PushNudge from '@/components/PushNudge'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

// ─── Event types ──────────────────────────────────────────────────────────────

type EventType =
  | 'med_added' | 'med_removed'
  | 'symptom' | 'wellbeing'
  | 'lab_result'
  | 'alert' | 'interaction'
  | 'note'

interface TimelineEvent {
  id: string
  date: string          // ISO date
  type: EventType
  title: string
  detail?: string
  value?: number        // wellbeing 1-5, lab value, etc
  unit?: string
  severity?: 'critical' | 'high' | 'moderate' | 'info' | 'positive'
  source: string        // 'diary' | 'meds' | 'labs' | 'alerts'
  profileName?: string
}

interface Correlation {
  confidence: 'alta' | 'moderada' | 'baixa'
  type: 'temporal' | 'causal' | 'trend' | 'warning'
  finding: string
  events_involved: string[]
  recommendation: string
}

interface LabSeries {
  name: string
  unit: string
  values: { date: string; value: number; status: 'normal' | 'high' | 'low' | 'critical' }[]
  reference_range: string
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const EVENT_STYLE: Record<EventType, { color: string; bg: string; border: string; icon: string; label: string }> = {
  med_added:    { color:'var(--green)', bg:'var(--green-light)', border:'var(--green-mid)', icon:'pill', label:'Medicamento adicionado' },
  med_removed:  { color:'var(--red)', bg:'var(--badge-red-bg)', border:'var(--badge-red-border)', icon:'🗑',  label:'Medicamento removido' },
  symptom:      { color:'var(--amber)', bg:'var(--badge-amber-bg)', border:'var(--badge-amber-border)', icon:'stethoscope', label:'Sintoma registado' },
  wellbeing:    { color:'var(--roxo)', bg:'var(--roxo-claro)', border:'var(--roxo-borda)', icon:'💜', label:'Bem-estar' },
  lab_result:   { color:'var(--ink-2)', bg:'var(--bg-2)', border:'var(--border)', icon:'flask', label:'Análise' },
  alert:        { color:'var(--red)', bg:'var(--badge-red-bg)', border:'var(--badge-red-border)', icon:'alert', label:'Alerta' },
  interaction:  { color:'var(--badge-amber-fg)', bg:'var(--amber-light)', border:'var(--badge-amber-border)', icon:'bolt', label:'Interação detectada' },
  note:         { color:'var(--ink-3)', bg:'var(--bg-2)', border:'var(--border)', icon:'note', label:'Nota' },
}

const SEV_DOT: Record<string, string> = {
  critical: 'var(--red)', high: 'var(--amber)', moderate: 'var(--ink-3)', info: 'var(--ink-5)', positive: 'var(--green)'
}

const WELLBEING_EMOJI = ['', '😞', '😕', '😐', '🙂', '😊']

// ─── Sub-components ───────────────────────────────────────────────────────────

function LabChart({ series }: { series: LabSeries }) {
  if (series.values.length < 2) return null
  const vals = series.values.map(v => v.value)
  const min = Math.min(...vals) * 0.9
  const max = Math.max(...vals) * 1.1
  const range = max - min || 1
  const w = 280, h = 80, pad = 20

  const points = series.values.map((v, i) => ({
    x: pad + (i / (series.values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v.value - min) / range) * (h - pad * 2),
    ...v
  }))

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Evolução de {series.name} ({series.unit}) · ref: {series.reference_range}
      </div>
      <svg width={w} height={h} style={{ display: 'block' }}>
        <path d={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4}
              fill={p.status === 'normal' ? 'var(--green)' : p.status === 'critical' ? 'var(--red)' : 'var(--amber)'}
              stroke="white" strokeWidth="1.5" />
            <text x={p.x} y={h} textAnchor="middle" fontSize="7" fill="var(--ink-5)" fontFamily="monospace">
              {p.date.slice(5)}
            </text>
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="8" fill="var(--ink-3)" fontFamily="monospace">
              {p.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function CorrelationCard({ corr }: { corr: Correlation }) {
  const styles = {
    alta:     { bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', color: 'var(--red)', icon: '🔴', label: 'Alta confiança' },
    moderada: { bg: 'var(--amber-light)', border: 'var(--badge-amber-border)', color: 'var(--badge-amber-fg)', icon: '🟡', label: 'Confiança moderada' },
    baixa:    { bg: 'var(--bg-2)', border: 'var(--border)', color: 'var(--ink-2)', icon: '🔵', label: 'Baixa confiança' },
  }[corr.confidence]

  const typeIcon = { temporal: '⏱', causal: '🔗', trend: '📈', warning: '⚠️' }[corr.type]

  return (
    <div style={{ padding: '14px 16px', background: styles.bg, border: `1px solid ${styles.border}`, borderRadius: 'var(--r-lg)', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--t-corpo)' }}>{typeIcon}</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: styles.color, lineHeight: 1.4 }}>{corr.finding}</span>
        </div>
        <span style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color: styles.color, background: 'white', border: `1px solid ${styles.border}`, padding: '2px 6px', borderRadius: 'var(--r-sm)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
          {styles.label}
        </span>
      </div>
      <div style={{ fontSize: 'var(--t-meta)', color: styles.color, opacity: 0.85, lineHeight: 1.6, paddingLeft: 22 }}>
        → {corr.recommendation}
      </div>
    </div>
  )
}

function TimelineEventCard({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const s = EVENT_STYLE[event.type]

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* Line + dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: event.severity ? SEV_DOT[event.severity] : s.color, border: '2px solid white', boxShadow: '0 0 0 1px var(--border)', flexShrink: 0, zIndex: 1, marginTop: 14 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: 'var(--border)', marginTop: 4 }} />}
      </div>

      {/* Card */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 10, paddingLeft: 12 }}>
        <div onClick={() => setExpanded(!expanded)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
          role={event.detail ? 'button' : undefined}
          tabIndex={event.detail ? 0 : undefined}
          aria-expanded={event.detail ? expanded : undefined}
          style={{ background: 'white', border: `1px solid ${expanded ? s.border : 'var(--border)'}`, borderRadius: 'var(--r-md)', padding: '10px 14px', cursor: event.detail ? 'pointer' : 'default', transition: 'border-color 0.15s', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: event.detail && expanded ? 8 : 0 }}>
            <Icon name={s.icon} size={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>
                {event.title}
              </div>
              <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{new Date(event.date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {event.profileName && <span>· {event.profileName}</span>}
                <span style={{ color: s.color }}>· {s.label}</span>
              </div>
            </div>
            {event.value !== undefined && event.type === 'wellbeing' && (
              <span style={{ fontSize: 'var(--t-destaque)', flexShrink: 0 }}>{WELLBEING_EMOJI[event.value]}</span>
            )}
            {event.detail && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            )}
          </div>
          {expanded && event.detail && (
            <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-3)', lineHeight: 1.7, paddingLeft: 22, paddingTop: 4, borderTop: '1px solid var(--bg-3)', marginTop: 6 }}>
              {event.detail}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { user, supabase } = useAuth()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [labSeries, setLabSeries] = useState<LabSeries[]>([])
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [tab, setTab] = useState<'timeline' | 'labs' | 'correlations'>('timeline')
  const [filterType, setFilterType] = useState<EventType | 'all'>('all')
  const [profileName, setProfileName] = useState<string>('')
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [activeProfileType, setActiveProfileType] = useState<'self' | 'family' | 'patient'>('self')
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([])
  const [familyProfiles, setFamilyProfiles] = useState<{ id: string; name: string }[]>([])
  const [dateRange, setDateRange] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('6m')

  const load = useCallback(async (profileId?: string | null) => {
    // Note: uses activeProfileType from closure
    if (!user) return
    setLoading(true)
    const allEvents: TimelineEvent[] = []

    // ─── Date filter ───────────────────────────────────────────────────────
    const since = (() => {
      const d = new Date()
      if (dateRange === '1m')  d.setMonth(d.getMonth() - 1)
      if (dateRange === '3m')  d.setMonth(d.getMonth() - 3)
      if (dateRange === '6m')  d.setMonth(d.getMonth() - 6)
      if (dateRange === '1y')  d.setFullYear(d.getFullYear() - 1)
      if (dateRange === 'all') d.setFullYear(2020)
      return d.toISOString()
    })()

    // ─── Medicamentos pessoais ─────────────────────────────────────────────
    const isSelf = !profileId || profileId === 'self'
    const isPatient = activeProfileType === 'patient'
    const medTable = isPatient ? 'patient_meds' : (isSelf ? 'personal_meds' : 'family_profile_meds')
    const medCol   = isPatient ? 'patient_id' : (isSelf ? 'user_id' : 'profile_id')
    const medId    = isSelf ? user.id : profileId

    if (medId) {
      const { data: meds } = await supabase
        .from(medTable)
        .select('id, name, dose, frequency, created_at')
        .eq(medCol, medId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })

      ;(meds || []).forEach((m: any) => {
        allEvents.push({
          id: `med_${m.id}`, date: m.created_at, type: 'med_added',
          title: `${m.name}${m.dose ? ' ' + m.dose : ''}${m.frequency ? ' — ' + m.frequency : ''}`,
          detail: m.frequency ? `Frequência: ${m.frequency}` : undefined,
          source: 'meds', severity: 'positive',
          profileName: profileName || undefined,
        })
      })
    }

    // ─── Diário de sintomas (symptom_logs) ─────────────────────────────────
    // Próprio → profile_id null; perfil familiar → profile_id = id.
    {
      let sq = supabase.from('symptom_logs')
        .select('id, at, feeling, symptoms, pain, temperature, notes, profile_id')
        .eq('user_id', user.id)
        .gte('at', since)
        .order('at', { ascending: false })
      sq = (isSelf || isPatient) ? sq.is('profile_id', null) : sq.eq('profile_id', profileId)
      const { data: symptomLogs } = await sq
      ;(symptomLogs || []).forEach((e: any) => {
        if (e.symptoms?.length > 0) {
          allEvents.push({
            id: `sym_${e.id}`, date: e.at, type: 'symptom',
            title: e.symptoms.join(', '),
            detail: [e.pain != null ? `Dor: ${e.pain}/10` : '', e.temperature ? `Temp.: ${e.temperature}°C` : '', e.notes || ''].filter(Boolean).join(' · ') || undefined,
            source: 'symptoms',
            severity: (e.pain ?? 0) >= 7 ? 'high' : undefined,
            profileName: profileName || undefined,
          })
        }
        if (e.feeling) {
          allEvents.push({
            id: `feel_${e.id}`, date: e.at, type: 'wellbeing',
            title: `Como me senti: ${['', 'Muito mal', 'Mal', 'Razoável', 'Bem', 'Muito bem'][e.feeling]}`,
            value: e.feeling, source: 'symptoms',
            severity: e.feeling <= 2 ? 'high' : e.feeling >= 4 ? 'positive' : 'info',
            profileName: profileName || undefined,
          })
        }
      })
    }

    // ─── Diário (diary_entries) — a outra página de diário usa esta tabela.
    // Lemos ambas (symptom_logs + diary_entries) para não perder registos,
    // independentemente de a pessoa ter usado /sintomas ou /diary.
    if (isSelf) {
      const { data: diary } = await supabase.from('diary_entries')
        .select('id, entry_date, wellbeing, symptoms, notes')
        .eq('user_id', user.id)
        .gte('entry_date', since.split('T')[0])
        .order('entry_date', { ascending: false })
      ;(diary || []).forEach((e: any) => {
        if (e.symptoms?.length > 0) {
          allEvents.push({
            id: `diary_s_${e.id}`, date: e.entry_date, type: 'symptom',
            title: e.symptoms.join(', '), detail: e.notes || undefined, source: 'diary',
          })
        }
        if (e.wellbeing) {
          allEvents.push({
            id: `diary_w_${e.id}`, date: e.entry_date, type: 'wellbeing',
            title: `Bem-estar: ${['', 'Muito mau', 'Mau', 'Razoável', 'Bom', 'Muito bom'][e.wellbeing]}`,
            value: e.wellbeing, source: 'diary',
            severity: e.wellbeing <= 2 ? 'high' : e.wellbeing >= 4 ? 'positive' : 'info',
          })
        }
      })
    }

    // ─── Sinais vitais (vitals) — só perfil próprio ─────────────────────────
    if (isSelf) {
      const { data: vit } = await supabase.from('vitals')
        .select('id, recorded_at, bp_sys, bp_dia, hr, spo2, weight, glucose, temp')
        .eq('user_id', user.id)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
      ;(vit || []).forEach((v: any) => {
        const parts = [
          v.bp_sys && v.bp_dia ? `TA ${v.bp_sys}/${v.bp_dia}` : '',
          v.hr ? `FC ${v.hr}` : '', v.spo2 ? `SpO₂ ${v.spo2}%` : '',
          v.weight ? `${v.weight} kg` : '', v.glucose ? `Glic. ${v.glucose}` : '',
          v.temp ? `${v.temp}°C` : '',
        ].filter(Boolean)
        if (!parts.length) return
        const highBp = v.bp_sys >= 140 || v.bp_dia >= 90
        allEvents.push({
          id: `vit_${v.id}`, date: v.recorded_at, type: 'note',
          title: parts.join(' · '), source: 'vitals',
          severity: highBp ? 'moderate' : 'info',
          profileName: profileName || undefined,
        })
      })
    }

    // ─── Análises (lab_records) → eventos + séries para a aba de gráficos ────
    // BUG CORRIGIDO 2026-07-17 (item D19): lia de 'lab_results', tabela nunca
    // escrita por nada no código — esta secção nunca tinha dados na prática.
    // 'lab_records' é a tabela real (/registo grava lá); 'values' é um array
    // por relatório (vários testes por linha), não uma linha por teste.
    if (isSelf) {
      const { data: labs } = await supabase.from('lab_records')
        .select('id, date, values')
        .eq('user_id', user.id).is('profile_id', null)
        .gte('date', since.split('T')[0])
        .order('date', { ascending: false })

      const seriesMap: Record<string, LabSeries> = {}
      ;(labs || []).forEach((rec: any) => {
        ;((rec.values || []) as any[]).forEach((v: any, i: number) => {
          const num = Number(v.value)
          const status: 'normal' | 'high' | 'low' | 'critical' =
            v.status === 'CRITICO_ALTO' || v.status === 'CRITICO_BAIXO' ? 'critical'
            : v.status === 'ALTO' ? 'high' : v.status === 'BAIXO' ? 'low' : 'normal'
          allEvents.push({
            id: `lab_${rec.id}_${i}`, date: rec.date, type: 'lab_result',
            title: `${v.name}: ${v.value}${v.unit ? ' ' + v.unit : ''}`,
            detail: v.reference ? `Referência: ${v.reference}` : undefined,
            source: 'labs',
            severity: status === 'normal' ? undefined : status === 'critical' ? 'critical' : 'moderate',
            profileName: profileName || undefined,
          })
          // série temporal (precisa ≥2 pontos para gráfico)
          const key = v.name
          if (!key) return
          if (!seriesMap[key]) seriesMap[key] = { name: v.name, unit: v.unit || '', values: [], reference_range: v.reference || '—' }
          if (!isNaN(num)) seriesMap[key].values.push({ date: rec.date, value: num, status })
        })
      })
      // ordena cada série por data ascendente e guarda só as que têm ≥2 pontos
      const series = Object.values(seriesMap)
        .map(s => ({ ...s, values: s.values.sort((a, b) => a.date.localeCompare(b.date)) }))
        .filter(s => s.values.length >= 2)
      setLabSeries(series)
    } else {
      setLabSeries([])
    }

    // ─── Sort all events by date descending ───────────────────────────────
    allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    setEvents(allEvents)
    setLoading(false)
  }, [user, supabase, dateRange, profileName, activeProfileType])

  useEffect(() => { load(activeProfileId) }, [load, activeProfileId, dateRange])

  // Load selectable profiles on mount
  useEffect(() => {
    if (!user) return
    supabase.from('patients').select('id, name').eq('user_id', user.id).order('name').then(({ data }) => setPatients(data || []))
    supabase.from('family_profiles').select('id, name').eq('user_id', user.id).order('name').then(({ data }) => setFamilyProfiles(data || []))
  }, [user, supabase])

  // ─── Exportar PDF (para levar/enviar ao médico) — usa o printDoc partilhado ──
  const exportPDF = () => {
    if (events.length === 0) return
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
    // Agrupa por mês, como na vista, para o PDF sair organizado.
    const groups: { month: string; items: TimelineEvent[] }[] = []
    events.forEach(e => {
      const m = e.date.slice(0, 7)
      const g = groups.find(x => x.month === m)
      if (g) g.items.push(e); else groups.push({ month: m, items: [e] })
    })
    printDoc({
      docTitle: 'História de saúde',
      docSubtitle: profileName || user?.name || '',
      institution: 'Phlox',
      sections: groups.map(g => ({
        heading: new Date(g.month + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' }),
        records: [{ title: '', bullets: g.items.map(e => `${fmt(e.date)} — ${e.title}${e.detail ? ` (${e.detail})` : ''}`) }],
      })),
      footerNote: 'Gerado pelo Phlox a partir dos teus registos. Para informação, não substitui avaliação médica.',
    })
  }

  // ─── AI Correlations ──────────────────────────────────────────────────────

  const analyseCorrelations = async () => {
    if (events.length < 3) return
    setAnalysing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/timeline/correlations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          events: events.slice(0, 50).map(e => ({ date: e.date, type: e.type, title: e.title, severity: e.severity })),
          profile_name: profileName || 'utilizador',
        }),
      })
      const data = await res.json()
      if (data.correlations) {
        setCorrelations(data.correlations)
        setTab('correlations')
      }
    } catch {}
    setAnalysing(false)
  }

  const handleProfileChange = (id: string, name: string, type: 'self' | 'family' | 'patient') => {
    setActiveProfileId(id === 'self' ? null : id)
    setActiveProfileType(type)
    setProfileName(name)
    setCorrelations([])
  }

  // ─── Group events by month for the timeline ───────────────────────────────

  const filtered = events.filter(e => filterType === 'all' || e.type === filterType)

  const byMonth: { month: string; events: TimelineEvent[] }[] = []
  filtered.forEach(e => {
    const month = e.date.slice(0, 7)
    const existing = byMonth.find(m => m.month === month)
    if (existing) existing.events.push(e)
    else byMonth.push({ month, events: [e] })
  })

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  const monthLabel = (m: string) => new Date(m + '-01').toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

  const plan = (user?.plan || 'free') as string
  const canAnalyse = plan !== 'free'

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Linha do tempo</span>
        </BarraDeTrabalho>
      }
    >


      {/* Hero header */}
      <div style={{ background: 'var(--ink)', borderBottom: '1px solid var(--ink-2)' }}>
        <div className="page-container" style={{ paddingTop: 28, paddingBottom: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 2, background: 'var(--green)', borderRadius: 'var(--r-sm)' }} />
              A minha história de saúde
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', color: 'var(--bg-2)', fontWeight: 'var(--peso-normal)' as any, marginBottom: 4 }}>
              {profileName ? `Linha do tempo de ${profileName}` : 'A minha linha do tempo'}
            </div>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 520 }}>
              A tua medicação, análises, sintomas e sinais vitais reunidos numa linha do tempo — pronta para mostrares ao teu médico.
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {user && (
              <div style={{ position: 'relative' }}>
                <select
                  onChange={e => {
                    const val = e.target.value
                    if (val === 'self') {
                      handleProfileChange('self', user.name || 'Eu', 'self')
                    } else if (val.startsWith('fam:')) {
                      const id = val.slice(4)
                      const fp = familyProfiles.find(f => f.id === id)
                      if (fp) handleProfileChange(fp.id, fp.name, 'family')
                    } else if (val.startsWith('pat:')) {
                      const id = val.slice(4)
                      const pt = patients.find(p => p.id === id)
                      if (pt) handleProfileChange(pt.id, pt.name, 'patient')
                    }
                  }}
                  style={{ background: 'var(--ink-2)', color: 'var(--bg-3)', border: '1px solid var(--ink-3)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer', minWidth: 200 }}>
                  <option value="self">{user.name || 'Eu'} (pessoal)</option>
                  {familyProfiles.length > 0 && (
                    <optgroup label="Família">
                      {familyProfiles.map(fp => <option key={fp.id} value={`fam:${fp.id}`}>{fp.name}</option>)}
                    </optgroup>
                  )}
                  {patients.length > 0 && (
                    <optgroup label="Doentes">
                      {patients.map(p => <option key={p.id} value={`pat:${p.id}`}>{p.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            )}
            {/* Date range */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--ink-2)', borderRadius: 'var(--r-md)', padding: 3 }}>
              {([['1m','1 mês'], ['3m','3 meses'], ['6m','6 meses'], ['1y','1 ano'], ['all','Tudo']] as const).map(([v, l]) => (
                <button key={v} onClick={() => setDateRange(v)}
                  style={{ padding: '5px 10px', background: dateRange === v ? 'var(--ink-3)' : 'transparent', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: dateRange === v ? 'white' : 'var(--ink-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
                  {l}
                </button>
              ))}
            </div>
            {canAnalyse && events.length >= 3 && (
              <button onClick={analyseCorrelations} disabled={analysing}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: analysing ? 'var(--ink-2)' : 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', cursor: analysing ? 'wait' : 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                {analysing ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A organizar...</> : 'Preparar para o médico'}
              </button>
            )}
            {/* Fechar o ciclo do registo: mostrar tudo ao médico por QR seguro. */}
            <Link href="/passport" style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--ink-2)', color: 'var(--border)', border: '1px solid var(--ink-3)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              📲 Mostrar ao médico (QR)
            </Link>
            {events.length > 0 && (
              <button onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'var(--ink-2)', color: 'var(--border)', border: '1px solid var(--ink-3)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
                🖨 Exportar PDF
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderTop: '1px solid var(--ink-2)', overflowX: 'auto' }}>
            <button onClick={() => setTab('timeline')}
              style={{ ...tabStyle('timeline'), color: tab === 'timeline' ? 'var(--bg-2)' : 'var(--ink-3)', borderBottomColor: tab === 'timeline' ? 'var(--green)' : 'transparent' }}>
              Linha do tempo {events.length > 0 && `(${events.length})`}
            </button>
            <button onClick={() => setTab('labs')}
              style={{ ...tabStyle('labs'), color: tab === 'labs' ? 'var(--bg-2)' : 'var(--ink-3)', borderBottomColor: tab === 'labs' ? 'var(--green)' : 'transparent' }}>
              Análises {labSeries.length > 0 && `(${labSeries.length})`}
            </button>
            <button onClick={() => setTab('correlations')}
              style={{ ...tabStyle('correlations'), color: tab === 'correlations' ? 'var(--bg-2)' : 'var(--ink-3)', borderBottomColor: tab === 'correlations' ? 'var(--green)' : 'transparent' }}>
              Para o médico {correlations.length > 0 && <span style={{ background: 'var(--green)', color: 'white', fontSize: 'var(--t-micro)', padding: '1px 5px', borderRadius: 'var(--r-lg)', marginLeft: 4 }}>{correlations.length}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="page-container page-body">

        {/* Índice de Risco Contínuo (Pro) — a mesma fórmula partilhada com /familia,
            calculada automaticamente ao abrir a página, sem pedir nada ao utilizador. */}
        {canAnalyse && activeProfileType !== 'patient' && (
          <div style={{ marginBottom: 20 }}>
            <PushNudge text="Ativa notificações para saberes logo quando o teu Índice de Risco piorar." />
            <RiskIndexCard profileId={activeProfileType === 'family' ? (activeProfileId || undefined) : undefined} />
          </div>
        )}

        {/* TIMELINE */}
        {tab === 'timeline' && (
          <div>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
              <button onClick={() => setFilterType('all')}
                style={{ padding: '5px 12px', border: `1.5px solid ${filterType === 'all' ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 'var(--r-xl)', background: filterType === 'all' ? 'var(--ink)' : 'white', color: filterType === 'all' ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)' }}>
                Todos
              </button>
              {(Object.keys(EVENT_STYLE) as EventType[]).map(type => {
                const s = EVENT_STYLE[type]
                const count = events.filter(e => e.type === type).length
                if (count === 0) return null
                return (
                  <button key={type} onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: `1.5px solid ${filterType === type ? s.color : 'var(--border)'}`, borderRadius: 'var(--r-xl)', background: filterType === type ? s.bg : 'white', color: filterType === type ? s.color : 'var(--ink-3)', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)' }}>
                    <span><Icon name={s.icon} size={16} /></span> {s.label} <span style={{ opacity: 0.6 }}>({count})</span>
                  </button>
                )
              })}
            </div>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />)}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 'var(--r-xl)', padding: '56px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 8 }}>Sem eventos neste período</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px' }}>
                  A linha do tempo agrega medicamentos, sintomas do diário, análises e alertas. Começa por adicionar medicamentos ou registar sintomas.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link href="/mymeds" style={{ padding: '10px 18px', background: 'var(--ink)', color: 'white', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>
                    Adicionar medicamentos →
                  </Link>
                  <Link href="/diary" style={{ padding: '10px 18px', background: 'white', color: 'var(--ink)', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, border: '1px solid var(--border)' }}>
                    Registar sintomas →
                  </Link>
                </div>
              </div>
            ) : (
              <div>
                {byMonth.map(({ month, events: monthEvents }) => (
                  <div key={month} style={{ marginBottom: 24 }}>
                    {/* Month header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {monthLabel(month)}
                      </div>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{monthEvents.length} evento{monthEvents.length !== 1 ? 's' : ''}</div>
                    </div>
                    {/* Events */}
                    <div style={{ paddingLeft: 8 }}>
                      {monthEvents.map((event, i) => (
                        <TimelineEventCard key={event.id} event={event} isLast={i === monthEvents.length - 1} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* LABS */}
        {tab === 'labs' && (
          <div>
            {labSeries.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 8 }}>Sem análises registadas</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 20px' }}>
                  Quando adicionares resultados de análises via "/labs", a evolução temporal aparece aqui em gráficos de tendência.
                </div>
                <Link href="/labs" style={{ display: 'inline-block', padding: '10px 22px', background: 'var(--ink-2)', color: 'white', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>
                  Adicionar análises →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {labSeries.map(series => (
                  <div key={series.name} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{series.name}</div>
                      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{series.unit}</div>
                    </div>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>Ref: {series.reference_range}</div>
                    <LabChart series={series} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CORRELATIONS */}
        {tab === 'correlations' && (
          <div>
            {correlations.length === 0 ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 8 }}>Análise de correlações</div>
                <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 420, margin: '0 auto 20px' }}>
                  Com dados suficientes, o Phlox aponta <b>coincidências no tempo</b> nos teus registos — para levares à conversa com o médico. Não é diagnóstico nem interpretação clínica; é só uma forma de organizares a tua história.
                </div>
                {!canAnalyse ? (
                  <Link href="/pricing" style={{ display: 'inline-block', padding: '11px 24px', background: 'var(--green)', color: 'white', textDecoration: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any }}>
                    Activar Plus para análise IA →
                  </Link>
                ) : events.length < 3 ? (
                  <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    Precisa de pelo menos 3 eventos para analisar correlações.
                  </div>
                ) : (
                  <button onClick={analyseCorrelations} disabled={analysing}
                    style={{ padding: '11px 24px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)' }}>
                    {analysing ? 'A analisar...' : 'Analisar correlações agora'}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ padding: '12px 16px', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r-md)', marginBottom: 16, fontSize: 'var(--t-meta)', color: 'var(--amber)', lineHeight: 1.6 }}>
                  ⚠️ <b>Isto não é um diagnóstico.</b> São apenas <b>coincidências no tempo</b> que reparámos nos teus registos, para levares à conversa com o teu médico. O Phlox não é software médico, não interpreta nem substitui a avaliação de um profissional. <b>Nunca pares ou mudes medicação</b> com base nisto — fala primeiro com o teu médico ou farmacêutico.
                </div>
                {correlations.map((corr, i) => <CorrelationCard key={i} corr={corr} />)}
                <button onClick={analyseCorrelations} disabled={analysing}
                  style={{ marginTop: 8, padding: '10px 20px', background: 'white', color: 'var(--green)', border: '1px solid var(--green-mid)', borderRadius: 'var(--r-md)', cursor: 'pointer', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, fontFamily: 'var(--font-sans)' }}>
                  Re-analisar
                </button>
              </div>
            )}
          </div>
        )}

      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Mesa>
  )
}