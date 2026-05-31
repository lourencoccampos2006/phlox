'use client'

// Phlox Decision Engine — motor de regras clínicas determinístico (Pro).
// Avalia um caso clínico contra 25+ regras (STOPP/Beers/renal/QTc/anticolinérgico/duplicações)
// e devolve achados com severidade, evidência e ação recomendada.

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { runRules, riskScore, SEVERITY_META, type ClinicalCase, type Finding } from '@/lib/decisionEngine'

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

function splitLines(s: string): string[] { return s.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean) }

export default function MotorClinicoPage() {
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<'M' | 'F' | ''>('')
  const [egfr, setEgfr] = useState('')
  const [qtc, setQtc] = useState('')
  const [conds, setConds] = useState('')
  const [meds, setMeds] = useState('')

  const cse: ClinicalCase = useMemo(() => ({
    age: age ? Number(age) : undefined,
    sex: sex || undefined,
    egfr: egfr ? Number(egfr) : undefined,
    qtc_ms: qtc ? Number(qtc) : undefined,
    conditions: splitLines(conds),
    meds: splitLines(meds),
  }), [age, sex, egfr, qtc, conds, meds])

  const findings = useMemo(() => runRules(cse), [cse])
  const score = useMemo(() => riskScore(findings), [findings])

  const grouped = useMemo(() => {
    const g: Record<string, Finding[]> = {}
    findings.forEach(f => { (g[f.severity] ||= []).push(f) })
    return g
  }, [findings])

  const order: Finding['severity'][] = ['critical', 'major', 'moderate', 'minor', 'info']

  const scoreColor = score >= 60 ? '#dc2626' : score >= 30 ? '#d97706' : score > 0 ? '#2563eb' : '#16a34a'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1080 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · Motor clínico (Pro)</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Decision Engine</h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>25+ regras determinísticas (STOPP/Beers, função renal, QTc, carga anticolinérgica, interações graves). Sem AI — auditável e replicável.</p>
        </div>

        <div className="motor-grid" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16, alignItems: 'start' }}>
          {/* Form */}
          <div style={{ ...card }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><span style={lbl}>Idade</span><input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="anos" style={inp} /></div>
              <div>
                <span style={lbl}>Sexo</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['M', 'F'] as const).map(s => <button key={s} onClick={() => setSex(sex === s ? '' : s)} style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13, fontWeight: 700, border: `1.5px solid ${sex === s ? '#0d6e42' : 'var(--border)'}`, background: sex === s ? '#eef6f1' : 'white', color: sex === s ? '#0d6e42' : 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{s}</button>)}
                </div>
              </div>
              <div><span style={lbl}>TFG</span><input type="number" value={egfr} onChange={e => setEgfr(e.target.value)} placeholder="mL/min" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 12 }}><span style={lbl}>QTc (ms)</span><input type="number" value={qtc} onChange={e => setQtc(e.target.value)} placeholder="opcional" style={inp} /></div>
            <div style={{ marginBottom: 12 }}>
              <span style={lbl}>Condições (uma por linha ou separadas por vírgula)</span>
              <textarea value={conds} onChange={e => setConds(e.target.value)} rows={3} placeholder="Ex: insuficiência cardíaca, asma, demência…" style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div>
              <span style={lbl}>Medicação (DCI ou nome)</span>
              <textarea value={meds} onChange={e => setMeds(e.target.value)} rows={7} placeholder={'Ex:\nFurosemida 40 mg\nVarfarina 5 mg\nIbuprofeno 400 mg\nDigoxina 0,25 mg\nDiazepam 5 mg'} style={{ ...inp, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12.5 }} />
            </div>
            <button onClick={() => { setAge(''); setSex(''); setEgfr(''); setQtc(''); setConds(''); setMeds('') }} style={{ marginTop: 12, padding: '8px 12px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Limpar caso</button>
          </div>

          {/* Findings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                <svg width="76" height="76" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle cx="38" cy="38" r="32" fill="none" stroke={scoreColor} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 32}`} strokeDashoffset={`${2 * Math.PI * 32 * (1 - score / 100)}`}
                    transform="rotate(-90 38 38)" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 800, color: scoreColor }}>{score}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>Pontuação de risco</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 3 }}>
                  {findings.length === 0 ? 'Sem achados para este caso.' : `${findings.length} achado(s) · ${order.map(s => grouped[s]?.length || 0).join(' / ')} (crítico/grave/moderado/ligeiro/info)`}
                </div>
              </div>
            </div>

            {findings.length === 0 && (cse.meds?.length ?? 0) > 0 && (
              <div style={{ ...card, color: '#16a34a', fontSize: 14, fontWeight: 600 }}>Nada de relevante identificado nas regras atuais.</div>
            )}
            {findings.length === 0 && (cse.meds?.length ?? 0) === 0 && (
              <div style={{ ...card, color: 'var(--ink-4)', fontSize: 13.5 }}>Preenche o caso à esquerda. As regras correm em tempo real.</div>
            )}

            {order.map(sev => grouped[sev] && grouped[sev].length > 0 && (
              <div key={sev}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: SEVERITY_META[sev].color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{SEVERITY_META[sev].label}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{grouped[sev].length} achado(s)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {grouped[sev].map(f => (
                    <div key={f.id} style={{ background: 'white', border: `1px solid ${SEVERITY_META[sev].bg}`, borderLeft: `3px solid ${SEVERITY_META[sev].color}`, borderRadius: 10, padding: '13px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{f.title}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-5)' }}>#{f.id}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 5, lineHeight: 1.55 }}>{f.detail}</div>
                      {f.action && <div style={{ fontSize: 12.5, color: SEVERITY_META[sev].color, marginTop: 7, fontWeight: 600 }}>▸ {f.action}</div>}
                      {(f.reference || f.involves?.length) && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 9, paddingTop: 9, borderTop: '1px dashed var(--bg-2)', fontSize: 11, color: 'var(--ink-5)', flexWrap: 'wrap' }}>
                          {f.reference && <span>📚 {f.reference}</span>}
                          {f.involves && f.involves.length > 0 && <span>📌 {f.involves.join(' · ')}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11.5, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6, padding: '4px 0 0' }}>
              Ferramenta de apoio à decisão. Não substitui o julgamento clínico nem normas locais. <Link href="/auditoria" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Ver Audit Trail →</Link>
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 860px){ .motor-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
