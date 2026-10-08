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
import IVReference from '@/components/calc/IVReference'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

const ACCENT = 'var(--green)'

// Cor por categoria (chave = id de categoria do clinicalCalcs).
const CAT_COLOR: Record<string, string> = {
  renal: 'var(--green)', cardio: 'var(--red)', metabolic: 'var(--amber)', icu: 'var(--roxo)', hema: 'var(--ink-2)', hepatic: 'var(--amber)', general: 'var(--green)',
}
const TONE: Record<CalcResult['tone'], { bg: string; border: string; text: string }> = {
  ok:    { bg: 'var(--badge-green-bg)', border: 'var(--green-mid)', text: 'var(--green)' },
  warn:  { bg: 'var(--badge-amber-bg)', border: 'var(--badge-amber-border)', text: 'var(--amber)' },
  alert: { bg: 'var(--badge-red-bg)', border: 'var(--badge-red-border)', text: 'var(--red)' },
  info:  { bg: 'var(--bg-2)', border: 'var(--border)', text: 'var(--ink-2)' },
}

// Ferramentas especializadas relacionadas (páginas próprias).
const RELATED: { href: string; icon: string; label: string; desc: string }[] = [
  { href: '/dose-crianca', icon: 'family', label: 'Dose pediátrica', desc: 'Por peso, com limites de segurança' },
  { href: '/iv-compatibility', icon: 'flask', label: 'Compatibilidade IV', desc: 'Misturar fármacos na mesma via' },
  { href: '/antibiotics', icon: '🦠', label: 'Antibioterapia', desc: 'Escolha e dose por infeção' },
  { href: '/emergency-doses', icon: 'alert', label: 'Doses de urgência', desc: 'Fármacos de emergência por peso' },
]

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px', fontSize: 'var(--t-corpo)', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-3)', marginBottom: 6 }

export default function Calculos() {
  const [active, setActive] = useState<ClinicalCalc | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'calc' | 'ref'>('calc')

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
          <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Cálculos</span>
        </BarraDeTrabalho>
      }
    >
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '20px clamp(14px,4vw,24px) 60px' }}>
          <button onClick={() => setActive(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: ACCENT, fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 16 }}>← Calculadoras</button>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 18 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(20px,5vw,26px)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.15 }}>{active.name}</h1>
              <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', marginTop: 4 }}>{active.desc}</div>
            </div>
            <span style={{ flexShrink: 0, fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: catC, background: catC + '14', padding: '3px 10px', borderRadius: 'var(--r-xl)' }}>{CATEGORY_LABEL[active.category]}</span>
          </div>
          <CalcRunner calc={active} />
        </div>
        <CalcStyles />
      </Mesa>
    )
  }

  // ── Índice — pesquisa + cartões por categoria ──
  const cats = Array.from(new Set(CALCULATORS.map(c => c.category)))
  const byCat = cats.map(cat => ({ cat, items: list.filter(c => c.category === cat) })).filter(g => g.items.length > 0)

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Cálculos</span>
        </BarraDeTrabalho>
      }
    >
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '22px clamp(14px,4vw,24px) 70px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 'var(--peso-forte)' as any, marginBottom: 6 }}>Ferramentas clínicas</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Calculadoras</h1>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', margin: '0 0 18px', lineHeight: 1.5 }}>{CALCULATORS.length} calculadoras e escalas determinísticas, com interpretação e referência. Toque numa para abrir.</p>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {([{ k: 'calc', l: 'Calculadoras & Escalas' }, { k: 'ref', l: 'Referência IV' }] as const).map(x => (
            <button key={x.k} onClick={() => setTab(x.k)}
              style={{ padding: '9px 16px', borderRadius: 'var(--r-md)', border: `1.5px solid ${tab === x.k ? ACCENT : 'var(--border)'}`, background: tab === x.k ? ACCENT : 'white', color: tab === x.k ? 'white' : 'var(--ink-4)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'inherit' }}>
              {x.l}
            </button>
          ))}
        </div>

        {tab === 'ref' ? <IVReference /> : <>

        <div style={{ position: 'relative', marginBottom: 20 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar (ex: renal, CHA2DS2, sépsis, peso, PHQ-9…)"
            style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '12px 14px 12px 40px', fontSize: 'var(--t-corpo)', fontFamily: 'inherit', outline: 'none', background: 'white', boxSizing: 'border-box' }} />
        </div>

        {byCat.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--ink-5)', padding: '40px 0', fontSize: 'var(--t-corpo)' }}>Nada encontrado para “{q}”.</div>
        ) : byCat.map(({ cat, items }) => (
          <div key={cat} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: CAT_COLOR[cat] || 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{CATEGORY_LABEL[cat as ClinicalCalc['category']]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 10 }}>
              {items.map(c => (
                <button key={c.id} onClick={() => setActive(c)} className="calc-card"
                  style={{ display: 'block', background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '14px 16px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <span style={{ display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', lineHeight: 1.3 }}>{c.name}</span>
                  <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 4, lineHeight: 1.45 }}>{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {!q.trim() && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Ferramentas relacionadas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              {RELATED.map(r => (
                <a key={r.href} href={r.href} className="calc-card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '14px 15px', textDecoration: 'none', transition: 'border-color 0.15s, transform 0.12s' }}>
                  <Icon name={r.icon} size={24} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', lineHeight: 1.25 }}>{r.label}</span>
                    <span style={{ display: 'block', fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 2 }}>{r.desc}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 22, fontSize: 'var(--t-meta)', color: 'var(--ink-5)', lineHeight: 1.6 }}>
          Apoio à decisão — cada resultado tem referência. Para uma análise por caso completo, vê o <Link href="/assessments?tab=motor-clinico" style={{ color: ACCENT, fontWeight: 'var(--peso-forte)' as any, textDecoration: 'none' }}>Motor Clínico →</Link>
        </div>
        </>}
      </div>
      <CalcStyles />
    </Mesa>
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
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 'clamp(16px,5vw,20px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {calc.fields.map(f => (
            <div key={f.key}>
              {f.type !== 'checkbox' && <label style={lbl}>{f.label}{f.unit ? <span style={{ color: 'var(--ink-5)', fontWeight: 'var(--peso-normal)' as any, marginLeft: 4 }}>· {f.unit}</span> : null}</label>}
              {f.type === 'number' && <input type="number" inputMode="decimal" value={v[f.key] ?? ''} min={f.min} max={f.max} step={f.step} onChange={e => set(f.key, e.target.value)} style={inp} />}
              {f.type === 'select' && (
                <select value={v[f.key] ?? ''} onChange={e => set(f.key, e.target.value === '' ? '' : (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)))} style={{ ...inp, cursor: 'pointer' }}>
                  <option value="">Escolher…</option>
                  {f.options?.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {f.type === 'checkbox' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 'var(--r-lg)', border: `1.5px solid ${v[f.key] ? ACCENT : 'var(--border)'}`, background: v[f.key] ? 'var(--badge-green-bg)' : 'white', cursor: 'pointer', fontSize: 'var(--t-dado)', color: 'var(--badge-blue-fg)' }}>
                  <input type="checkbox" checked={!!v[f.key]} onChange={e => set(f.key, e.target.checked)} />
                  <span>{f.label}</span>
                </label>
              )}
              {f.hint && <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginTop: 3 }}>{f.hint}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'sticky', top: 20 }}>
        {result && tone ? (
          <div style={{ background: tone.bg, border: `1.5px solid ${tone.border}`, borderRadius: 'var(--r-xl)', padding: '20px 22px' }}>
            <div style={{ fontSize: 'var(--t-micro)', fontWeight: 'var(--peso-forte)' as any, color: tone.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>{result.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-numero)', fontWeight: 'var(--peso-normal)' as any, color: 'var(--ink)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{result.value}</div>
            <div style={{ fontSize: 'var(--t-corpo)', color: tone.text, marginTop: 10, lineHeight: 1.55, fontWeight: 'var(--peso-corpo)' as any }}>{result.interpretation}</div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${tone.border}`, fontSize: 'var(--t-meta)', color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{calc.refs}</div>
          </div>
        ) : (
          <div style={{ background: 'white', border: '1px dashed var(--border-2)', borderRadius: 'var(--r-xl)', padding: '36px 22px', textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>
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
      .calc-card:hover { border-color: color-mix(in srgb, var(--green) 40%, transparent) !important; transform: translateY(-2px); }
      @media(max-width:620px){
        .calc-panel { grid-template-columns: 1fr !important; }
        .calc-panel [style*="grid-template-columns"]{ grid-template-columns:1fr!important; }
      }
      .calc-panel input:focus{ border-color:var(--green)!important; box-shadow:0 0 0 3px color-mix(in srgb, var(--green) 12%, transparent); }
      .calc-panel select:focus{ outline:2px solid var(--green); outline-offset:1px; }
    `}</style>
  )
}
