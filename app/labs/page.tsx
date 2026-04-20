'use client'

import { useState, useRef } from 'react'
import Header from '@/components/Header'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabValue {
  name: string
  value: string
  unit: string
  reference: string
  status: 'NORMAL' | 'ALTO' | 'BAIXO' | 'CRITICO_ALTO' | 'CRITICO_BAIXO'
  interpretation: string      // o que este valor significa para esta pessoa
  clinical_significance: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  drug_connection?: string    // ligação ao medicamento do perfil (se existir)
  follow_up?: string          // quando repetir / o que fazer
}

interface LabReport {
  patient_summary: string
  collection_date?: string
  overall_status: 'TUDO_NORMAL' | 'ATENÇÃO' | 'CONSULTA_RECOMENDADA' | 'CONSULTA_URGENTE'
  values: LabValue[]
  key_findings: string[]           // os 3-5 achados mais importantes em linguagem simples
  questions_for_doctor: string[]   // perguntas exactas para levar à consulta
  lifestyle_suggestions: string[]  // o que pode fazer já (dieta, exercício, etc)
  drug_interactions_found: {
    drug: string
    affected_value: string
    explanation: string
  }[]
  when_to_repeat: string           // quando fazer as próximas análises
  reassurance?: string             // se tudo estiver bem, uma mensagem tranquilizadora
}

// ─── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  NORMAL:        { bg: '#f0fdf4', border: '#86efac', color: '#14532d', dot: '#22c55e', label: 'Normal',         icon: '✓' },
  ALTO:          { bg: '#fffbeb', border: '#fde68a', color: '#78350f', dot: '#f59e0b', label: 'Acima do normal', icon: '↑' },
  BAIXO:         { bg: '#eff6ff', border: '#bfdbfe', color: '#1e3a5f', dot: '#3b82f6', label: 'Abaixo do normal', icon: '↓' },
  CRITICO_ALTO:  { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444', label: 'Valor crítico ↑', icon: '↑↑' },
  CRITICO_BAIXO: { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', dot: '#ef4444', label: 'Valor crítico ↓', icon: '↓↓' },
}

const OVERALL_STYLE = {
  TUDO_NORMAL:            { bg: '#f0fdf4', border: '#86efac', color: '#14532d', bar: '#22c55e', emoji: '✓', label: 'Tudo dentro dos valores normais' },
  ATENÇÃO:                { bg: '#fffbeb', border: '#fde68a', color: '#78350f', bar: '#f59e0b', emoji: '⚠', label: 'Alguns valores merecem atenção' },
  CONSULTA_RECOMENDADA:   { bg: '#fff7ed', border: '#fdba74', color: '#7c2d12', bar: '#f97316', emoji: '!',  label: 'Recomendamos consulta médica' },
  CONSULTA_URGENTE:       { bg: '#fff5f5', border: '#fecaca', color: '#7f1d1d', bar: '#ef4444', emoji: '!!', label: 'Consulta médica urgente' },
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────────

function UpgradeGate({ plan }: { plan: string }) {
  const isLoggedIn = plan !== 'free_anon'
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
      {/* Blurred preview */}
      <div style={{ position: 'relative', marginBottom: 28, userSelect: 'none', pointerEvents: 'none' }}>
        <div style={{ filter: 'blur(4px)', opacity: 0.5, background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '20px', textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginBottom: 8 }}>RELATÓRIO DE ANÁLISES CLÍNICAS</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 16 }}>As tuas análises de Março 2026</div>
          {[
            { label: 'Colesterol LDL', value: '142 mg/dL', status: 'ALTO' },
            { label: 'Vitamina D', value: '18 ng/mL', status: 'BAIXO' },
            { label: 'Glicemia em jejum', value: '102 mg/dL', status: 'ATENÇÃO' },
          ].map(({ label, value, status }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--bg-3)', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{label}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: status === 'NORMAL' ? 'var(--green)' : status === 'ALTO' ? '#d97706' : '#3b82f6' }}>{value}</span>
                <span style={{ fontSize: 10, background: status === 'ALTO' ? '#fffbeb' : '#eff6ff', color: status === 'ALTO' ? '#78350f' : '#1e3a5f', border: `1px solid ${status === 'ALTO' ? '#fde68a' : '#bfdbfe'}`, borderRadius: 4, padding: '1px 6px', fontFamily: 'var(--font-mono)' }}>{status}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--green)', color: 'white', padding: '10px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
          🔒 Disponível no plano Student
        </div>
      </div>

      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 12, letterSpacing: '-0.01em' }}>
        O teu médico explica os resultados em 10 minutos.<br />
        <em style={{ color: 'var(--green-2)', fontStyle: 'italic' }}>O Phlox explica tudo.</em>
      </h2>
      <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 8 }}>
        Faz upload do PDF das tuas análises. Recebe uma interpretação completa — o que está fora do normal, o que significa, o que perguntar ao médico, e o que podes fazer já.
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 28 }}>
        Com o teu plano {plan === 'free' ? 'Student — 3,99€/mês' : 'Pro — 12,99€/mês'}.
      </p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/pricing" style={{ background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 6, fontSize: 14, fontWeight: 600 }}>
          {isLoggedIn ? 'Fazer upgrade →' : 'Começar — 3,99€/mês →'}
        </Link>
        {!isLoggedIn && (
          <Link href="/login" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '12px 20px', borderRadius: 6, fontSize: 14, border: '1px solid var(--border-2)' }}>
            Já tenho conta
          </Link>
        )}
      </div>
    </div>
  )
}

// ─── Result components ────────────────────────────────────────────────────────

function LabValueRow({ val }: { val: LabValue }) {
  const [open, setOpen] = useState(false)
  const s = STATUS_STYLE[val.status]

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', background: 'none', border: 'none', padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: s.dot, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'white', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
          {s.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{val.name}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Ref: {val.reference}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, color: s.color }}>{val.value}</div>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: val.unit ? 'var(--ink-4)' : 'transparent' }}>{val.unit || '—'}</div>
        </div>
        <span style={{ color: 'var(--ink-4)', fontSize: 14, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 16px 14px 56px', background: s.bg }}>
          <p style={{ fontSize: 13, color: s.color, lineHeight: 1.7, margin: '0 0 8px' }}>{val.interpretation}</p>
          {val.drug_connection && (
            <div style={{ padding: '8px 12px', background: 'white', border: `1px solid ${s.border}`, borderRadius: 4, fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>
              💊 {val.drug_connection}
            </div>
          )}
          {val.follow_up && (
            <div style={{ fontSize: 12, color: 'var(--ink-4)', fontStyle: 'italic' }}>→ {val.follow_up}</div>
          )}
        </div>
      )}
    </div>
  )
}

function ReportView({ report }: { report: LabReport }) {
  const overall = OVERALL_STYLE[report.overall_status]
  const abnormal = report.values.filter(v => v.status !== 'NORMAL')
  const normal = report.values.filter(v => v.status === 'NORMAL')

  return (
    <div className="fade-in">

      {/* Overall status */}
      <div style={{ background: overall.bg, border: `2px solid ${overall.bar}`, borderRadius: 8, padding: '20px 22px', marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: overall.bar, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'white', fontWeight: 700, flexShrink: 0 }}>
          {overall.emoji}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: overall.color, fontWeight: 700, marginBottom: 4 }}>{overall.label}</div>
          <div style={{ fontSize: 13, color: overall.color, opacity: 0.8 }}>{report.patient_summary}</div>
        </div>
      </div>

      {/* Reassurance for normal results */}
      {report.reassurance && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '14px 18px', marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: '#14532d', lineHeight: 1.7, margin: 0 }}>{report.reassurance}</p>
        </div>
      )}

      {/* Key findings */}
      {report.key_findings.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            📋 O que é mais importante saber
          </div>
          {report.key_findings.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < report.key_findings.length - 1 ? '1px solid var(--bg-3)' : 'none', alignItems: 'flex-start' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--green-2)', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{i + 1}.</span>
              <span style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{f}</span>
            </div>
          ))}
        </div>
      )}

      {/* Values — abnormal first */}
      {abnormal.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Valores fora do normal ({abnormal.length})
            </div>
          </div>
          {abnormal.map(v => <LabValueRow key={v.name} val={v} />)}
        </div>
      )}

      {normal.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Valores normais ({normal.length})
            </div>
          </div>
          {normal.map(v => <LabValueRow key={v.name} val={v} />)}
        </div>
      )}

      {/* Drug interactions found */}
      {report.drug_interactions_found?.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            💊 Ligação à tua medicação
          </div>
          {report.drug_interactions_found.map((d, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < report.drug_interactions_found.length - 1 ? '1px solid #fde68a' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#78350f', marginBottom: 4 }}>{d.drug} → {d.affected_value}</div>
              <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>{d.explanation}</div>
            </div>
          ))}
        </div>
      )}

      {/* Questions for doctor */}
      {report.questions_for_doctor.length > 0 && (
        <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            💬 Perguntas para levar ao médico
          </div>
          {report.questions_for_doctor.map((q, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: i < report.questions_for_doctor.length - 1 ? '1px solid var(--border)' : 'none', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--green-2)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
              {q}
            </div>
          ))}
        </div>
      )}

      {/* Lifestyle suggestions */}
      {report.lifestyle_suggestions?.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            🌱 O que podes fazer já
          </div>
          {report.lifestyle_suggestions.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < report.lifestyle_suggestions.length - 1 ? '1px solid var(--bg-3)' : 'none', fontSize: 13, color: 'var(--ink-2)' }}>
              <span style={{ color: 'var(--green-2)', flexShrink: 0 }}>→</span>{s}
            </div>
          ))}
        </div>
      )}

      {/* When to repeat */}
      <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', marginBottom: 12 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.08em', marginBottom: 4 }}>PRÓXIMAS ANÁLISES</div>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: 0, lineHeight: 1.6 }}>{report.when_to_repeat}</p>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center', lineHeight: 1.6 }}>
        ⚕️ Esta interpretação destina-se a fins educativos. Partilha com o teu médico antes de tomar qualquer decisão clínica.
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LabsPage() {
  const { user, supabase } = useAuth()
  const plan = (user?.plan || 'free') as string
  const isStudent = plan === 'student' || plan === 'pro' || plan === 'clinic'

  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<LabReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const fileRef = useRef<HTMLInputElement>(null)

  const analyse = async () => {
    if (!text.trim() && !file) return
    setLoading(true); setError(''); setReport(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      let labText = text

      // If file, extract text client-side
      if (file && !text.trim()) {
        labText = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = e => resolve(e.target?.result as string || '')
          reader.readAsText(file)
        })
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/labs', {
        method: 'POST',
        headers,
        body: JSON.stringify({ lab_text: labText }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReport(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao interpretar. Tenta novamente.')
    } finally {
      setLoading(false)
    }
  }

  const DEMO_LABS = `Hemograma
Hemoglobina: 13.2 g/dL (ref: 13.5-17.5)
Hematócrito: 41% (ref: 41-53%)
Leucócitos: 6.8 x10³/µL (ref: 4.5-11.0)
Plaquetas: 215 x10³/µL (ref: 150-400)

Bioquímica
Glicemia em jejum: 108 mg/dL (ref: 70-99)
HbA1c: 5.9% (ref: <5.7%)
Colesterol total: 218 mg/dL (ref: <200)
Colesterol LDL: 147 mg/dL (ref: <130)
Colesterol HDL: 48 mg/dL (ref: >40)
Triglicéridos: 165 mg/dL (ref: <150)
Creatinina: 0.95 mg/dL (ref: 0.7-1.2)
Ureia: 38 mg/dL (ref: 15-45)
ALT: 28 U/L (ref: 7-40)
AST: 22 U/L (ref: 10-40)
TSH: 2.1 mUI/L (ref: 0.4-4.0)

Vitaminas e minerais
Vitamina D (25-OH): 21 ng/mL (ref: 30-100)
Vitamina B12: 310 pg/mL (ref: 200-900)
Ferritina: 18 µg/L (ref: 30-400)
Ferro sérico: 72 µg/dL (ref: 60-170)`

  if (!isStudent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
        <Header />
        <div className="page-container page-body">
          <UpgradeGate plan={plan} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'inline-block', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 20, padding: '3px 12px', marginBottom: 10 }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7c3aed', fontWeight: 700 }}>STUDENT+</span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6 }}>Interpretação de Análises</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                Cola os resultados das tuas análises clínicas. Recebe uma interpretação completa em linguagem humana.
              </p>
            </div>

            {/* Input mode toggle */}
            <div style={{ display: 'flex', background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: 4, gap: 4, marginBottom: 12 }}>
              {(['text', 'file'] as const).map(m => (
                <button key={m} onClick={() => setInputMode(m)}
                  style={{ flex: 1, background: inputMode === m ? 'var(--green)' : 'transparent', color: inputMode === m ? 'white' : 'var(--ink-3)', border: 'none', borderRadius: 4, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {m === 'text' ? '📋 Colar texto' : '📄 Ficheiro .txt'}
                </button>
              ))}
            </div>

            {inputMode === 'text' ? (
              <div style={{ marginBottom: 12 }}>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={'Cola aqui os resultados das tuas análises...\n\nEx:\nGlicemia: 108 mg/dL (ref: 70-99)\nColesterol LDL: 147 mg/dL (ref: <130)\n...'}
                  rows={12}
                  style={{ width: '100%', border: '1px solid var(--border-2)', borderRadius: 6, padding: '12px', fontSize: 12, fontFamily: 'var(--font-mono)', outline: 'none', resize: 'vertical', lineHeight: 1.7, color: 'var(--ink)' }}
                />
                <button onClick={() => setText(DEMO_LABS)}
                  style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green-2)', cursor: 'pointer', fontFamily: 'var(--font-mono)', padding: '4px 0' }}>
                  Usar exemplo →
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <div onClick={() => fileRef.current?.click()}
                  style={{ border: '2px dashed var(--border-2)', borderRadius: 6, padding: '32px 16px', textAlign: 'center', cursor: 'pointer', background: file ? 'var(--green-light)' : 'white' }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 4 }}>
                    {file ? file.name : 'Clica para seleccionar ficheiro'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Ficheiro .txt com os resultados</div>
                </div>
                <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f) }} />
              </div>
            )}

            <button
              onClick={analyse}
              disabled={(!text.trim() && !file) || loading}
              style={{ width: '100%', background: (text.trim() || file) && !loading ? 'var(--green)' : 'var(--bg-3)', color: (text.trim() || file) && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 6, padding: '13px', fontSize: 14, fontWeight: 600, cursor: (text.trim() || file) && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              {loading ? 'A interpretar...' : 'Interpretar análises →'}
            </button>

            <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.1em', marginBottom: 10 }}>O QUE ANALISAMOS</div>
              {[
                '📊 Hemograma completo',
                '🩸 Bioquímica geral',
                '❤️ Perfil lipídico e cardiovascular',
                '🍬 Glicemia e HbA1c',
                '🦋 Função tiroideia',
                '🫀 Função renal e hepática',
                '☀️ Vitaminas e minerais',
                '💊 Ligação à tua medicação',
              ].map(item => (
                <div key={item} style={{ fontSize: 12, color: 'var(--ink-3)', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{item}</div>
              ))}
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div className="fade-in" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg-3)', padding: '20px 22px' }}>
                  <div className="skeleton" style={{ height: 10, width: 200, marginBottom: 12 }} />
                  <div className="skeleton" style={{ height: 24, width: 300, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 14, width: '60%' }} />
                </div>
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} className="skeleton" style={{ height: 48, borderRadius: 4 }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 6, padding: '20px' }}>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {!report && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔬</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink-2)', marginBottom: 10 }}>
                  As tuas análises, em português
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
                  Cola os resultados das tuas análises clínicas e recebe uma interpretação completa — o que está fora do normal, o que significa para a tua saúde, e as perguntas certas para levar ao médico.
                </p>
              </div>
            )}

            {report && !loading && <ReportView report={report} />}
          </div>
        </div>
      </div>
    </div>
  )
}