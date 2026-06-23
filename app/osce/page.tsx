'use client'

// ─── PHLOX OSCE ───────────────────────────────────────────────────────────────
// Simulação de OSCE (Objective Structured Clinical Examination).
// O exame prático que todos os estudantes de saúde têm de fazer
// e que nenhuma plataforma no mundo simula bem.
//
// O estudante entra numa "estação":
// 1. Recebe briefing (quem é o doente, o que tem de fazer)
// 2. Faz anamnese — a AI faz de doente e responde às perguntas
// 3. Executa checklist de exame físico
// 4. Formula diagnóstico + plano
// 5. Recebe feedback por item como num OSCE real
//
// Funciona para todos os cursos: Medicina, Farmácia, Enfermagem, Nutrição, Fisioterapia

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import { logStudy } from '@/lib/studyProgress'

// ─── Types ────────────────────────────────────────────────────────────────────

type OSCEPhase = 'setup' | 'briefing' | 'anamnesis' | 'checklist' | 'diagnosis' | 'feedback'
type Course = 'medicine' | 'pharmacy' | 'nursing' | 'nutrition' | 'physiotherapy' | 'dentistry'

interface OSCEStation {
  id: string
  title: string
  course: Course
  station_type: 'history_taking' | 'physical_exam' | 'counselling' | 'procedure' | 'communication'
  difficulty: 'basic' | 'intermediate' | 'advanced'
  duration_minutes: number
  patient_briefing: string     // o que o examinador diz ao estudante
  patient_persona: string      // a AI usa isto para responder como doente
  checklist_items: { item: string; marks: number; mandatory: boolean }[]
  model_diagnosis?: string
  model_plan?: string
}

interface AnamnesisMessage { role: 'student' | 'patient'; content: string }

interface ChecklistResult { item: string; done: boolean; marks: number; mandatory: boolean }

interface OSCEFeedback {
  anamnesis_score: number
  anamnesis_feedback: string
  checklist_score: number
  checklist_feedback: string
  diagnosis_score: number
  diagnosis_feedback: string
  total_score: number
  max_score: number
  percentage: number
  grade: string
  strengths: string[]
  improvements: string[]
  model_answer: string
  questions_missed?: string[]
  red_flags_missed?: string[]
  next_station_tip?: string
}

const COURSES: { id: Course; label: string; icon: string; color: string }[] = [
  { id: 'medicine',      label: 'Medicina',       icon: '⚕️', color: '#dc2626' },
  { id: 'pharmacy',      label: 'Farmácia',        icon: '💊', color: '#0d6e42' },
  { id: 'nursing',       label: 'Enfermagem',      icon: '💉', color: '#7c3aed' },
  { id: 'nutrition',     label: 'Nutrição',        icon: '🥗', color: '#65a30d' },
  { id: 'physiotherapy', label: 'Fisioterapia',    icon: '🏃', color: '#0891b2' },
  { id: 'dentistry',     label: 'Medicina Dentária',icon: '🦷',color: '#d97706' },
]

const STATION_TYPES = {
  history_taking: { label: 'Anamnese',              icon: '🗣' },
  physical_exam:  { label: 'Exame físico',           icon: '🩺' },
  counselling:    { label: 'Aconselhamento',         icon: '💬' },
  procedure:      { label: 'Procedimento',           icon: '🔬' },
  communication:  { label: 'Comunicação de más notícias', icon: '❤️' },
}

const DIFF_META = {
  basic:        { label: 'Básico',        color: '#0d6e42', bg: '#d1fae5' },
  intermediate: { label: 'Intermédio',    color: '#d97706', bg: '#fef9c3' },
  advanced:     { label: 'Avançado',      color: '#dc2626', bg: '#fee2e2' },
}

const GRADE_META: Record<string, { color: string; label: string; emoji: string }> = {
  'A': { color: '#0d6e42', label: 'Excelente', emoji: '🏆' },
  'B': { color: '#16a34a', label: 'Muito bom',  emoji: '⭐' },
  'C': { color: '#d97706', label: 'Suficiente', emoji: '📚' },
  'D': { color: '#dc2626', label: 'Insuficiente',emoji: '💪' },
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function OSCETimer({ totalSeconds, onExpire }: { totalSeconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(totalSeconds)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    ref.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) { onExpire(); return 0 }
        return r - 1
      })
    }, 1000)
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [onExpire])

  const pct = (remaining / totalSeconds) * 100
  const color = pct > 50 ? '#0d6e42' : pct > 25 ? '#d97706' : '#dc2626'
  const m = Math.floor(remaining / 60)
  const s = remaining % 60

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 1s linear' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color, minWidth: 44, textAlign: 'right' }}>
        {m}:{s.toString().padStart(2, '0')}
      </span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OSCEPage() {
  const { user, supabase } = useAuth()
  const [phase, setPhase] = useState<OSCEPhase>('setup')
  const [course, setCourse] = useState<Course>('medicine')
  const [stationType, setStationType] = useState<OSCEStation['station_type']>('history_taking')
  const [difficulty, setDifficulty] = useState<OSCEStation['difficulty']>('intermediate')
  const [station, setStation] = useState<OSCEStation | null>(null)
  const [anamnesisMessages, setAnamnesisMessages] = useState<AnamnesisMessage[]>([])
  const [input, setInput] = useState('')
  const [checklistResults, setChecklistResults] = useState<ChecklistResult[]>([])
  const [diagnosis, setDiagnosis] = useState('')
  const [plan, setPlan] = useState('')
  const [feedback, setFeedback] = useState<OSCEFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const [timerExpired, setTimerExpired] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const plan_user = (user?.plan || 'free') as string
  const isStudent = plan_user === 'student' || plan_user === 'pro' || plan_user === 'clinic'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [anamnesisMessages])

  const generateStation = async () => {
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/osce/station', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ course, station_type: stationType, difficulty }),
      })
      const data = await res.json()
      setStation(data)
      setChecklistResults(data.checklist_items.map((item: any) => ({ ...item, done: false })))
      setPhase('briefing')
    } catch {}
    setLoading(false)
  }

  const sendAnamnesisMessage = async () => {
    if (!input.trim() || !station) return
    const studentMsg: AnamnesisMessage = { role: 'student', content: input.trim() }
    const newMessages = [...anamnesisMessages, studentMsg]
    setAnamnesisMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/osce/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ persona: station.patient_persona, messages: newMessages, course }),
      })
      const data = await res.json()
      setAnamnesisMessages(p => [...p, { role: 'patient', content: data.response }])
    } catch {}
    setLoading(false)
  }

  const submitForFeedback = async () => {
    if (!station) return
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/osce/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({
          station, course,
          anamnesis_messages: anamnesisMessages,
          checklist_results: checklistResults,
          student_diagnosis: diagnosis,
          student_plan: plan,
        }),
      })
      const data = await res.json()
      setFeedback(data)
      setPhase('feedback')
      logStudy({ kind: 'osce', area: course, correct: (data.percentage ?? 0) >= 60, xp: Math.max(20, Math.round((data.percentage ?? 0) / 2)) })
      // Save to Supabase
      if (user) {
        const { error: studySessionError } = await supabase.from('study_sessions').insert({
          user_id: user.id, type: 'case', drug_class: `OSCE: ${station.title}`,
          xp_earned: Math.round((data.percentage / 100) * 50),
          metadata: { osce: true, course, station_type: stationType, score: data.percentage },
        })

        if (studySessionError) {
          // ignore save errors for optional analytics write
        }
      }
    } catch {}
    setLoading(false)
  }

  const selectedCourse = COURSES.find(c => c.id === course)!

  if (!isStudent) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      <div className="page-container page-body" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🩺</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>Phlox OSCE</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
            Simulação de OSCE para todos os cursos de saúde. Medicina, Farmácia, Enfermagem, Nutrição, Fisioterapia. A AI faz de doente. Tu fazes de profissional. Com timer e feedback estação por estação.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#7c3aed', color: 'white', textDecoration: 'none', padding: '13px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700 }}>
            Ver plano Plus →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>


      {/* Setup */}
      {phase === 'setup' && (
        <div className="page-container page-body" style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#7c3aed', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 2, background: '#7c3aed', borderRadius: 1 }} />Phlox OSCE · Plus
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, marginBottom: 8 }}>
              Simulação de OSCE
            </h1>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, maxWidth: 520 }}>
              Escolhe o teu curso, o tipo de estação e a dificuldade. A AI gera a estação, faz de doente, e avalia o teu desempenho item por item — exactamente como num OSCE real.
            </p>
          </div>

          {/* Course */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Curso</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%,160px),1fr))', gap: 8 }}>
              {COURSES.map(c => (
                <button key={c.id} onClick={() => setCourse(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1.5px solid ${course === c.id ? c.color : 'var(--border)'}`, borderRadius: 8, background: course === c.id ? `${c.color}10` : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: course === c.id ? 700 : 500, color: course === c.id ? c.color : 'var(--ink)' }}>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Station type */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Tipo de estação</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {Object.entries(STATION_TYPES).map(([id, meta]) => (
                <button key={id} onClick={() => setStationType(id as any)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1.5px solid ${stationType === id ? selectedCourse.color : 'var(--border)'}`, borderRadius: 8, background: stationType === id ? `${selectedCourse.color}10` : 'white', cursor: 'pointer', fontSize: 12, fontWeight: stationType === id ? 700 : 400, color: stationType === id ? selectedCourse.color : 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                  <span>{meta.icon}</span>{meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Dificuldade</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.entries(DIFF_META).map(([id, meta]) => (
                <button key={id} onClick={() => setDifficulty(id as any)}
                  style={{ flex: 1, padding: '10px', border: `1.5px solid ${difficulty === id ? meta.color : 'var(--border)'}`, borderRadius: 8, background: difficulty === id ? meta.bg : 'white', cursor: 'pointer', fontSize: 13, fontWeight: difficulty === id ? 700 : 400, color: difficulty === id ? meta.color : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={generateStation} disabled={loading}
            style={{ width: '100%', padding: '14px', background: loading ? 'var(--bg-3)' : selectedCourse.color, color: 'white', border: 'none', borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A gerar estação OSCE...</> : `${selectedCourse.icon} Iniciar estação OSCE →`}
          </button>
        </div>
      )}

      {/* Briefing */}
      {phase === 'briefing' && station && (
        <div className="page-container page-body" style={{ maxWidth: 680 }}>
          <div style={{ background: selectedCourse.color, borderRadius: '12px 12px 0 0', padding: '24px 28px', color: 'white' }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.7 }}>
              OSCE · {selectedCourse.label} · {STATION_TYPES[station.station_type].label} · {DIFF_META[station.difficulty].label}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, marginBottom: 4 }}>{station.title}</div>
            <div style={{ fontSize: 12, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>{station.duration_minutes} minutos · {station.checklist_items.length} items na checklist</div>
          </div>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '24px 28px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>📋 Briefing do examinador</div>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '16px 18px', marginBottom: 20 }}>
              <p style={{ fontSize: 15, color: '#78350f', lineHeight: 1.8, margin: 0, fontFamily: 'var(--font-serif)' }}>{station.patient_briefing}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {[
                `⏱ Tens ${station.duration_minutes} minutos`,
                `${STATION_TYPES[station.station_type].icon} Estação de ${STATION_TYPES[station.station_type].label.toLowerCase()}`,
                `📊 Avaliação por checklist + diagnóstico`,
                '🤖 A AI responde como o doente em tempo real',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--ink-3)' }}>{item}</div>
              ))}
            </div>

            <button onClick={() => setPhase('anamnesis')}
              style={{ width: '100%', padding: '14px', background: selectedCourse.color, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Entrar na estação →
            </button>
          </div>
        </div>
      )}

      {/* Anamnesis — chat with AI patient */}
      {phase === 'anamnesis' && station && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
          {/* Station header */}
          <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '12px 0', flexShrink: 0 }}>
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{station.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{selectedCourse.label} · {STATION_TYPES[station.station_type].label}</div>
              </div>
              <div style={{ minWidth: 200 }}>
                {!timerExpired && <OSCETimer totalSeconds={station.duration_minutes * 60} onExpire={() => { setTimerExpired(true); setPhase('checklist') }} />}
                {timerExpired && <span style={{ fontSize: 12, color: '#dc2626', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>⏰ Tempo esgotado</span>}
              </div>
              <button onClick={() => setPhase('checklist')}
                style={{ padding: '8px 16px', background: selectedCourse.color, color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                Avançar →
              </button>
            </div>
          </div>

          {/* Chat */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
            <div className="page-container" style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Patient intro */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍⚕️</div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '12px 14px', maxWidth: '80%' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Doente</div>
                  <div style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.6 }}>Olá, bom dia. Estou aqui porque {station.patient_briefing.toLowerCase().includes('dor') ? 'tenho tido muitas dores' : 'não me tenho sentido bem'}...</div>
                </div>
              </div>

              {anamnesisMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'student' ? 'flex-end' : 'flex-start', gap: 10 }}>
                  {msg.role === 'patient' && <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍⚕️</div>}
                  <div style={{ maxWidth: '78%', padding: '12px 14px', background: msg.role === 'student' ? selectedCourse.color : 'white', border: msg.role === 'patient' ? '1px solid var(--border)' : 'none', borderRadius: msg.role === 'student' ? '12px 12px 4px 12px' : '4px 12px 12px 12px', color: msg.role === 'student' ? 'white' : 'var(--ink)' }}>
                    {msg.role === 'patient' && <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Doente</div>}
                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>{msg.content}</div>
                  </div>
                  {msg.role === 'student' && <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${selectedCourse.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: selectedCourse.color, flexShrink: 0 }}>Tu</div>}
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🧑‍⚕️</div>
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '14px', display: 'flex', gap: 5 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ink-4)', animation: `bounce 0.9s ease ${i * 0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div style={{ background: 'white', borderTop: '1px solid var(--border)', padding: '12px 0', flexShrink: 0 }}>
            <div className="page-container" style={{ maxWidth: 680, display: 'flex', gap: 8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAnamnesisMessage()}
                placeholder="Faz uma pergunta ao doente..." disabled={loading}
                style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <button onClick={sendAnamnesisMessage} disabled={!input.trim() || loading}
                style={{ padding: '12px 20px', background: input.trim() && !loading ? selectedCourse.color : 'var(--bg-3)', color: input.trim() && !loading ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checklist */}
      {phase === 'checklist' && station && (
        <div className="page-container page-body" style={{ maxWidth: 680 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Checklist de avaliação</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Marca os itens que realizaste durante a estação</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {checklistResults.map((item, i) => (
              <div key={i} onClick={() => setChecklistResults(p => p.map((x, j) => j === i ? { ...x, done: !x.done } : x))}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'white', border: `1.5px solid ${item.done ? '#6ee7b7' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s' }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${item.done ? '#0d6e42' : 'var(--border)'}`, background: item.done ? '#d1fae5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  {item.done && <span style={{ fontSize: 12, color: '#0d6e42' }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{item.item}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                    {item.marks} ponto{item.marks !== 1 ? 's' : ''}{item.mandatory ? ' · obrigatório' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Score preview */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>Itens completados</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: selectedCourse.color }}>
              {checklistResults.filter(x => x.done).length}/{checklistResults.length}
            </span>
          </div>

          <button onClick={() => setPhase('diagnosis')}
            style={{ width: '100%', padding: '13px', background: selectedCourse.color, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            Avançar para diagnóstico →
          </button>
        </div>
      )}

      {/* Diagnosis */}
      {phase === 'diagnosis' && station && (
        <div className="page-container page-body" style={{ maxWidth: 680 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Diagnóstico e plano</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Com base na tua avaliação, formula o diagnóstico e o plano de actuação</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                {course === 'pharmacy' ? 'Problema farmacoterapêutico / Recomendação' : course === 'nursing' ? 'Diagnóstico de enfermagem / Intervenção' : course === 'nutrition' ? 'Estado nutricional / Plano dietético' : 'Diagnóstico'}
              </div>
              <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                placeholder="Formula o teu diagnóstico com base na anamnese..."
                rows={3} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Plano de actuação</div>
              <textarea value={plan} onChange={e => setPlan(e.target.value)}
                placeholder="Descreve o que recomendas — tratamento, monitorização, seguimento, educação do doente..."
                rows={4} style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
            </div>
          </div>

          <button onClick={submitForFeedback} disabled={loading || !diagnosis.trim()}
            style={{ marginTop: 16, width: '100%', padding: '13px', background: diagnosis.trim() && !loading ? selectedCourse.color : 'var(--bg-3)', color: diagnosis.trim() && !loading ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />A avaliar...</> : 'Submeter e ver avaliação →'}
          </button>
        </div>
      )}

      {/* Feedback */}
      {phase === 'feedback' && feedback && station && (
        <div className="page-container page-body" style={{ maxWidth: 700 }}>
          {/* Score header */}
          <div style={{ background: selectedCourse.color, borderRadius: 12, padding: '24px 28px', marginBottom: 14, color: 'white', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 8 }}>{GRADE_META[feedback.grade]?.emoji || '📊'}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 48, fontWeight: 400, marginBottom: 4 }}>{feedback.percentage}%</div>
            <div style={{ fontSize: 18, fontWeight: 700, opacity: 0.9, marginBottom: 4 }}>
              {GRADE_META[feedback.grade]?.label || 'Avaliado'} — Classificação {feedback.grade}
            </div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{feedback.total_score}/{feedback.max_score} pontos</div>
          </div>

          {/* Breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Anamnese', score: feedback.anamnesis_score, icon: '🗣' },
              { label: 'Checklist', score: feedback.checklist_score, icon: '📋' },
              { label: 'Diagnóstico', score: feedback.diagnosis_score, icon: '🔬' },
            ].map(s => (
              <div key={s.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.score >= 70 ? '#0d6e42' : s.score >= 50 ? '#d97706' : '#dc2626' }}>{s.score}%</div>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Detailed feedback */}
          {[
            { label: 'Anamnese', feedback: feedback.anamnesis_feedback, score: feedback.anamnesis_score },
            { label: 'Checklist', feedback: feedback.checklist_feedback, score: feedback.checklist_score },
            { label: 'Diagnóstico', feedback: feedback.diagnosis_feedback, score: feedback.diagnosis_score },
          ].map(item => (
            <div key={item.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: item.score >= 70 ? '#0d6e42' : item.score >= 50 ? '#d97706' : '#dc2626' }}>{item.score}%</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7 }}>{item.feedback}</div>
            </div>
          ))}

          {/* Strengths + improvements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>✓ Pontos fortes</div>
              {feedback.strengths.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#14532d', lineHeight: 1.6, marginBottom: 4 }}>· {s}</div>)}
            </div>
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>→ A melhorar</div>
              {feedback.improvements.map((s, i) => <div key={i} style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6, marginBottom: 4 }}>· {s}</div>)}
            </div>
          </div>

          {/* Perguntas que faltaram */}
          {feedback.questions_missed && feedback.questions_missed.length > 0 && (
            <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>✗ Perguntas-chave que faltaram</div>
              {feedback.questions_missed.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 4 }}>· {s}</div>)}
            </div>
          )}

          {/* Red flags */}
          {feedback.red_flags_missed && feedback.red_flags_missed.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>🚩 Sinais de alarme a procurar</div>
              {feedback.red_flags_missed.map((s, i) => <div key={i} style={{ fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.6, marginBottom: 4 }}>· {s}</div>)}
            </div>
          )}

          {/* Model answer */}
          <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>💎 Resposta modelo</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{feedback.model_answer}</div>
          </div>

          {/* Dica para a próxima */}
          {feedback.next_station_tip && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>💡 Para a próxima</div>
              <div style={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>{feedback.next_station_tip}</div>
            </div>
          )}

          <button onClick={() => { setPhase('setup'); setStation(null); setAnamnesisMessages([]); setChecklistResults([]); setDiagnosis(''); setPlan(''); setFeedback(null); setTimerExpired(false) }}
            style={{ width: '100%', padding: '13px', background: selectedCourse.color, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            Nova estação OSCE →
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
      `}</style>
    </div>
  )
}