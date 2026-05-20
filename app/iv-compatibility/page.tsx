'use client'

import { useState } from 'react'

interface CompatPair {
  drug_a: string
  drug_b: string
  ysite: 'compatible' | 'incompatible' | 'conditional' | 'unknown'
  admixture: 'compatible' | 'incompatible' | 'conditional' | 'unknown' | 'not_applicable'
  syringe: 'compatible' | 'incompatible' | 'conditional' | 'unknown' | 'not_applicable'
  details: string
  clinical_note: string
  evidence: string
}

const STATUS = {
  compatible:     { icon: '✓', label: 'Compatível',    bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  incompatible:   { icon: '✗', label: 'Incompatível',  bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  conditional:    { icon: '⚠', label: 'Condicional',   bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  unknown:        { icon: '?', label: 'Desconhecido',   bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb' },
  not_applicable: { icon: '—', label: 'N/A',            bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
}

const QUICK_DRUGS = [
  'Vancomicina', 'Piperacilina-Tazobactam', 'Meropenem', 'Amoxicilina-Clavulanato',
  'Furosemida', 'Heparina', 'Morfina', 'Midazolam', 'Propofol', 'Noradrenalina',
  'Insulina Regular', 'Potássio KCl', 'Omeprazol', 'Metoclopramida', 'Tramadol',
  'Amiodarona', 'Digoxina', 'Dopamina', 'Dobutamina', 'Ciprofloxacina',
]

export default function IVCompatibilityPage() {
  const [drugs, setDrugs] = useState<string[]>(['', ''])
  const [result, setResult] = useState<{ pairs: CompatPair[]; general_recommendations: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  const addDrug = () => setDrugs(d => [...d, ''])
  const removeDrug = (i: number) => setDrugs(d => d.filter((_, idx) => idx !== i))
  const setDrug = (i: number, v: string) => setDrugs(d => d.map((x, idx) => idx === i ? v : x))
  const quickAdd = (drug: string) => {
    const empty = drugs.findIndex(d => !d.trim())
    if (empty >= 0) setDrug(empty, drug)
    else if (drugs.length < 8) setDrugs(d => [...d, drug])
  }

  const check = async () => {
    const valid = drugs.filter(d => d.trim())
    if (valid.length < 2) { setError('Adiciona pelo menos 2 fármacos.'); return }
    setLoading(true); setError(null); setResult(null); setExpanded(null)
    try {
      const res = await fetch('/api/iv-compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drugs: valid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro ao verificar compatibilidade.') }
    setLoading(false)
  }

  const worstStatus = (pair: CompatPair): keyof typeof STATUS => {
    const order: (keyof typeof STATUS)[] = ['incompatible', 'conditional', 'unknown', 'not_applicable', 'compatible']
    const vals = [pair.ysite, pair.admixture, pair.syringe].filter(v => v !== 'not_applicable') as (keyof typeof STATUS)[]
    for (const s of order) { if (vals.includes(s)) return s }
    return 'unknown'
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Farmácia Clínica · IV</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', marginBottom: 6 }}>Compatibilidade de Injectáveis</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 520 }}>
            Verificação de compatibilidade IV — Y-site, mistura, seringa. Baseado em Trissel's 2024, King Guide e Micromedex.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 760 }}>

        {/* Drug input panel */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>Fármacos a verificar (2–8)</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {drugs.map((d, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0f172a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{i + 1}</div>
                <input value={d} onChange={e => setDrug(i, e.target.value)}
                  placeholder={`Fármaco ${i + 1} (ex: Vancomicina, Piperacilina-Tazobactam)`}
                  style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, outline: 'none', fontFamily: 'var(--font-sans)' }} />
                {drugs.length > 2 && (
                  <button onClick={() => removeDrug(i)}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: '#fee2e2', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                )}
              </div>
            ))}
          </div>

          {drugs.length < 8 && (
            <button onClick={addDrug}
              style={{ padding: '7px 14px', background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 7, fontSize: 12, color: 'var(--ink-4)', cursor: 'pointer', marginBottom: 14 }}>
              + Adicionar fármaco
            </button>
          )}

          {/* Quick add */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Fármacos frequentes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {QUICK_DRUGS.map(drug => (
                <button key={drug} onClick={() => quickAdd(drug)}
                  style={{ padding: '4px 10px', background: drugs.includes(drug) ? '#0f172a' : 'var(--bg-2)', color: drugs.includes(drug) ? 'white' : 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                  {drug}
                </button>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>{error}</div>}

          <button onClick={check} disabled={loading}
            style={{ width: '100%', padding: '13px', background: loading ? '#9ca3af' : '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                  A verificar compatibilidade...
                </span>
              : `🔬 Verificar Compatibilidade — ${drugs.filter(d=>d.trim()).length} fármacos (${Math.max(0, drugs.filter(d=>d.trim()).length * (drugs.filter(d=>d.trim()).length - 1) / 2)} pares)`
            }
          </button>
        </div>

        {/* Results */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* General recs */}
            {result.general_recommendations && (
              <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Recomendações gerais: </span>
                {result.general_recommendations}
              </div>
            )}

            {/* Pair cards */}
            {result.pairs.map((pair, i) => {
              const worst = worstStatus(pair)
              const ws = STATUS[worst]
              const isOpen = expanded === i
              return (
                <div key={i} style={{ background: 'white', border: `1px solid ${ws.border}`, borderRadius: 12, overflow: 'hidden' }}>
                  <button onClick={() => setExpanded(isOpen ? null : i)}
                    style={{ width: '100%', background: ws.bg, border: 'none', padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ws.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{ws.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{pair.drug_a} + {pair.drug_b}</div>
                        <div style={{ fontSize: 12, color: ws.color, fontWeight: 700, marginTop: 2 }}>{ws.label}</div>
                      </div>
                      {/* Y-site / admixture / syringe badges */}
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        {(['ysite', 'admixture', 'syringe'] as const).map(route => {
                          const val = pair[route]
                          if (val === 'not_applicable') return null
                          const s = STATUS[val]
                          return (
                            <div key={route} style={{ textAlign: 'center', padding: '3px 8px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5 }}>
                              <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: s.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{route === 'ysite' ? 'Y-site' : route === 'admixture' ? 'Mistura' : 'Seringa'}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>{s.icon}</div>
                            </div>
                          )
                        })}
                      </div>
                      <span style={{ fontSize: 16, color: 'var(--ink-4)', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '14px 18px', borderTop: `1px solid ${ws.border}` }}>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Detalhes</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{pair.details}</div>
                      </div>
                      {pair.clinical_note && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Nota clínica</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>{pair.clinical_note}</div>
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Fonte: {pair.evidence}</div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Disclaimer */}
            <div style={{ padding: '12px 16px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, fontSize: 11, color: '#854d0e', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
              ⚠ Compatibilidade pode variar com concentração, diluente, temperatura e prazo de validade. Confirmar sempre com referência primária (Trissel's, King Guide) e com o farmacêutico antes de administrar. Esta ferramenta é de suporte — não substitui avaliação farmacêutica presencial.
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
