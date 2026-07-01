'use client'

// /calculos — HUB ÚNICO de calculadoras clínicas (2026-06-28 consolidação).
// Junta o melhor das 3 antigas: a riqueza dos dados (lib/clinicalCalcs.ts, 22+
// calculadoras e escalas determinísticas e auditáveis) com a UX mobile-first
// (pesquisa + cartões por categoria + vista de foco). /calc e /calculators agora
// redirecionam para aqui — um só sítio, sem duplicação.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { CALCULATORS, CATEGORY_LABEL, type ClinicalCalc, type CalcResult } from '@/lib/clinicalCalcs'
import { usePhloxContext } from '@/lib/copilotContext'

const ACCENT = '#0d6e42'

// Cor por categoria (chave = id de categoria do clinicalCalcs).
const CAT_COLOR: Record<string, string> = {
  renal: '#0891b2', cardio: '#dc2626', metabolic: '#ca8a04', icu: '#7c3aed', hema: '#1d4ed8', hepatic: '#b45309', general: '#0d6e42',
}
const TONE: Record<CalcResult['tone'], { bg: string; border: string; text: string }> = {
  ok:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
  warn:  { bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
  alert: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
  info:  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
}

// Ferramentas especializadas relacionadas (páginas próprias).
const RELATED: { href: string; icon: string; label: string; desc: string }[] = [
  { href: '/iv-calc', icon: '💧', label: 'Cálculo de gotejo IV', desc: 'mL/h, gotas/min, tempo de infusão' },
  { href: '/dose-crianca', icon: '👶', label: 'Dose pediátrica', desc: 'Por peso, com limites de segurança' },
  { href: '/iv-compatibility', icon: '🧪', label: 'Compatibilidade IV', desc: 'Misturar fármacos na mesma via' },
  { href: '/antibiotics', icon: '🦠', label: 'Antibioterapia', desc: 'Escolha e dose por infeção' },
  { href: '/emergency-doses', icon: '🚨', label: 'Doses de urgência', desc: 'Fármacos de emergência por peso' },
]

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }

export default function Calculos() {
  const [active, setActive] = useState<ClinicalCalc | null>(null)
  const [q, setQ] = useState('')

  // Contexto p/ o Copilot: a calculadora/escala aberta.
  usePhloxContext(
    active ? `Calculadora: ${active.name}` : '',
    active ? { calculadora: active.name, para: active.desc } : null as any
  )

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const list = useMemo(() => q.trim()
    ? CALCULATORS.filter(c => norm(c.name + ' ' + c.desc + ' ' + CATEGORY_LABEL[c.category]).includes(norm(q)))
    : CALCULATORS, [q])

  // ── Calculadora aberta (foco total, ótima em mobile) ──
  if (active) {
    const catC = CAT_COLOR[active.category] || ACCENT
    return (
      <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px clamp(14px,4vw,24px) 60px' }}>
          <button onClick={() => setActive(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: ACCENT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 16 }}>← Calculadoras</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 18 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,5vw,26px)', fontWeight: 500, color: '#0b1120', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{active.name}</h1>
              <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4 }}>{active.desc}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: catC, background: catC + '14', padding: '3px 10px', borderRadius: 20 }}>{CATEGORY_LABEL[active.category]}</span>
          </div>
          <CalcRunner calc={active} />
        </div>
        <CalcStyles />
      </div>
    )
  }

  // ── Índice — pesquisa + cartões por categoria ──
  const cats = Array.from(new Set(CALCULATORS.map(c => c.category)))
  const byCat = cats.map(cat => ({ cat, items: list.filter(c => c.category === cat) })).filter(g => g.items.length > 0)

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '22px clamp(14px,4vw,24px) 70px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Ferramentas clínicas</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Calculadoras</h1>
        <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 18px', lineHeight: 1.5 }}>{CALCULATORS.length} calculadoras e escalas determinísticas, com interpretação e referência. Toque numa para abrir.</p>

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar (ex: renal, CHA2DS2, sépsis, peso…)"
            style={{ width: '100%', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px 12px 40px', fontSize: 15, fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }} />
        </div>

        {byCat.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '40px 0', fontSize: 14 }}>Nada encontrado para “{q}”.</div>
        ) : byCat.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: CAT_COLOR[cat] || '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{CATEGORY_LABEL[cat as ClinicalCalc['category']]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
              {items.map(c => (
                <button key={c.id} onClick={() => setActive(c)} className="calc-card"
                  style={{ display: 'block', background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0b1120', lineHeight: 1.3 }}>{c.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {!q.trim() && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ferramentas relacionadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {RELATED.map(r => (
                <a key={r.href} href={r.href} className="calc-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '14px 15px', textDecoration: 'none', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{r.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#0b1120', lineHeight: 1.25 }}>{r.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: '#94a3b8', marginTop: 2 }}>{r.desc}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          Apoio à decisão — cada resultado tem referência. Para uma análise por caso completo, vê o <Link href="/motor-clinico" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Motor Clínico →</Link>
        </div>
      </div>
      <CalcStyles />
    </div>
  )
}

// Renderiza qualquer ClinicalCalc (number/select/checkbox) + resultado com tom.
function CalcRunner({ calc }: { calc: ClinicalCalc }) {
  const [v, setV] = useState<Record<string, any>>({})
  const result = useMemo(() => { try { return calc.run(v) } catch { return null } }, [calc, v])
  const tone = result ? TONE[result.tone] : null
  const set = (key: string, val: any) => setV(s => ({ ...s, [key]: val }))

  return (
    <div className="calc-panel" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: 'clamp(16px,5vw,20px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {calc.fields.map(f => (
            <div key={f.key}>
              {f.type !== 'checkbox' && <label style={lbl}>{f.label}{f.unit ? <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>· {f.unit}</span> : null}</label>}
              {f.type === 'number' && <input type="number" inputMode="decimal" value={v[f.key] ?? ''} min={f.min} max={f.max} step={f.step} onChange={e => set(f.key, e.target.value)} style={inp} />}
              {f.type === 'select' && (
                <select value={v[f.key] ?? ''} onChange={e => set(f.key, e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)))} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Escolher…</option>
                  {f.options?.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {f.type === 'checkbox' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${v[f.key] ? ACCENT : '#e5e7eb'}`, background: v[f.key] ? '#f0fdf4' : 'white', cursor: 'pointer', fontSize: 13.5, color: '#1a202c' }}>
                  <input type="checkbox" checked={!!v[f.key]} onChange={e => set(f.key, e.target.checked)} />
                  <span>{f.label}</span>
                </label>
              )}
              {f.hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{f.hint}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'sticky', top: 20 }}>
        {result && tone ? (
          <div style={{ background: tone.bg, border: `1.5px solid ${tone.border}`, borderRadius: 16, padding: '20px 22px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: tone.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{result.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 34, fontWeight: 400, color: '#0b1120', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{result.value}</div>
            <div style={{ fontSize: 14, color: tone.text, marginTop: 10, lineHeight: 1.55, fontWeight: 600 }}>{result.interpretation}</div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tone.border}`, fontSize: 11.5, color: '#64748b', fontFamily: 'var(--font-mono)' }}>📚 {calc.refs}</div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '36px 22px', textAlign: 'center', color: '#94a3b8', fontSize: 13.5 }}>
            Preencha os campos para ver o resultado.
          </div>
        )}
      </div>
    </div>
  )
}

function CalcStyles() {
  return (
    <style>{`
      .calc-card:hover { border-color: #0d6e4266 !important; transform: translateY(-2px); }
      @media(max-width:620px){
        .calc-panel { grid-template-columns: 1fr !important; }
        .calc-panel [style*="grid-template-columns"]{ grid-template-columns:1fr!important; }
      }
      .calc-panel input:focus{ border-color:#0d6e42!important; box-shadow:0 0 0 3px #0d6e4220; }
      .calc-panel select:focus{ outline:2px solid #0d6e42; outline-offset:1px; }
    `}</style>
  )
}
