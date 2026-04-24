'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'

type Via = 'IV' | 'SC' | 'IM'

const VIAS: { id: Via; label: string; desc: string }[] = [
  { id: 'IV', label: 'Intravenosa',   desc: 'Compatibilidade de linha, concentrações, ritmo' },
  { id: 'SC', label: 'Subcutânea',    desc: 'Compatibilidade CSCI, volume por local, seringa driver' },
  { id: 'IM', label: 'Intramuscular', desc: 'Compatibilidade, volume por local, notas clínicas' },
]

const COMPAT_EXAMPLES = [
  { drugs: ['morfina', 'midazolam'],        via: 'SC' as Via },
  { drugs: ['morfina', 'dexametasona'],     via: 'SC' as Via },
  { drugs: ['vancomicina', 'piperacilina'], via: 'IV' as Via },
  { drugs: ['furosemida', 'amiodarona'],    via: 'IV' as Via },
  { drugs: ['ceftriaxona', 'metronidazol'], via: 'IV' as Via },
  { drugs: ['haloperidol', 'metoclopramida'], via: 'SC' as Via },
]

const SINGLE_EXAMPLES = [
  { drug: 'vancomicina',   via: 'IV' as Via },
  { drug: 'fenitoína',     via: 'IV' as Via },
  { drug: 'morfina',       via: 'SC' as Via },
  { drug: 'ceftriaxona',   via: 'IM' as Via },
  { drug: 'amiodarona',    via: 'IV' as Via },
  { drug: 'insulina',      via: 'SC' as Via },
]

export default function NursingPage() {
  const { user, supabase } = useAuth()
  const [via, setVia] = useState<Via>('IV')
  const [drug1, setDrug1] = useState('')
  const [drug2, setDrug2] = useState('')
  const [dose, setDose] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const drugs = [drug1.trim(), drug2.trim()].filter(Boolean)
  const isCompat = drugs.length > 1

  const check = async (overrideDrugs?: string[], overrideVia?: Via) => {
    const d = overrideDrugs ?? drugs
    const v = overrideVia ?? via
    if (d.length === 0) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (sd.session?.access_token) headers['Authorization'] = `Bearer ${sd.session.access_token}`
      const res = await fetch('/api/nursing', {
        method: 'POST', headers,
        body: JSON.stringify({ drugs: d, via: v, dose: dose.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) {
      setError(e.message || 'Erro. Tenta novamente.')
    } finally { setLoading(false) }
  }

  const COMPAT_COLOR = {
    true:         { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', text: '#14532d', label: 'COMPATÍVEIS' },
    false:        { bg: '#fff5f5', border: '#fecaca', dot: '#ef4444', text: '#7f1d1d', label: 'INCOMPATÍVEIS' },
    condicional:  { bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b', text: '#78350f', label: 'CONDICIONAL' },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />
      <div className="page-container page-body">
        <div className="interactions-layout">

          {/* LEFT */}
          <div className="sticky-panel">
            <div style={{ marginBottom: 18 }}>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', marginBottom: 6, letterSpacing: '-0.01em' }}>Farmacotecnia Clínica</h1>
              <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
                Compatibilidades, concentrações limite e notas clínicas por via. Para farmacêuticos e enfermeiros.
              </p>
            </div>

            {/* Via */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
              {VIAS.map(v => (
                <button key={v.id} onClick={() => setVia(v.id)}
                  style={{ padding: '10px 6px', border: `2px solid ${via === v.id ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: via === v.id ? 'var(--green-light)' : 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: via === v.id ? 'var(--green)' : 'var(--ink)', letterSpacing: '0.04em' }}>{v.id}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2, lineHeight: 1.3 }}>{v.label}</div>
                </button>
              ))}
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Fármaco 1
              </label>
              <input value={drug1} onChange={e => setDrug1(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Ex: morfina, vancomicina..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                Fármaco 2
                <span style={{ color: 'var(--green-2)', marginLeft: 6, letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--font-sans)' }}>→ para verificar compatibilidade</span>
              </label>
              <input value={drug2} onChange={e => setDrug2(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Opcional — compatibilidade na mesma via"
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '14px', marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Dose / Concentração (opcional)
              </label>
              <input value={dose} onChange={e => setDose(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
                placeholder="Ex: 500mg em 100mL SF, 1mg/mL..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            </div>

            <button onClick={() => check()} disabled={drugs.length === 0 || loading}
              style={{ width: '100%', background: drugs.length > 0 && !loading ? 'var(--green)' : 'var(--bg-3)', color: drugs.length > 0 && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, padding: '13px', fontSize: 14, fontWeight: 600, cursor: drugs.length > 0 && !loading ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', marginBottom: 20, letterSpacing: '-0.01em' }}>
              {loading ? 'A verificar...' : isCompat ? `Verificar compatibilidade ${via} →` : `Consultar ${via} →`}
            </button>

            {/* Examples */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Compatibilidades frequentes
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {COMPAT_EXAMPLES.map(ex => (
                  <button key={ex.drugs.join('+')} onClick={() => { setDrug1(ex.drugs[0]); setDrug2(ex.drugs[1]); setVia(ex.via); check(ex.drugs, ex.via) }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, letterSpacing: '-0.01em' }}>{ex.drugs.join(' + ')}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, background: 'var(--bg-2)', color: 'var(--ink-4)', padding: '1px 6px', borderRadius: 4, flexShrink: 0 }}>{ex.via}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Fármacos individuais
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {SINGLE_EXAMPLES.map(ex => (
                  <button key={ex.drug + ex.via} onClick={() => { setDrug1(ex.drug); setDrug2(''); setVia(ex.via); check([ex.drug], ex.via) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'white', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)' }}>
                    <span>{ex.drug}</span>
                    <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>{ex.via}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[60, 80, 100, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 8 }} />)}
              </div>
            )}

            {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '20px' }}><p style={{ fontSize: 14, color: '#742a2a', margin: 0 }}>{error}</p></div>}

            {!result && !loading && !error && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>⚗️</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-2)', marginBottom: 10, letterSpacing: '-0.01em' }}>Farmacotecnia clínica</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
                  1 fármaco: concentrações, diluentes, estabilidade, incompatibilidades.<br/>
                  2 fármacos: compatibilidade na mesma via em simultâneo.
                </p>
              </div>
            )}

            {result && !loading && (
              <div className="fade-in">
                {result.mode === 'compatibility' ? (
                  // ─── COMPATIBILITY RESULT ───────────────────────────────────
                  <div>
                    {/* Verdict */}
                    {(() => {
                      const key = String(result.compatible) as 'true' | 'false' | 'condicional'
                      const s = COMPAT_COLOR[key] || COMPAT_COLOR['condicional']
                      return (
                        <div style={{ background: s.bg, border: `2px solid ${s.dot}`, borderRadius: 10, padding: '20px 22px', marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: s.text, letterSpacing: '0.08em' }}>{s.label}</span>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: s.text, opacity: 0.7 }}>via {result.via}</span>
                          </div>
                          <p style={{ fontSize: 15, color: s.text, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{result.verdict}</p>
                          {result.evidence_source && (
                            <p style={{ fontSize: 11, color: s.text, opacity: 0.7, margin: 0, fontFamily: 'var(--font-mono)' }}>Fonte: {result.evidence_source}</p>
                          )}
                        </div>
                      )
                    })()}

                    {/* Details */}
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      {[
                        { label: 'Compatibilidade física', value: result.physical_compatibility, warn: false },
                        { label: 'Compatibilidade química', value: result.chemical_compatibility, warn: false },
                        result.incompatibility_mechanism && { label: 'Mecanismo de incompatibilidade', value: result.incompatibility_mechanism, warn: true },
                        result.conditions_if_conditional && { label: 'Condições para uso', value: result.conditions_if_conditional, warn: false },
                        result.time_window && { label: 'Janela temporal', value: result.time_window, warn: false },
                      ].filter(Boolean).map((row: any, i, arr) => (
                        <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>{row.label}</span>
                          </div>
                          <div style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: 13, color: row.warn ? '#7f1d1d' : 'var(--ink-2)', lineHeight: 1.5 }}>{row.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {result.alternatives?.length > 0 && (
                      <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 8, padding: '14px 18px', marginTop: 10 }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Alternativas práticas</div>
                        {result.alternatives.map((a: string, i: number) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>→ {a}</div>
                        ))}
                      </div>
                    )}

                    {result.clinical_notes?.length > 0 && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', marginTop: 10, background: 'white' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Notas clínicas</div>
                        {result.clinical_notes.map((n: string, i: number) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.5 }}>· {n}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  // ─── SINGLE DRUG RESULT ─────────────────────────────────────
                  <div>
                    {/* Suitability header */}
                    <div style={{ background: result.suitable_for_via ? 'var(--green)' : '#dc2626', borderRadius: '10px 10px 0 0', padding: '16px 22px' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', marginBottom: 4 }}>VIA {result.via}</div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'white', letterSpacing: '-0.01em' }}>{result.drug}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                        {result.suitable_for_via ? '✓ Adequado para esta via' : `✗ ${result.unsuitable_reason}`}
                      </div>
                    </div>

                    {/* Concentration limits — always first, most critical */}
                    {result.concentration_limits && (result.concentration_limits.max || result.concentration_limits.recommended) && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderTop: 'none', padding: '14px 20px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#92400e', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>⚠ Concentrações</div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          {result.concentration_limits.max && (
                            <div style={{ fontSize: 13, color: '#78350f' }}><strong>Máxima:</strong> {result.concentration_limits.max}</div>
                          )}
                          {result.concentration_limits.recommended && (
                            <div style={{ fontSize: 13, color: '#78350f' }}><strong>Recomendada:</strong> {result.concentration_limits.recommended}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rate critical */}
                    {result.rate_critical_info && (
                      <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderTop: 'none', padding: '14px 20px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7f1d1d', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>🚨 Ritmo — crítico</div>
                        <p style={{ fontSize: 13, color: '#742a2a', margin: 0, lineHeight: 1.6 }}>{result.rate_critical_info}</p>
                      </div>
                    )}

                    {/* Info table */}
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', overflow: 'hidden' }}>
                      {[
                        { label: 'Diluentes compatíveis', value: result.diluents_compatible?.join(', ') },
                        result.diluents_incompatible?.length > 0 && { label: 'Diluentes a evitar', value: result.diluents_incompatible.join(', '), warn: true },
                        { label: 'Estabilidade reconstituído', value: result.stability_reconstituted },
                        { label: 'Estabilidade diluído', value: result.stability_diluted },
                        result.ph_range && { label: 'pH', value: result.ph_range },
                        result.osmolarity && { label: 'Osmolaridade', value: result.osmolarity },
                      ].filter(Boolean).map((row: any, i, arr) => (
                        <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '180px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <div style={{ padding: '11px 14px', background: 'var(--bg-2)', borderRight: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: row.warn ? '#dc2626' : 'var(--ink-4)', letterSpacing: '0.06em' }}>{row.label}</span>
                          </div>
                          <div style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 13, color: row.warn ? '#7f1d1d' : 'var(--ink-2)' }}>{row.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Incompatible drugs */}
                    {result.incompatible_drugs_common?.length > 0 && (
                      <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderTop: 'none', padding: '14px 20px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7f1d1d', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Incompatível com (comum)</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {result.incompatible_drugs_common.map((d: string) => (
                            <span key={d} style={{ fontSize: 12, background: 'white', border: '1px solid #fecaca', borderRadius: 12, padding: '2px 10px', color: '#742a2a', fontFamily: 'var(--font-mono)' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special warnings */}
                    {result.special_warnings?.length > 0 && (
                      <div style={{ background: 'white', border: '1px solid var(--border)', borderTop: 'none', padding: '14px 20px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--amber)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Alertas específicos</div>
                        {result.special_warnings.map((w: string, i: number) => (
                          <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4, lineHeight: 1.5 }}>· {w}</div>
                        ))}
                      </div>
                    )}

                    {/* SC specific */}
                    {result.sc_specific && (
                      <div style={{ background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '14px 20px' }}>
                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green-2)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Infusão SC (CSCI)</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 4 }}>Volume máx. por local: <strong>{result.sc_specific.max_volume_per_site}</strong></div>
                        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: result.sc_specific.csci_notes ? 4 : 0 }}>
                          Adequado para CSCI: <strong>{result.sc_specific.suitable_for_csci ? 'Sim' : 'Não'}</strong>
                        </div>
                        {result.sc_specific.csci_notes && <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{result.sc_specific.csci_notes}</div>}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
                  ⚕️ Confirma sempre com a farmácia do hospital. A compatibilidade pode variar com concentração e tempo.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}