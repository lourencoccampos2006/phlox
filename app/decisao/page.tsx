'use client'

// app/decisao/page.tsx — Phlox Decisão
// Simulador de raciocínio clínico dinâmico.
// O caso evolui baseado nas tuas decisões. O doente melhora ou piora.
// Cada acção tem consequências fisiológicas simuladas.
// Exclusivo no mercado — zero concorrentes em PT ou internacionalmente neste formato.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'menu' | 'briefing' | 'active' | 'result'
type Severity = 'stable' | 'worsening' | 'critical' | 'improving' | 'resolved' | 'deceased'

interface Vital {
  name: string
  value: string
  unit: string
  status: 'normal' | 'abnormal' | 'critical'
  trend: 'stable' | 'up' | 'down'
}

interface PatientState {
  name: string
  age: number
  sex: 'M' | 'F'
  chief_complaint: string
  background: string
  current_meds: string[]
  allergies: string[]
  vitals: Vital[]
  labs: { name: string; value: string; unit: string; status: 'normal' | 'abnormal' | 'critical' }[]
  narrative: string        // o que está a acontecer agora
  severity: Severity
  time_elapsed: number     // minutos desde início
  pending_results: string[] // resultados a aguardar
  available_actions: Action[]
}

interface Action {
  id: string
  label: string
  category: 'exam' | 'treatment' | 'consult' | 'monitor' | 'discharge' | 'free'
  consequence_preview?: string  // dica opcional
}

interface CaseEvent {
  time: number
  type: 'action' | 'update' | 'result' | 'alert' | 'system'
  content: string
  severity?: 'info' | 'warning' | 'critical' | 'success'
}

interface CaseConfig {
  id: string
  title: string
  specialty: string
  difficulty: 'intern' | 'resident' | 'specialist'
  difficultyLabel: string
  description: string
  color: string
  estimated_minutes: number
}

// ─── Case configs ─────────────────────────────────────────────────────────────

const CASE_CONFIGS: CaseConfig[] = [
  {
    id: 'chf_decompensation',
    title: 'Dispneia aguda no idoso',
    specialty: 'Cardiologia',
    difficulty: 'intern',
    difficultyLabel: 'Interno',
    description: 'Homem de 72 anos, FA conhecida, recorre à urgência por dispneia progressiva. A tua gestão define o outcome.',
    color: '#dc2626',
    estimated_minutes: 15,
  },
  {
    id: 'sepsis_antibiotics',
    title: 'Febre e hipotensão no internamento',
    specialty: 'Medicina Interna',
    difficulty: 'intern',
    difficultyLabel: 'Interno',
    description: 'Doente internado há 3 dias desenvolve febre, taquicardia e descida da TA. Horas críticas — cada decisão importa.',
    color: '#b45309',
    estimated_minutes: 20,
  },
  {
    id: 'dm_ketoacidosis',
    title: 'DM2 com vómitos e confusão',
    specialty: 'Endocrinologia',
    difficulty: 'resident',
    difficultyLabel: 'Residente',
    description: 'Mulher de 45 anos, DM2 insulinotratada, recorre à urgência com vómitos, confusão e hálito cetónico. Glicémia 450 mg/dL.',
    color: '#7c3aed',
    estimated_minutes: 20,
  },
  {
    id: 'anticoag_bleeding',
    title: 'Hemorragia no doente anticoagulado',
    specialty: 'Hemostase',
    difficulty: 'resident',
    difficultyLabel: 'Residente',
    description: 'Homem de 68 anos, varfarina por FA, chega à urgência com hematemese. INR de 8.2. Protocolo de reversão urgente.',
    color: '#1d4ed8',
    estimated_minutes: 15,
  },
  {
    id: 'pneumonia_abx',
    title: 'Pneumonia com resistência suspeita',
    specialty: 'Infecciologia',
    difficulty: 'specialist',
    difficultyLabel: 'Especialista',
    description: 'Mulher de 55 anos, internada com pneumonia, sem melhoria ao 3º dia de amoxicilina. Culturas pendentes. Escalar ou trocar?',
    color: '#0d6e42',
    estimated_minutes: 25,
  },
  {
    id: 'polypharmacy_elderly',
    title: 'Queda no doente polimedicado',
    specialty: 'Farmácia Clínica',
    difficulty: 'intern',
    difficultyLabel: 'Interno',
    description: 'Homem de 84 anos, 11 medicamentos, traz-se por queda. Qual dos medicamentos causou? Revisão farmacoterapêutica urgente.',
    color: '#0891b2',
    estimated_minutes: 20,
  },
  {
    id: 'anaphylaxis',
    title: 'Edema labial e estridor após antibiótico',
    specialty: 'Urgência',
    difficulty: 'intern',
    difficultyLabel: 'Interno',
    description: 'Mulher de 28 anos, 15 min após 1ª toma de amoxicilina. TA 78/40, estridor, SpO2 89%. Cada minuto conta.',
    color: '#dc2626',
    estimated_minutes: 12,
  },
  {
    id: 'ischemic_stroke',
    title: 'Hemiparesia direita há 1h45',
    specialty: 'Neurologia',
    difficulty: 'resident',
    difficultyLabel: 'Residente',
    description: 'Homem 64 anos, NIHSS 14, dentro da janela. TAC sem hemorragia. Trombolisar? Trombectomia? Janela e checklist.',
    color: '#0d6e42',
    estimated_minutes: 20,
  },
  {
    id: 'hyperkalemia',
    title: 'Hipercaliémia com alterações ECG',
    specialty: 'Nefrologia',
    difficulty: 'resident',
    difficultyLabel: 'Residente',
    description: 'Homem 76 anos, DRC4, K+ 7.2, T apiculadas e QRS largo. Ordem das intervenções importa — estabilizar antes de tudo.',
    color: '#b45309',
    estimated_minutes: 18,
  },
  {
    id: 'opioid_overdose',
    title: 'FR 6 e miose puntiforme em oncológico',
    specialty: 'Urgência',
    difficulty: 'intern',
    difficultyLabel: 'Interno',
    description: 'Homem 58 anos em morfina LP. FR 6/min, SpO2 82%. Dose de naloxona, via, repetição — escolhas que matam ou salvam.',
    color: '#1d4ed8',
    estimated_minutes: 14,
  },
]

// ─── Vital badge component ────────────────────────────────────────────────────
function VitalBadge({ vital }: { vital: Vital }) {
  const colors = { normal: '#0d6e42', abnormal: '#d97706', critical: '#dc2626' }
  const bgs = { normal: '#f0fdf5', abnormal: '#fffbeb', critical: '#fee2e2' }
  const borders = { normal: '#bbf7d0', abnormal: '#fde68a', critical: '#fca5a5' }
  const trendIcon = vital.trend === 'up' ? '↑' : vital.trend === 'down' ? '↓' : '→'

  return (
    <div style={{ padding: '8px 12px', background: bgs[vital.status], border: `1px solid ${borders[vital.status]}`, borderRadius: 8, minWidth: 90 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: colors[vital.status], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>{vital.name}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: colors[vital.status], lineHeight: 1 }}>{vital.value}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: colors[vital.status], opacity: 0.7 }}>{vital.unit}</span>
        <span style={{ fontSize: 12, color: colors[vital.status], marginLeft: 2 }}>{trendIcon}</span>
      </div>
    </div>
  )
}

// ─── Timeline event ───────────────────────────────────────────────────────────
function EventEntry({ event }: { event: CaseEvent }) {
  const styles = {
    info:     { color: '#1e40af', bg: '#eff6ff',  border: '#bfdbfe', dot: '#3b82f6' },
    warning:  { color: '#92400e', bg: '#fffbeb',  border: '#fde68a', dot: '#d97706' },
    critical: { color: '#991b1b', bg: '#fee2e2',  border: '#fca5a5', dot: '#dc2626' },
    success:  { color: '#14532d', bg: '#f0fdf5',  border: '#bbf7d0', dot: '#16a34a' },
  }
  const s = styles[event.severity || 'info']

  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--bg-3)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', marginBottom: 4 }}>{event.time}m</div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ padding: '8px 12px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 7 }}>
          <p style={{ fontSize: 13, color: s.color, lineHeight: 1.6, margin: 0 }}>{event.content}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Free-text action input ───────────────────────────────────────────────────
// Permite ao utilizador escrever qualquer ação clínica que queira tentar,
// mesmo as que o motor não listou (incluindo absurdas — o doente reage como
// um doente real reagiria, é assim que se aprende em segurança).
function FreeActionInput({ onSubmit, disabled }: { onSubmit: (txt: string) => void; disabled: boolean }) {
  const [val, setVal] = useState('')
  const submit = () => {
    const t = val.trim()
    if (!t || disabled) return
    onSubmit(t)
    setVal('')
  }
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Ex: Adrenalina 0.5 mg IM lateral coxa; ou pedir TAC-CE; ou chamar anestesia…"
        disabled={disabled}
        style={{ flex: 1, padding: '8px 12px', border: '1.5px solid #475569', borderRadius: 7, fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }}
      />
      <button onClick={submit} disabled={!val.trim() || disabled}
        style={{ padding: '8px 14px', background: val.trim() && !disabled ? '#475569' : 'var(--bg-3)', color: val.trim() && !disabled ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, cursor: val.trim() && !disabled ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
        Fazer →
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DecisaoPage() {
  const { user, supabase } = useAuth()
  const [phase, setPhase] = useState<Phase>('menu')
  const [selectedCase, setSelectedCase] = useState<CaseConfig | null>(null)
  const [patient, setPatient] = useState<PatientState | null>(null)
  const [events, setEvents] = useState<CaseEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [finalScore, setFinalScore] = useState<any>(null)
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const plan = (user as any)?.plan || 'free'
  const canPlay = plan !== 'free'

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  // Timer
  useEffect(() => {
    if (phase !== 'active') return
    timerRef.current = setInterval(() => setTimeElapsed(t => t + 1), 60000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const addEvent = useCallback((event: CaseEvent) => {
    setEvents(prev => [...prev, event])
  }, [])

  const startCase = async (caseConfig: CaseConfig) => {
    setSelectedCase(caseConfig)
    setLoading(true)
    setError('')
    setEvents([])
    setTimeElapsed(0)

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      const res = await fetch('/api/decisao/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ case_id: caseConfig.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()

      setPatient(data.patient)
      addEvent({ time: 0, type: 'system', content: `Caso iniciado: ${caseConfig.title}. O doente está à tua frente.`, severity: 'info' })
      setPhase('briefing')
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar caso.')
    } finally {
      setLoading(false)
    }
  }

  const takeAction = async (action: Action, freeText?: string) => {
    if (!patient || !selectedCase) return
    setActionLoading(true)

    const isFree = action.category === 'free'
    const labelShown = isFree ? (freeText || '').trim() : action.label

    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token

      addEvent({
        time: timeElapsed,
        type: 'action',
        content: `Decisão: ${labelShown}${isFree ? '  (texto livre)' : ''}`,
        severity: 'info',
      })

      const res = await fetch('/api/decisao/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          case_id: selectedCase.id,
          action_label: isFree ? freeText : action.label,
          free_text: isFree ? freeText : undefined,
          current_patient: patient,
          time_elapsed: timeElapsed,
          previous_events: events.slice(-8).map(e => e.content),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()

      // Update patient state
      setPatient(data.updated_patient)

      // Tempo do estado atualizado vem da AI (acrescenta minutos realistas)
      if (typeof data.updated_patient?.time_elapsed === 'number' && data.updated_patient.time_elapsed > timeElapsed) {
        setTimeElapsed(data.updated_patient.time_elapsed)
      }

      // Consequência imediata + mecanismo fisiopatológico
      if (data.immediate_consequence) {
        const sev: CaseEvent['severity'] = data.severity === 'death' ? 'critical' : data.severity || 'info'
        const txt = data.mechanism
          ? `${data.immediate_consequence}\n\n→ Porquê: ${data.mechanism}${data.evidence_note ? `\n→ Referência: ${data.evidence_note}` : ''}`
          : data.immediate_consequence
        addEvent({ time: timeElapsed, type: 'update', content: txt, severity: sev })
      }

      if (data.lab_results) {
        addEvent({ time: timeElapsed + 1, type: 'result', content: `Resultados: ${data.lab_results}`, severity: 'info' })
      }

      if (data.alert) {
        addEvent({ time: timeElapsed + 2, type: 'alert', content: data.alert, severity: 'critical' })
      }

      // Quando o caso acaba, chama o /end para ter debriefing completo.
      // Cobre estabilizado, óbito, alta — qualquer terminação.
      if (data.case_ended) {
        if (timerRef.current) clearInterval(timerRef.current)
        // Mostra evento de fim no log
        if (data.end_reason) {
          addEvent({ time: timeElapsed, type: 'system', content: `Fim do caso: ${data.end_reason}`, severity: data.severity === 'death' ? 'critical' : 'info' })
        }
        // Trigger debriefing
        try {
          const { data: sd2 } = await supabase.auth.getSession()
          const token2 = sd2?.session?.access_token
          const r2 = await fetch('/api/decisao/end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
            body: JSON.stringify({
              case_id: selectedCase.id,
              patient_final: data.updated_patient,
              events: [...events.map(e => e.content), `Acção final: ${labelShown}`, data.immediate_consequence || ''].filter(Boolean),
              time_elapsed: timeElapsed,
              end_reason: data.end_reason,
            }),
          })
          if (r2.ok) {
            const d2 = await r2.json()
            setFinalScore(d2.final_score)
          }
        } catch { /* fallback: deixa null, página de resultado lida com isso */ }
        setPhase('result')
      }

    } catch (e: any) {
      addEvent({ time: timeElapsed, type: 'system', content: `Erro: ${e.message}`, severity: 'warning' })
    } finally {
      setActionLoading(false)
    }
  }

  const endCase = async () => {
    if (!patient || !selectedCase) return
    setActionLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const token = sd?.session?.access_token
      const res = await fetch('/api/decisao/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          case_id: selectedCase.id,
          patient_final: patient,
          events: events.map(e => e.content),
          time_elapsed: timeElapsed,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      if (timerRef.current) clearInterval(timerRef.current)
      setFinalScore(data.final_score)
      setPhase('result')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  const reset = () => {
    setPhase('menu')
    setSelectedCase(null)
    setPatient(null)
    setEvents([])
    setTimeElapsed(0)
    setFinalScore(null)
    setError('')
  }

  const severityMeta: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
    stable: { label: 'Estável', color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0' },
    improving: { label: 'A melhorar', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
    worsening: { label: 'A piorar', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
    critical: { label: 'Crítico', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
    resolved: { label: 'Resolvido', color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0' },
    deceased: { label: 'Óbito', color: '#0b1120', bg: '#1f2937', border: '#0b1120' },
  }

  // ── MENU ────────────────────────────────────────────────────────────────────
  if (phase === 'menu') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body">

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Exclusivo Phlox</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,4vw,42px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 14 }}>Phlox Decisão</h1>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', lineHeight: 1.75, maxWidth: 580, marginBottom: 8 }}>
            O doente evolui conforme decides. Não é um quiz — é raciocínio clínico real sob pressão. Cada acção tem consequências fisiológicas simuladas.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              'O doente piora se decides mal',
              'Consequências farmacológicas reais',
              'Feedback de especialista no final',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--ink-4)' }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                {t}
              </div>
            ))}
          </div>
        </div>

        {!canPlay && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '28px', marginBottom: 32, display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Phlox Decisão — Student +</div>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: 0 }}>
                Simulação de raciocínio clínico com evolução dinâmica. Disponível a partir do plano Student (3,99€/mês).
              </p>
            </div>
            <Link href="/pricing"
              style={{ padding: '12px 24px', background: '#7c3aed', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
              Ver planos →
            </Link>
          </div>
        )}

        {/* Difficulty filter */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {[
            { id: 'all', label: 'Todos' },
            { id: 'intern', label: 'Interno' },
            { id: 'resident', label: 'Residente' },
            { id: 'specialist', label: 'Especialista' },
          ].map(d => (
            <button key={d.id} onClick={() => setDifficultyFilter(d.id)}
              style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${difficultyFilter === d.id ? 'var(--ink)' : 'var(--border)'}`, background: difficultyFilter === d.id ? 'var(--ink)' : 'white', color: difficultyFilter === d.id ? 'white' : 'var(--ink-4)', fontSize: 12, fontWeight: difficultyFilter === d.id ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.12s' }}>
              {d.label}
            </button>
          ))}
        </div>

        {/* Cases grid */}
        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#991b1b' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%,320px),1fr))', gap: 12 }}>
          {CASE_CONFIGS.filter(c => difficultyFilter === 'all' || c.difficulty === difficultyFilter).map(c => (
            <div key={c.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: 4, background: c.color }} />
              <div style={{ padding: '20px', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: c.color, background: `${c.color}15`, padding: '2px 8px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.specialty}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>~{c.estimated_minutes} min</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, lineHeight: 1.3, marginBottom: 8, letterSpacing: '-0.01em' }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.6, margin: '0 0 16px' }}>{c.description}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: c.difficulty === 'specialist' ? '#dc2626' : c.difficulty === 'resident' ? '#d97706' : '#0d6e42', background: c.difficulty === 'specialist' ? '#fee2e2' : c.difficulty === 'resident' ? '#fffbeb' : '#f0fdf5', padding: '2px 8px', borderRadius: 3 }}>{c.difficultyLabel}</span>
                </div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => canPlay ? startCase(c) : undefined}
                  disabled={loading || !canPlay}
                  style={{ width: '100%', padding: '11px', background: !canPlay ? 'var(--bg-3)' : loading && selectedCase?.id === c.id ? 'var(--bg-3)' : c.color, color: !canPlay ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: !canPlay ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s' }}>
                  {loading && selectedCase?.id === c.id ? 'A preparar caso...' : canPlay ? 'Iniciar →' : 'Student+'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── BRIEFING ────────────────────────────────────────────────────────────────
  if (phase === 'briefing' && patient && selectedCase) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container" style={{ padding: '40px 20px', maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Phlox Decisão · {selectedCase.specialty}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: '#f8fafc', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 4 }}>{selectedCase.title}</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#475569' }}>Lê o briefing. Quando estiveres pronto, inicia o caso.</div>
        </div>

        {/* Patient card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 16, color: '#94a3b8', flexShrink: 0 }}>{patient.name.charAt(0)}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>{patient.name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#64748b' }}>{patient.age} anos · {patient.sex === 'M' ? 'Masculino' : 'Feminino'}</div>
            </div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Queixa principal</div>
            <p style={{ fontSize: 15, color: '#f8fafc', lineHeight: 1.6, marginBottom: 16 }}>{patient.chief_complaint}</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Antecedentes relevantes</div>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 16 }}>{patient.background}</p>
            {patient.current_meds.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Medicação habitual</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {patient.current_meds.map(m => <span key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', background: '#334155', padding: '3px 10px', borderRadius: 4 }}>{m}</span>)}
                </div>
              </>
            )}
            {patient.allergies.length > 0 && (
              <>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ef4444', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Alergias</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {patient.allergies.map(a => <span key={a} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fca5a5', background: '#450a0a', padding: '3px 10px', borderRadius: 4 }}>{a}</span>)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Initial vitals */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Sinais vitais de entrada</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {patient.vitals.map(v => <VitalBadge key={v.name} vital={v} />)}
          </div>
        </div>

        <button onClick={() => setPhase('active')}
          style={{ width: '100%', padding: '15px', background: selectedCase.color, color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em' }}>
          Entrar no caso →
        </button>
      </div>
    </div>
  )

  // ── ACTIVE CASE ─────────────────────────────────────────────────────────────
  if (phase === 'active' && patient && selectedCase) {
    const sm = severityMeta[patient.severity]
    const actionCategories: Record<string, Action[]> = {}
    patient.available_actions.forEach(a => {
      if (!actionCategories[a.category]) actionCategories[a.category] = []
      actionCategories[a.category].push(a)
    })

    const catLabels: Record<string, string> = {
      exam: 'Pedir Exames',
      treatment: 'Tratar',
      consult: 'Consultar',
      monitor: 'Monitorizar',
      discharge: 'Destino',
      free: 'Outra acção (livre)',
    }
    const catColors: Record<string, string> = {
      exam: '#1d4ed8', treatment: '#0d6e42', consult: '#7c3aed',
      monitor: '#b45309', discharge: 'var(--ink)', free: '#475569',
    }

    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>


        {/* Case header */}
        <div style={{ background: '#0f172a', padding: '12px 0', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
          <div className="page-container">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Phlox Decisão · Em curso</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>{patient.name} · {patient.age}a</div>
              </div>
              {/* Severity */}
              <div style={{ padding: '5px 14px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sm.color, animation: patient.severity === 'critical' ? 'pulse-dot 1s infinite' : 'none' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: sm.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sm.label}</span>
              </div>
              {/* Timer */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#475569' }}>
                {timeElapsed < 60 ? `${timeElapsed} min` : `${Math.floor(timeElapsed / 60)}h${timeElapsed % 60 > 0 ? ` ${timeElapsed % 60}m` : ''}`}
              </div>
              <button onClick={endCase} disabled={actionLoading}
                style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #334155', borderRadius: 6, color: '#64748b', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                Terminar caso
              </button>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden', height: 'calc(100vh - 120px)' }} className="ward-grid">

          {/* Left: Patient state */}
          <div style={{ background: 'white', borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '16px' }}>
            {/* Vitals */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Sinais vitais</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {patient.vitals.map(v => <VitalBadge key={v.name} vital={v} />)}
              </div>
            </div>

            {/* Labs */}
            {patient.labs.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Resultados analíticos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {patient.labs.map(lab => {
                    const lc = lab.status === 'critical' ? '#dc2626' : lab.status === 'abnormal' ? '#d97706' : '#0d6e42'
                    return (
                      <div key={lab.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: lab.status !== 'normal' ? `${lc}08` : 'var(--bg-2)', borderRadius: 5, border: `1px solid ${lab.status !== 'normal' ? `${lc}30` : 'var(--border)'}` }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>{lab.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: lc, fontFamily: 'var(--font-mono)' }}>{lab.value} {lab.unit}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Pending */}
            {patient.pending_results.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>A aguardar</div>
                {patient.pending_results.map(r => (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', animation: 'pulse-dot 1.5s infinite', flexShrink: 0 }} />
                    {r}
                  </div>
                ))}
              </div>
            )}

            {/* Current narrative */}
            <div style={{ padding: '12px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sm.color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Estado actual</div>
              <p style={{ fontSize: 13, color: sm.color, lineHeight: 1.6, margin: 0 }}>{patient.narrative}</p>
            </div>
          </div>

          {/* Right: Events + Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
            {/* Events timeline */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {events.map((e, i) => <EventEntry key={i} event={e} />)}
              <div ref={eventsEndRef} />
            </div>

            {/* Actions */}
            <div style={{ borderTop: '2px solid var(--border)', padding: '12px 16px', background: 'white', flexShrink: 0 }}>
              {actionLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', justifyContent: 'center' }}>
                  <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>O caso está a evoluir...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(actionCategories).map(([cat, actions]) => {
                    const c = catColors[cat] || 'var(--ink-3)'
                    return (
                      <div key={cat}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{catLabels[cat] || cat}</div>
                        {cat === 'free' ? (
                          <FreeActionInput onSubmit={(txt) => takeAction(actions[0], txt)} disabled={actionLoading} />
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {actions.map(action => (
                              <button key={action.id} onClick={() => takeAction(action)}
                                style={{ padding: '7px 14px', background: 'white', border: `1.5px solid ${c}`, borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: c, fontFamily: 'var(--font-sans)', transition: 'all 0.1s', position: 'relative' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)' }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                                title={action.consequence_preview}>
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:0.4}} @media(max-width:768px){.ward-grid{grid-template-columns:1fr!important;height:auto!important}}`}</style>
      </div>
    )
  }

  // ── RESULT ──────────────────────────────────────────────────────────────────
  if (phase === 'result' && selectedCase) {
    const fs = finalScore || { score: 0, grade: 'Sem avaliação', overall_feedback: 'O motor de avaliação não respondeu. Os eventos do caso estão acima.', outcome: 'desconhecido' }
    const died = fs.outcome === 'óbito' || patient?.severity === 'deceased'
    return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        {/* Score */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: died ? '#1f2937' : '#0f172a', padding: '28px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: died ? '#fca5a5' : '#475569', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 16 }}>
              {died ? '✟ Doente faleceu' : 'Caso concluído'}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 72, color: '#f8fafc', lineHeight: 1 }}>{fs.score}<span style={{ fontSize: 24, color: '#475569' }}>/100</span></div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 22, fontWeight: 800, color: fs.score >= 80 ? '#22c55e' : fs.score >= 60 ? '#d97706' : '#ef4444', marginTop: 8 }}>
              {fs.grade}
            </div>
            {fs.outcome_summary && (
              <p style={{ fontSize: 13, color: '#cbd5e1', marginTop: 14, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.55 }}>{fs.outcome_summary}</p>
            )}
          </div>
          <div style={{ padding: '24px' }}>
            <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.75, marginBottom: 20 }}>{fs.overall_feedback}</p>

            {fs.time_assessment && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#d97706', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Análise de tempo</div>
                <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.55 }}>{fs.time_assessment}</div>
              </div>
            )}

            {fs.correct_decisions?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Decisões correctas</div>
                {fs.correct_decisions.map((d: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 7, marginBottom: 6 }}>
                    <span style={{ color: '#0d6e42', fontSize: 14, flexShrink: 0 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#14532d', lineHeight: 1.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.critical_errors?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Erros críticos — o que nunca fazer</div>
                {fs.critical_errors.map((e: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 7, marginBottom: 6 }}>
                    <span style={{ color: '#dc2626', fontSize: 14, flexShrink: 0 }}>✗</span>
                    <span style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{e}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.missed_opportunities?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#b45309', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>O que faltou</div>
                {fs.missed_opportunities.map((m: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, marginBottom: 6 }}>
                    <span style={{ color: '#b45309', fontSize: 14, flexShrink: 0 }}>!</span>
                    <span style={{ fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>{m}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.teaching_points?.length > 0 && (
              <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderLeft: '3px solid #7c3aed', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#7c3aed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>Pontos de aprendizagem</div>
                {fs.teaching_points.map((tp: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < fs.teaching_points.length - 1 ? 8 : 0 }}>
                    <span style={{ color: '#7c3aed', fontSize: 12, flexShrink: 0, marginTop: 1 }}>◆</span>
                    <span style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{tp}</span>
                  </div>
                ))}
              </div>
            )}

            {fs.key_references?.length > 0 && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Referências</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {fs.key_references.map((r: string, i: number) => (
                    <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 10 }}>{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset}
            style={{ flex: 1, padding: '13px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            Tentar outro caso →
          </button>
          <button onClick={() => { setPhase('briefing') }}
            style={{ padding: '13px 20px', background: 'white', border: '1px solid var(--border)', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--ink-3)' }}>
            Rever caso
          </button>
        </div>
      </div>
    </div>
    )
  }

  return null
}