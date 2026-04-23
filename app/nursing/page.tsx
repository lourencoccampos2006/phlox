'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

type Via = 'IV' | 'SC' | 'IM'

const VIAS: { id: Via; label: string; desc: string; icon: string }[] = [
  { id: 'IV',  label: 'Intravenosa',     desc: 'Bolus, perfusão contínua, diluições',      icon: '💉' },
  { id: 'SC',  label: 'Subcutânea',      desc: 'Insulina, HBPM, morfina, outros',          icon: '🔵' },
  { id: 'IM',  label: 'Intramuscular',   desc: 'Antibióticos, vacinas, analgésicos depot', icon: '🟢' },
]

interface NursingResult {
  drug: string
  via: Via
  compatible: boolean
  preparation: string
  concentration?: string
  volume_max?: string
  sites?: string[]
  technique: string[]
  rate?: string
  stability: string
  contraindications: string[]
  monitoring: string[]
  special_notes: string[]
  alternatives?: string
}

export default function NursingPage() {
  const { user, supabase } = useAuth()
  const [drug, setDrug] = useState('')
  const [via, setVia] = useState<Via>('IV')
  const [dose, setDose] = useState('')
  const [result, setResult] = useState<NursingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    if (!drug.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/nursing', { method: 'POST', headers, body: JSON.stringify({ drug: drug.trim(), via, dose: dose.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally { setLoading(false) }
  }

  const EXAMPLES = [
    { drug: 'Morfina', via: 'SC' as Via, dose: '10mg' },
    { drug: 'Metoclopramida', via: 'IM' as Via, dose: '10mg' },
    { drug: 'Vancomicina', via: 'IV' as Via, dose: '1g' },
    { drug: 'Insulina Novorapid', via: 'SC' as Via, dose: '8UI' },
    { drug: 'Ceftriaxona', via: 'IM' as Via, dose: '1g' },
    { drug: 'Furosemida', via: 'IV' as Via, dose: '40mg' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Guia de Administração</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>Preparação, técnica e monitorização por via de administração.</p>
            </div>

            {/* Via selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Via de administração</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {VIAS.map(v => (
                  <button key={v.id} onClick={() => setVia(v.id)}
                    style={{ padding: '10px 8px', border: `2px solid ${via === v.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: via === v.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 18, marginBottom: 3 }}>{v.icon}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: via === v.id ? 'var(--green)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{v.id}</div>
                    <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.3 }}>{v.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Medicamento</label>
              <input value={drug} onChange={e => setDrug(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Ex: morfina, vancomicina, insulina..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Dose (opcional)</label>
              <input value={dose} onChange={e => setDose(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Ex: 10mg, 1g, 8UI..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <button onClick={check} disabled={!drug.trim() || loading}
              style={{ width: '100%', background: drug.trim() && !loading ? 'var(--green)' : 'var(--bg-3)', color: drug.trim() && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 600, cursor: drug.trim() && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '-0.01em' }}>
              {loading ? 'A verificar...' : `Guia de administração ${via} →`}
            </button>

            {/* Examples */}
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Exemplos frequentes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {EXAMPLES.map(ex => (
                  <button key={ex.drug + ex.via} onClick={() => { setDrug(ex.drug); setVia(ex.via); setDose(ex.dose) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{ex.drug}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{ex.dose}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--green-light)', color: 'var(--green-2)', padding: '1px 6px', borderRadius: 4 }}>{ex.via}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[80, 120, 80, 100].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && (
              <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}>
                <p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p>
              </div>
            )}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>💉</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '-0.01em' }}>Guia de administração clínica</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
                  Selecciona a via, escreve o medicamento e obtém o protocolo completo de preparação e administração.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {/* Header */}
                <div style={{ background: result.compatible ? 'var(--green)' : '#dc2626', borderRadius: '10px 10px 0 0', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', marginBottom: 4 }}>
                    VIA {result.via} · {VIAS.find(v => v.id === result.via)?.label.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>{result.drug}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                    {result.compatible ? '✓ Pode ser administrado por esta via' : '✗ Esta via não é recomendada para este fármaco'}
                  </div>
                </div>

                {/* Preparation */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>🧪 Preparação</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, marginBottom: result.concentration ? 10 : 0 }}>{result.preparation}</p>
                  {result.concentration && (
                    <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
                      {result.concentration && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Concentração: <strong>{result.concentration}</strong></div>}
                      {result.volume_max && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Volume máx.: <strong>{result.volume_max}</strong></div>}
                      {result.rate && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>Ritmo: <strong>{result.rate}</strong></div>}
                    </div>
                  )}
                </div>

                {/* Technique */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>📋 Técnica de administração</div>
                  <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.technique.map((step, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{step}</li>
                    ))}
                  </ol>
                  {result.sites && result.sites.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 6 }}>
                      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Locais de injecção</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {result.sites.map(s => <span key={s} style={{ fontSize: 12, color: 'var(--ink-2)', background: 'white', border: '1px solid var(--border)', padding: '2px 10px', borderRadius: 12 }}>{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Monitoring + contraindications */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid var(--border)', borderTop: 'none' }}>
                  <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>📊 Monitorizar</div>
                    {result.monitoring.map((m, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, display: 'flex', gap: 6 }}>
                        <span style={{ color: 'var(--green-2)' }}>→</span>{m}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#dc2626', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>⚠ Contraindicações</div>
                    {result.contraindications.length > 0
                      ? result.contraindications.map((c, i) => (
                          <div key={i} style={{ fontSize: 13, color: '#742a2a', marginBottom: 4, display: 'flex', gap: 6 }}>
                            <span>·</span>{c}
                          </div>
                        ))
                      : <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Nenhuma específica desta via</div>
                    }
                  </div>
                </div>

                {/* Stability + special notes */}
                <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>🕐 Estabilidade</div>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: 0 }}>{result.stability}</p>
                </div>

                {result.special_notes.length > 0 && (
                  <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px 22px' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>💡 Notas importantes</div>
                    {result.special_notes.map((n, i) => (
                      <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.6 }}>· {n}</div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  ⚕️ Confirma sempre com o protocolo da instituição e com o farmacêutico clínico.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}