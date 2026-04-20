'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Exemplos ─────────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    label: 'Consulta HTA + DM2',
    meds: 'Metformina 1000mg 2x/dia\nRamipril 5mg\nAmlodipina 10mg\nAtovastatina 20mg\nAspirin 100mg',
    motivo: 'Consulta de rotina. Doente refere tonturas matinais e tosse seca há 3 semanas.',
  },
  {
    label: 'Urgência — dor torácica',
    meds: 'Bisoprolol 5mg\nFurosemida 40mg\nEspironolactona 25mg\nDigoxina 0.25mg\nRivaroxabano 20mg',
    motivo: 'Doente com IC conhecida vem à urgência com dispneia e edemas nos membros inferiores.',
  },
  {
    label: 'Farmácia — nova prescrição',
    meds: 'Varfarina 5mg\nAmiodarona 200mg (nova prescrição)\nAtovastatina 40mg\nOmeprazol 20mg',
    motivo: 'Doente com FA vem buscar amiodarona prescrita hoje pelo cardiologista.',
  },
  {
    label: 'Internato — apresentação de doente',
    meds: 'Metformina 850mg\nGliclazida 60mg\nSertralina 50mg\nAlprazolam 0.5mg noite\nIbuprofeno 400mg SOS',
    motivo: 'Estudante a preparar apresentação de doente diabético com depressão e artrose.',
  },
]

// ─── Upgrade Gate ─────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ maxWidth: 540 }}>

        {/* Demo preview — makes them want it immediately */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', marginBottom: 28, textAlign: 'left', opacity: 0.6, filter: 'blur(1.5px)', userSelect: 'none', pointerEvents: 'none' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', marginBottom: 12 }}>BRIEFING CLÍNICO — CONSULTA</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 16 }}>Doente com HTA + DM2 + dislipidemia sob 5 fármacos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['🔴 TOSSE SECA — provável efeito adverso do ramipril. Considera substituição por losartan.', '🟡 TONTURAS — verificar TA ortostática. Possível hipotensão pela combinação IECA + amlodipina.', '🔬 Pedir: HbA1c, creatinina, K+, perfil lipídico — última vez há > 6 meses'].map(item => (
              <div key={item} style={{ fontSize: 12, color: 'var(--ink-2)', padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 4 }}>{item}</div>
            ))}
          </div>
        </div>

        <div style={{ display: 'inline-block', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 12px', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
          Briefing Clínico de Consulta
        </h2>
        <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28 }}>
          Cola os medicamentos e o motivo da consulta. Em 15 segundos tens um briefing clínico completo — red flags, perguntas a fazer, o que monitorizar, e o que não podes perder.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
            Upgrade para Pro — 12,99€/mês →
          </Link>
          <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 20px', borderRadius: 6, fontSize: 14, border: '1px solid var(--border-2)' }}>
            Já tenho conta
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Result ───────────────────────────────────────────────────────────────────

interface BriefingResult {
  patient_profile: string
  chief_concern: string
  red_flags: { flag: string; reason: string; urgency: 'IMEDIATA' | 'CONSULTA' | 'VIGIAR' }[]
  questions_to_ask: string[]
  what_to_monitor: { parameter: string; target: string; reason: string }[]
  drug_actions: { drug: string; role: string; note?: string }[]
  critical_interactions: { drugs: string[]; severity: string; action: string }[]
  suggested_labs: string[]
  differential_considerations: string[]
  clinical_note: string
}

const URGENCY_STYLE = {
  IMEDIATA: { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444', label: 'IMEDIATA' },
  CONSULTA: { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b', label: 'CONSULTA' },
  VIGIAR:   { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a5f', dot: '#3b82f6', label: 'VIGIAR' },
}

function BriefingCard({ result }: { result: BriefingResult }) {
  return (
    <div className="fade-in">

      {/* Header */}
      <div style={{ background: 'var(--green)', borderRadius: '8px 8px 0 0', padding: '18px 22px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.15em', marginBottom: 4 }}>BRIEFING CLÍNICO</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, color: 'white', marginBottom: 4 }}>{result.patient_profile}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>{result.chief_concern}</div>
      </div>

      {/* Red flags */}
      {result.red_flags.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            🚩 Red Flags
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {result.red_flags.map((rf, i) => {
              const s = URGENCY_STYLE[rf.urgency]
              return (
                <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `3px solid ${s.dot}`, borderRadius: '0 4px 4px 0', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: s.dot, color: 'white', padding: '2px 7px', borderRadius: 3, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>{s.label}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: s.color, marginBottom: 2 }}>{rf.flag}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>{rf.reason}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Critical interactions */}
      {result.critical_interactions?.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#c53030', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>⚡ Interações Críticas</div>
          {result.critical_interactions.map((ci, i) => (
            <div key={i} style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 4, padding: '10px 14px', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7f1d1d', marginBottom: 4 }}>{ci.drugs.join(' + ')}</div>
              <div style={{ fontSize: 12, color: '#742a2a', lineHeight: 1.5, marginBottom: 4 }}>{ci.severity}</div>
              <div style={{ fontSize: 12, color: '#7f1d1d', fontStyle: 'italic' }}>→ {ci.action}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>

        {/* Questions to ask */}
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRight: 'none', background: 'white', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            💬 Perguntar ao doente
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.questions_to_ask.map((q, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)', padding: '4px 0', borderBottom: '1px solid var(--bg-3)', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--green-2)', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{i + 1}.</span>
                {q}
              </div>
            ))}
          </div>
        </div>

        {/* Monitoring */}
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 20px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            📊 Monitorizar
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.what_to_monitor.map((m, i) => (
              <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid var(--bg-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.parameter}</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green-2)' }}>{m.target}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{m.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drug roles */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          💊 Papel de cada medicamento
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {result.drug_actions.map((d, i) => (
            <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{d.drug}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: d.note ? 4 : 0 }}>{d.role}</div>
              {d.note && <div style={{ fontSize: 11, color: '#c53030', fontStyle: 'italic', marginTop: 3 }}>⚠ {d.note}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Suggested labs + differentials */}
      {(result.suggested_labs?.length > 0 || result.differential_considerations?.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
          {result.suggested_labs?.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRight: 'none', background: 'white', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🔬 Sugerir análises</div>
              {result.suggested_labs.map((l, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', padding: '4px 0', borderBottom: '1px solid var(--bg-3)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--green-2)' }}>→</span>{l}
                </div>
              ))}
            </div>
          )}
          {result.differential_considerations?.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'white', padding: '16px 20px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🧠 Considerar</div>
              {result.differential_considerations.map((d, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', padding: '4px 0', borderBottom: '1px solid var(--bg-3)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--ink-4)' }}>·</span>{d}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clinical note */}
      <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', background: 'var(--green-light)', padding: '16px 20px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
          ⚕ Síntese clínica
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0 }}>{result.clinical_note}</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const [meds, setMeds] = useState('')
  const [motivo, setMotivo] = useState('')
  const [result, setResult] = useState<BriefingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const generate = async (exMeds?: string, exMotivo?: string) => {
    const m = exMeds ?? meds
    const mo = exMotivo ?? motivo
    if (!m.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sessionData.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers,
        body: JSON.stringify({ medications: m, chief_complaint: mo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar briefing. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {!isPro && <UpgradeGate />}

      {isPro && (
        <div className="page-container page-body">
          <div className="interactions-layout">

            {/* LEFT */}
            <div className="sticky-panel">
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'inline-block', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1e40af', fontWeight: 700 }}>PRO</span>
                </div>
                <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Briefing Clínico</h1>
                <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                  Preparação de consulta em 15 segundos. Para médicos, farmacêuticos, internos e estudantes.
                </p>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Medicamentos (um por linha)
                </label>
                <textarea value={meds} onChange={e => setMeds(e.target.value)}
                  placeholder={'Metformina 1000mg 2x/dia\nRamipril 5mg\nAtovastatina 20mg\n...'}
                  rows={6}
                  style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '16px', marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Motivo da consulta / contexto
                </label>
                <textarea value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Ex: Consulta de rotina. Doente refere tonturas e tosse há 3 semanas."
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 4, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.6 }} />
              </div>

              <button onClick={() => generate()} disabled={!meds.trim() || loading}
                style={{ width: '100%', background: meds.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: meds.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: meds.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20 }}>
                {loading ? 'A preparar briefing...' : 'Gerar Briefing Clínico →'}
              </button>

              <div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Exemplos
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {EXAMPLES.map(ex => (
                    <button key={ex.label}
                      onClick={() => { setMeds(ex.meds); setMotivo(ex.motivo); generate(ex.meds, ex.motivo) }}
                      style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 2 }}>{ex.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{ex.motivo.slice(0, 65)}...</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              {loading && (
                <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: 'var(--green)', padding: '18px 22px' }}>
                    <div className="skeleton" style={{ height: 10, width: 160, marginBottom: 10, opacity: 0.4 }} />
                    <div className="skeleton" style={{ height: 20, width: 300, marginBottom: 6, opacity: 0.4 }} />
                    <div className="skeleton" style={{ height: 13, width: 200, opacity: 0.3 }} />
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="skeleton" style={{ height: 52, borderRadius: 4 }} />
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '20px' }}>
                  <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
                </div>
              )}

              {!result && !loading && !error && (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '60px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>⚕️</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10 }}>Pronto para a consulta</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                    Introduz os medicamentos e o motivo da consulta. Recebes um briefing clínico completo em 15 segundos.
                  </p>
                </div>
              )}

              {result && !loading && <BriefingCard result={result} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}