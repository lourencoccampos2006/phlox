'use client'

// Phlox Calc Hub — 22+ calculadoras clínicas determinísticas e auditáveis.
// Sem AI. Lista filtrável + view focada por calculadora.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CALCULATORS, CATEGORY_LABEL, type ClinicalCalc, type CalcResult } from '@/lib/clinicalCalcs'

const TONE_COLOR: Record<CalcResult['tone'], { bg: string; border: string; text: string }> = {
  ok:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  warn:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  alert: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  info:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
}

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6, display: 'block' }

export default function CalcHubPage() {
  const [active, setActive] = useState<ClinicalCalc | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')

  const filtered = useMemo(() => CALCULATORS.filter(c => {
    if (cat !== 'all' && c.category !== cat) return false
    const t = q.trim().toLowerCase()
    if (!t) return true
    return c.name.toLowerCase().includes(t) || c.desc.toLowerCase().includes(t) || c.id.toLowerCase().includes(t)
  }), [q, cat])

  const categories = Array.from(new Set(CALCULATORS.map(c => c.category)))

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1080 }}>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Calc Hub</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,38px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Calculadoras clínicas</h1>
          <p style={{ fontSize: 13.5, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>
            {CALCULATORS.length} calculadoras determinísticas, validadas e auditáveis. Sem AI. Resultado imediato com interpretação clínica e referência.
          </p>
        </div>

        {!active ? (
          <>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar calculadora…" style={{ ...inp, flex: '1 1 260px' }} />
              <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' } as any}>
                <option value="all">Todas as categorias</option>
                {categories.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>

            {/* Grelha */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: 10 }}>
              {filtered.map(c => (
                <button key={c.id} onClick={() => setActive(c)}
                  style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'border-color 0.15s, transform 0.15s' }}
                  className="calc-card">
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{CATEGORY_LABEL[c.category]}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0b1120' }}>{c.name}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 5, lineHeight: 1.5 }}>{c.desc}</div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 14 }}>Nenhuma calculadora encontrada.</div>
              )}
            </div>

            <div style={{ marginTop: 22, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
              Ferramentas de apoio à decisão; cada resultado tem referência. Para análise por caso completo, vê <Link href="/motor-clinico" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Decision Engine →</Link>
            </div>
          </>
        ) : (
          <CalcRunner calc={active} onBack={() => setActive(null)} />
        )}
      </div>

      <style>{`.calc-card:hover { border-color: #0d6e42; transform: translateY(-1px); }`}</style>
    </div>
  )
}

function CalcRunner({ calc, onBack }: { calc: ClinicalCalc; onBack: () => void }) {
  const [v, setV] = useState<Record<string, any>>({})
  const result = useMemo(() => calc.run(v), [calc, v])
  const tone = result ? TONE_COLOR[result.tone] : null

  function set(key: string, val: any) { setV(s => ({ ...s, [key]: val })) }

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 14, padding: 0, fontFamily: 'var(--font-sans)' }}>← Todas as calculadoras</button>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }} className="calc-grid">

        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{CATEGORY_LABEL[calc.category]}</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 400, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.015em' }}>{calc.name}</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 18px', lineHeight: 1.55 }}>{calc.desc}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {calc.fields.map(f => (
              <div key={f.key}>
                <label style={lbl}>{f.label}{f.unit ? <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>· {f.unit}</span> : null}</label>
                {f.type === 'number' && <input type="number" value={v[f.key] ?? ''} min={f.min} max={f.max} step={f.step} onChange={e => set(f.key, e.target.value)} style={inp} />}
                {f.type === 'select' && (
                  <select value={v[f.key] ?? ''} onChange={e => set(f.key, e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)))} style={{ ...inp, cursor: 'pointer' } as any}>
                    <option value="">Escolher…</option>
                    {f.options?.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {f.type === 'checkbox' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${v[f.key] ? '#0d6e42' : '#e5e7eb'}`, background: v[f.key] ? '#f0fdf4' : 'white', cursor: 'pointer', fontSize: 13.5, color: '#1a202c', fontFamily: 'var(--font-sans)' }}>
                    <input type="checkbox" checked={!!v[f.key]} onChange={e => set(f.key, e.target.checked)} />
                    <span>{f.label}</span>
                  </label>
                )}
                {f.hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{f.hint}</div>}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'sticky', top: 80 }}>
          {result ? (
            <div style={{ background: tone!.bg, border: `1.5px solid ${tone!.border}`, borderRadius: 14, padding: '22px 24px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: tone!.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{result.label}</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 400, color: '#0b1120', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{result.value}</div>
              <div style={{ fontSize: 14, color: tone!.text, marginTop: 10, lineHeight: 1.55, fontWeight: 600 }}>{result.interpretation}</div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tone!.border}`, fontSize: 11.5, color: '#64748b', fontFamily: 'var(--font-mono)' }}>📚 {calc.refs}</div>
            </div>
          ) : (
            <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
              Preenche os campos para ver o resultado.
            </div>
          )}
        </div>
      </div>

      <style>{`@media (max-width: 860px){ .calc-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
