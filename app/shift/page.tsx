'use client'

// app/shift/page.tsx — Phlox Turno Virtual
// Restaurado em 2026-05-31. Antes era um redirect circular para /simulador?mode=shift,
// o que partia a entrada vinda do menu de simuladores. Agora é uma página completa,
// com setup, fase ativa e resultados, consumindo as APIs /api/shift/generate e
// /api/shift/evaluate que já existem.

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Vazio, ACarregar, Aviso, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface ShiftPatient {
  id: string
  name: string
  age: number
  sex: 'M' | 'F'
  chief_complaint: string
  history: string
  vitals: Record<string, string>
  current_meds: string[]
  labs: Record<string, string>
  allergies: string[]
}

interface ShiftCase {
  patients: ShiftPatient[]
  specialty: string
  difficulty: string
  duration_minutes: number
}

interface PatientDecision {
  patient_id: string
  diagnosis: string
  treatment: string[]
  monitoring: string[]
  reasoning: string
}

interface ShiftResult {
  total_score: number
  max_score: number
  grade: string
  patient_feedback: {
    patient_id: string
    patient_name: string
    score: number
    correct_diagnosis: string
    correct_treatment: string[]
    your_diagnosis: string
    your_treatment: string[]
    feedback: string
    critical_errors: string[]
    well_done: string[]
  }[]
  overall_feedback: string
  weak_areas: string[]
  strong_areas: string[]
}

const SPECIALTIES = [
  { id: 'cardiology',      label: 'Cardiologia',      desc: 'HTA, IC, arritmias, SCA' },
  { id: 'endocrinology',   label: 'Endocrinologia',   desc: 'DM, tiróide, dislipidemia' },
  { id: 'infectious',      label: 'Infecciologia',    desc: 'Antibioterapia, pneumonias, ITU' },
  { id: 'neurology',       label: 'Neurologia',       desc: 'Epilepsia, Parkinson, AVC' },
  { id: 'nephrology',      label: 'Nefrologia',       desc: 'DRC, distúrbios hidroelectrolíticos' },
  { id: 'pulmonology',     label: 'Pneumologia',      desc: 'DPOC, asma, pneumonias' },
  { id: 'gastro',          label: 'Gastrenterologia', desc: 'DII, cirrose, pancreatite' },
  { id: 'emergency',       label: 'Urgência',         desc: 'Algoritmos ABCDE, choque, PCR' },
  { id: 'surgery',         label: 'Cirurgia',         desc: 'Abdómen agudo, peri-op' },
  { id: 'pediatrics',      label: 'Pediatria',        desc: 'Especificidades pediátricas' },
  { id: 'obstetrics',      label: 'Obstetrícia',      desc: 'Gravidez, complicações, parto' },
  { id: 'psychiatry',      label: 'Psiquiatria',      desc: 'Depressão, bipolar, ansiedade' },
  { id: 'geriatrics',      label: 'Geriatria',        desc: 'Polimedicação' },
  { id: 'nursing',         label: 'Enfermagem',       desc: 'Avaliação, técnicas, escalas' },
  { id: 'pharmacy',        label: 'Farmácia Clínica', desc: 'Revisão, reconciliação, PCNE' },
  { id: 'mixed',           label: 'Misto',            desc: 'Várias especialidades — mais difícil' },
]

const DIFFICULTIES = [
  { id: 'intern', label: 'Interno', desc: 'Casos clássicos, diagnóstico directo' },
  { id: 'resident', label: 'Residente', desc: 'Complicações e comorbilidades' },
  { id: 'specialist', label: 'Especialista', desc: 'Casos atípicos e decisões difíceis' },
]

export default function ShiftSimulatorPage() {
  const { user, supabase } = useAuth()
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup')
  const [specialty, setSpecialty] = useState('cardiology')
  const [difficulty, setDifficulty] = useState('intern')
  const [shiftCase, setShiftCase] = useState<ShiftCase | null>(null)
  const [currentPatient, setCurrentPatient] = useState(0)
  const [decisions, setDecisions] = useState<PatientDecision[]>([])
  const [currentDecision, setCurrentDecision] = useState<Partial<PatientDecision>>({})
  const [results, setResults] = useState<ShiftResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const plan = ((user as any)?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  // Pré-preenche da página /simulador (sessionStorage)
  useEffect(() => {
    try {
      const cfg = sessionStorage.getItem('phlox_shift_config')
      if (cfg) {
        const parsed = JSON.parse(cfg)
        if (parsed.domain && parsed.domain !== 'all') {
          // Mapeamento aproximado entre nomes vindos do /simulador e os IDs locais
          const map: Record<string, string> = {
            medicina_interna: 'cardiology', emergencia: 'emergency',
            cirurgia: 'surgery', pediatria: 'pediatrics',
            enfermagem: 'nursing', nutricao: 'mixed',
            psiquiatria: 'psychiatry', farmacologia: 'pharmacy',
          }
          const id = map[parsed.domain] || parsed.domain
          if (SPECIALTIES.some(s => s.id === id)) setSpecialty(id)
        }
        if (parsed.difficulty && parsed.difficulty !== 'all') {
          const mapd: Record<string, string> = { facil: 'intern', medio: 'resident', dificil: 'specialist', especialista: 'specialist' }
          const id = mapd[parsed.difficulty] || parsed.difficulty
          if (DIFFICULTIES.some(d => d.id === id)) setDifficulty(id)
        }
        sessionStorage.removeItem('phlox_shift_config')
      }
    } catch {}
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startShift = async () => {
    setLoading(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/shift/generate', {
        method: 'POST', headers,
        body: JSON.stringify({ specialty, difficulty })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar turno.')
      if (!data.patients?.length) throw new Error('O motor não devolveu doentes. Tenta novamente.')
      setShiftCase(data)
      setDecisions([])
      setCurrentPatient(0)
      setCurrentDecision({})
      setPhase('active')
      const totalSec = data.patients.length * 10 * 60
      setTimeLeft(totalSec)
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
          return prev - 1
        })
      }, 1000)
    } catch (e: any) {
      alert(e.message)
    }
    setLoading(false)
  }

  const submitPatient = async () => {
    if (!currentDecision.diagnosis || !shiftCase) return
    const decision: PatientDecision = {
      patient_id: shiftCase.patients[currentPatient].id,
      diagnosis: currentDecision.diagnosis || '',
      treatment: (currentDecision.treatment as string[] | undefined) || [],
      monitoring: (currentDecision.monitoring as string[] | undefined) || [],
      reasoning: currentDecision.reasoning || '',
    }
    const newDecisions = [...decisions, decision]
    setDecisions(newDecisions)

    if (currentPatient < shiftCase.patients.length - 1) {
      setCurrentPatient(prev => prev + 1)
      setCurrentDecision({})
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setLoading(true)
      try {
        const { data: sd } = await supabase.auth.getSession()
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
        const res = await fetch('/api/shift/evaluate', {
          method: 'POST', headers,
          body: JSON.stringify({ shift_case: shiftCase, decisions: newDecisions })
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Erro ao avaliar turno.')
        setResults(data)
        setPhase('results')
      } catch (e: any) { alert(e.message) }
      setLoading(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const addTreatment = (drug: string) => {
    if (!drug.trim()) return
    setCurrentDecision(prev => ({ ...prev, treatment: [...((prev.treatment as string[]) || []), drug.trim()] }))
  }

  const removeTreatment = (i: number) => {
    setCurrentDecision(prev => ({ ...prev, treatment: ((prev.treatment as string[]) || []).filter((_, j) => j !== i) }))
  }

  const patient = shiftCase?.patients[currentPatient]

  const GRADE_COLOR: Record<string, string> = {
    'A': 'var(--green)', 'B': 'var(--green)', 'C': 'var(--amber)', 'D': 'var(--red)', 'F': 'var(--red)'
  }

  if (!isStudent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <div className="page-container page-body" style={{ textAlign: 'center', maxWidth: 480 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, marginBottom: 16 }}>Turno Virtual</div>
          <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-3)', lineHeight: 1.7, margin: '0 auto 28px' }}>
            Gere 3 doentes, toma decisões clínicas sequenciais, recebe score e feedback detalhado do "chefe de serviço".
          </p>
          <Link href="/pricing" style={{ display: 'inline-flex', background: 'var(--roxo)', color: 'white', textDecoration: 'none', padding: '13px 26px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Activar Plus
          </Link>
        </div>
      </div>
    )
  }

  return (
    <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--roxo)', fontWeight: 'var(--peso-forte)' as any,
          }}>Turno virtual</span>
          <span style={{ ...MONO, color: 'var(--ink-4)' }}>
            {phase === 'setup' ? 'ESCOLHER A ESPECIALIDADE' : phase === 'results' ? 'RESULTADO' : 'EM CURSO'}
          </span>
        </BarraDeTrabalho>
      }
      rodape={
        <BarraDeEstado>
          <span style={MONO}>Três doentes · diagnóstico e tratamento · pontuação no fim</span>
        </BarraDeEstado>
      }
    >
      <div>

        {/* SETUP */}
        {phase === 'setup' && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {/* O cabeçalho centrado com 36px de margem desceu para a barra:
                o que aqui se faz é escolher uma especialidade. */}

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: 12 }}>
              <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Especialidade</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                {SPECIALTIES.map(s => (
                  <button key={s.id} onClick={() => setSpecialty(s.id)}
                    style={{ padding: '12px', border: `2px solid ${specialty === s.id ? 'var(--roxo)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: specialty === s.id ? 'var(--roxo-claro)' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: specialty === s.id ? 'var(--roxo)' : 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{s.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px', marginBottom: 20 }}>
              <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Nível de dificuldade</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DIFFICULTIES.map(d => (
                  <button key={d.id} onClick={() => setDifficulty(d.id)}
                    style={{ display: 'flex', gap: 12, padding: '12px 16px', border: `2px solid ${difficulty === d.id ? 'var(--roxo)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: difficulty === d.id ? 'var(--roxo-claro)' : 'white', cursor: 'pointer', textAlign: 'left', alignItems: 'center', transition: 'all 0.15s' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: difficulty === d.id ? 'var(--roxo)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{d.label}</div>
                      <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)' }}>{d.desc}</div>
                    </div>
                    {difficulty === d.id && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--roxo)" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startShift} disabled={loading}
              style={{ width: '100%', padding: '16px', background: loading ? 'var(--bg-3)' : 'var(--roxo)', color: loading ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'background 0.15s' }}>
              {loading ? 'A gerar turno...' : 'Começar turno →'}
            </button>

            <div style={{ marginTop: 14, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
              3 doentes · ~10 min por doente · Score e feedback no fim
            </div>
          </div>
        )}

        {/* ACTIVE SHIFT */}
        {phase === 'active' && patient && shiftCase && (
          <div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 18px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  Doente {currentPatient + 1} de {shiftCase.patients.length}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {shiftCase.patients.map((_, i) => (
                    <div key={i} style={{ width: 20, height: 6, borderRadius: 'var(--r-sm)', background: i < currentPatient ? 'var(--roxo)' : i === currentPatient ? 'var(--roxo-meio)' : 'var(--border)' }} />
                  ))}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: timeLeft < 300 ? 'var(--red)' : 'var(--ink)', letterSpacing: '0.08em' }}>
                {formatTime(timeLeft)}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(280px, 1fr)', gap: 12 }}>
              {/* Patient info */}
              <div>
                <div style={{ background: 'var(--roxo)', borderRadius: '10px 10px 0 0', padding: '16px 20px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Doente
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'white', fontStyle: 'italic', fontWeight: 'var(--peso-normal)' as any }}>
                    {patient.name}, {patient.age} anos, {patient.sex === 'M' ? 'Masculino' : 'Feminino'}
                  </div>
                </div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>Queixa principal</div>
                    <div style={{ fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{patient.chief_complaint}</div>
                  </div>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>História clínica</div>
                    <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', lineHeight: 1.65 }}>{patient.history}</div>
                  </div>
                  {Object.keys(patient.vitals || {}).length > 0 && (
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Sinais vitais</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                        {Object.entries(patient.vitals).map(([k, v]) => (
                          <div key={k} style={{ background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 'var(--r)' }}>
                            <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>{k}</div>
                            <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {patient.current_meds?.length > 0 && (
                    <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Medicação atual</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {patient.current_meds.map(m => <span key={m} style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 9px', borderRadius: 'var(--r-lg)' }}>{m}</span>)}
                      </div>
                    </div>
                  )}
                  {Object.keys(patient.labs || {}).length > 0 && (
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Análises</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {Object.entries(patient.labs).map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--t-meta)', borderBottom: '1px solid var(--bg-3)', padding: '3px 0' }}>
                            <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                            <span style={{ fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', fontFamily: 'var(--font-mono)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Decision panel */}
              <div>
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                    <div style={{ fontSize: 'var(--t-meta)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>A tua decisão clínica</div>
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Diagnóstico *</label>
                    <input value={currentDecision.diagnosis || ''} onChange={e => setCurrentDecision(prev => ({ ...prev, diagnosis: e.target.value }))}
                      placeholder="Ex: IC com FE reduzida em descompensação aguda"
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Tratamento farmacológico
                    </label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input id="drug-input" placeholder="Adiciona um fármaco e prime Enter"
                        onKeyDown={e => { if (e.key === 'Enter') { addTreatment((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = '' } }}
                        style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {((currentDecision.treatment as string[]) || []).map((drug, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r)' }}>
                          <span style={{ fontSize: 'var(--t-dado)', color: 'var(--roxo)', fontWeight: 'var(--peso-corpo)' as any }}>{drug}</span>
                          <button aria-label="Eliminar" onClick={() => removeTreatment(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 'var(--t-destaque)' }}>×</button>                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'block', fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Raciocínio (opcional)</label>
                    <textarea value={currentDecision.reasoning || ''} onChange={e => setCurrentDecision(prev => ({ ...prev, reasoning: e.target.value }))} rows={3}
                      placeholder="Justifica as tuas escolhas — para teres feedback mais detalhado"
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', resize: 'none', outline: 'none', lineHeight: 1.5 }} />
                  </div>

                  <div style={{ padding: '16px 18px' }}>
                    <button onClick={submitPatient} disabled={!currentDecision.diagnosis || loading}
                      style={{ width: '100%', padding: '13px', background: currentDecision.diagnosis && !loading ? 'var(--roxo)' : 'var(--bg-3)', color: currentDecision.diagnosis && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: currentDecision.diagnosis && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {loading ? 'A avaliar...' : currentPatient < shiftCase.patients.length - 1 ? 'Próximo doente →' : 'Terminar turno →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {phase === 'results' && results && (
          <div style={{ maxWidth: 720, margin: '0 auto' }} className="fade-in">
            <div style={{ background: 'var(--ink)', borderRadius: '12px 12px 0 0', padding: '24px', textAlign: 'center', marginBottom: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
                Fim do turno · {SPECIALTIES.find(s => s.id === specialty)?.label} · {DIFFICULTIES.find(d => d.id === difficulty)?.label}
              </div>
              <div style={{ /* Era serifa ITÁLICA de 72px. Uma nota de exame é um
                   número que se compara com o da vez anterior — e 72px de
                   itálico é um troféu, não uma medida. */
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-numero)', color: GRADE_COLOR[results.grade] || 'var(--ink)', fontWeight: 'var(--peso-forte)' as any, lineHeight: 1, marginBottom: 8 }}>
                {results.grade}
              </div>
              <div style={{ fontSize: 'var(--t-destaque)', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                {results.total_score}/{results.max_score} pontos
              </div>
              <div style={{ fontSize: 'var(--t-corpo)', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                {Math.round((results.total_score / results.max_score) * 100)}% de acerto
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)', lineHeight: 1.75, margin: 0, fontStyle: 'italic' }}>
                &ldquo;{results.overall_feedback}&rdquo;
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none' }}>
              <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)', background: 'var(--badge-green-bg)' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Pontos fortes</div>
                {results.strong_areas.map((a, i) => <div key={i} style={{ fontSize: 'var(--t-dado)', color: 'var(--green-3)', marginBottom: 4 }}>✓ {a}</div>)}
              </div>
              <div style={{ padding: '16px 20px', background: 'var(--badge-red-bg)' }}>
                <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>A melhorar</div>
                {results.weak_areas.map((a, i) => <div key={i} style={{ fontSize: 'var(--t-dado)', color: 'var(--red)', marginBottom: 4 }}>→ {a}</div>)}
              </div>
            </div>

            {results.patient_feedback.map((pf, idx) => (
              <div key={pf.patient_id} style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', fontStyle: 'italic', fontWeight: 'var(--peso-normal)' as any }}>
                    Doente {idx + 1}: {pf.patient_name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-destaque)', fontWeight: 'var(--peso-forte)' as any, color: pf.score >= 80 ? 'var(--green)' : pf.score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                    {pf.score}%
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: '12px' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>A tua resposta</div>
                    <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', marginBottom: 4 }}>{pf.your_diagnosis}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {pf.your_treatment.map(t => <span key={t} style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)', background: 'white', border: '1px solid var(--border)', padding: '1px 7px', borderRadius: 'var(--r-md)' }}>{t}</span>)}
                    </div>
                  </div>
                  <div style={{ background: 'var(--badge-green-bg)', borderRadius: 'var(--r-md)', padding: '12px', border: '1px solid var(--green-mid)' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Resposta correta</div>
                    <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--green-3)', marginBottom: 4 }}>{pf.correct_diagnosis}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {pf.correct_treatment.map(t => <span key={t} style={{ fontSize: 'var(--t-meta)', color: 'var(--green-3)', background: 'white', border: '1px solid var(--green-mid)', padding: '1px 7px', borderRadius: 'var(--r-md)' }}>{t}</span>)}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 10 }}>{pf.feedback}</div>
                {pf.critical_errors.length > 0 && (
                  <div style={{ background: 'var(--badge-red-bg)', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 8 }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--red)', fontWeight: 'var(--peso-forte)' as any, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Erros críticos</div>
                    {pf.critical_errors.map((e, i) => <div key={i} style={{ fontSize: 'var(--t-meta)', color: 'var(--red)', marginBottom: 3 }}>· {e}</div>)}
                  </div>
                )}
                {pf.well_done.length > 0 && (
                  <div style={{ background: 'var(--badge-green-bg)', borderRadius: 'var(--r)', padding: '10px 14px' }}>
                    <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--green)', fontWeight: 'var(--peso-forte)' as any, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Bem feito</div>
                    {pf.well_done.map((w, i) => <div key={i} style={{ fontSize: 'var(--t-meta)', color: 'var(--green-3)', marginBottom: 3 }}>✓ {w}</div>)}
                  </div>
                )}
              </div>
            ))}

            <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '18px 22px', background: 'white', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => { setPhase('setup'); setResults(null); setShiftCase(null) }}
                style={{ flex: 1, padding: '12px', background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Novo turno
              </button>
              <Link href="/study" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', background: 'white', color: 'var(--ink)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-corpo)' as any, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Estudar pontos fracos
              </Link>
            </div>
          </div>
        )}
      </div>
    </Mesa>
  )
}
