// components/DrugQuickLook.tsx
// Modal de ficha rápida de medicamento — aparece em qualquer página.
// Invoca-se com: <DrugQuickLook trigger={<button>Metformina</button>} drug="metformina" />
// Ou controlado: const [open, setOpen] = useState(false); <DrugQuickLook open={open} onClose={() => setOpen(false)} drug={drug} />

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface DrugData {
  name: string
  brand_names_pt: string[]
  class: string
  subclass: string
  mechanism: string
  indications: string[]
  contraindications: string[]
  dosing: {
    adult_standard: string
    adult_max: string
    renal_note?: string
    hepatic_note?: string
    elderly_note?: string
  }
  adverse_effects: {
    common: string[]
    serious: string[]
    monitoring: string[]
  }
  key_interactions: { drug: string; severity: 'GRAVE' | 'MODERADA' | 'LIGEIRA'; effect: string }[]
  pharmacokinetics: {
    absorption: string
    half_life: string
    metabolism: string
    excretion: string
  }
  pregnancy: string
  lactation: string
  patient_counselling: string[]
  clinical_pearls: string[]
  available_forms_pt: string[]
  infarmed_url: string | null
  last_updated_guideline: string
}

const SEV_STYLE = {
  GRAVE:    { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
  MODERADA: { color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  LIGEIRA:  { color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe' },
}

interface Props {
  drug?: string
  open?: boolean
  onClose?: () => void
  trigger?: React.ReactNode
}

export default function DrugQuickLook({ drug: drugProp, open: openProp, onClose, trigger }: Props) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [drugInput, setDrugInput] = useState(drugProp || '')
  const [data, setData] = useState<DrugData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'dosing' | 'safety' | 'pk' | 'counselling'>('overview')
  const overlayRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const isOpen = openProp !== undefined ? openProp : internalOpen
  const handleClose = () => { onClose?.(); setInternalOpen(false) }

  const fetchDrug = useCallback(async (name: string) => {
    if (!name.trim()) return
    setLoading(true); setError(''); setData(null)
    try {
      const res = await fetch('/api/quick-drug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug: name.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setData(d)
      setTab('overview')
    } catch (e: any) { setError(e.message || 'Erro ao carregar ficha.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (isOpen && drugProp) { setDrugInput(drugProp); fetchDrug(drugProp) }
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100)
  }, [isOpen, drugProp, fetchDrug])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const lbl: React.CSSProperties = { fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }

  const tabBtnStyle = (t: string): React.CSSProperties => ({
    padding: '7px 12px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: tab === t ? 700 : 500,
    color: tab === t ? 'var(--green)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase',
    whiteSpace: 'nowrap', marginBottom: -1, flexShrink: 0,
  })

  if (!isOpen && !trigger) return null

  return (
    <>
      {/* Trigger */}
      {trigger && (
        <span onClick={() => setInternalOpen(true)} style={{ cursor: 'pointer', display: 'inline-flex' }}>
          {trigger}
        </span>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          ref={overlayRef}
          onClick={e => { if (e.target === overlayRef.current) handleClose() }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'white', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--green-light)', border: '1px solid var(--green-mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round"><path d="M12 3v18M3 12h18"/></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 2 }}>Phlox — Ficha Rápida</div>
                <input
                  ref={inputRef}
                  value={drugInput}
                  onChange={e => setDrugInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && fetchDrug(drugInput)}
                  placeholder="Nome do medicamento ou DCI..."
                  style={{ border: 'none', outline: 'none', fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', width: '100%', background: 'transparent', letterSpacing: '-0.01em' }}
                />
              </div>
              <button onClick={() => fetchDrug(drugInput)} disabled={loading || !drugInput.trim()}
                style={{ padding: '6px 14px', background: loading || !drugInput.trim() ? 'var(--bg-3)' : 'var(--green)', color: loading || !drugInput.trim() ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', flexShrink: 0 }}>
                {loading ? '...' : 'Pesquisar'}
              </button>
              <button onClick={handleClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 20, padding: '0 4px', lineHeight: 1, flexShrink: 0 }}>×</button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', letterSpacing: '0.1em' }}>A consultar base farmacológica...</div>
                </div>
              )}

              {error && !loading && (
                <div style={{ padding: '24px 20px' }}>
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '14px 16px', fontSize: 13, color: '#991b1b' }}>{error}</div>
                </div>
              )}

              {!data && !loading && !error && (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-4)' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, marginBottom: 8 }}>Pesquisa qualquer medicamento</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>DCI, nome comercial, classe farmacológica — a ficha completa em segundos.</div>
                </div>
              )}

              {data && !loading && (
                <>
                  {/* Drug title */}
                  <div style={{ padding: '16px 20px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ marginBottom: 10 }}>
                      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.01em', fontWeight: 400 }}>{data.name}</h2>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-light)', border: '1px solid var(--green-mid)', padding: '2px 8px', borderRadius: 3 }}>{data.class}</span>
                        {data.subclass && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 8px', borderRadius: 3 }}>{data.subclass}</span>}
                        {data.brand_names_pt?.slice(0, 3).map(b => (
                          <span key={b} style={{ fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic' }}>{b}</span>
                        ))}
                        {data.infarmed_url && (
                          <a href={data.infarmed_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', textDecoration: 'none', marginLeft: 'auto' }}>
                            INFARMED →
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', overflowX: 'auto', gap: 0 }}>
                      {[
                        { id: 'overview', label: 'Visão Geral' },
                        { id: 'dosing', label: 'Posologia' },
                        { id: 'safety', label: 'Segurança' },
                        { id: 'pk', label: 'Farmacocinética' },
                        { id: 'counselling', label: 'Doente' },
                      ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id as any)} style={tabBtnStyle(t.id)}>{t.label}</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ padding: '20px' }}>

                    {/* OVERVIEW TAB */}
                    {tab === 'overview' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Mechanism */}
                        <div>
                          <div style={lbl}>Mecanismo de acção</div>
                          <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>{data.mechanism}</p>
                        </div>

                        {/* Indications */}
                        <div>
                          <div style={lbl}>Indicações clínicas</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {data.indications?.map(i => (
                              <span key={i} style={{ fontSize: 12, color: 'var(--ink-2)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 4, fontFamily: 'var(--font-sans)' }}>{i}</span>
                            ))}
                          </div>
                        </div>

                        {/* Clinical pearls */}
                        {data.clinical_pearls?.length > 0 && (
                          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderLeft: '3px solid #7c3aed', borderRadius: 6, padding: '14px 16px' }}>
                            <div style={{ ...lbl, color: '#7c3aed' }}>Pérolas clínicas</div>
                            {data.clinical_pearls.map((p, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < data.clinical_pearls.length - 1 ? 8 : 0 }}>
                                <span style={{ color: '#7c3aed', fontFamily: 'var(--font-mono)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>◆</span>
                                <span style={{ fontSize: 13, color: '#5b21b6', lineHeight: 1.6 }}>{p}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Key interactions */}
                        {data.key_interactions?.length > 0 && (
                          <div>
                            <div style={lbl}>Interações principais</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {data.key_interactions.map((inter, i) => {
                                const s = SEV_STYLE[inter.severity] || SEV_STYLE.LIGEIRA
                                return (
                                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 5 }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: s.color, flexShrink: 0, marginTop: 2, letterSpacing: '0.06em' }}>{inter.severity}</span>
                                    <div>
                                      <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{inter.drug}</span>
                                      <span style={{ fontSize: 12, color: 'var(--ink-3)', marginLeft: 6 }}>— {inter.effect}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Available forms */}
                        {data.available_forms_pt?.length > 0 && (
                          <div>
                            <div style={lbl}>Formas disponíveis em Portugal</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {data.available_forms_pt.map(f => (
                                <span key={f} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 3 }}>{f}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* DOSING TAB */}
                    {tab === 'dosing' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[
                          { label: 'Dose padrão adulto', value: data.dosing?.adult_standard, highlight: true },
                          { label: 'Dose máxima diária', value: data.dosing?.adult_max, highlight: false },
                          { label: 'Ajuste renal (IR)', value: data.dosing?.renal_note, highlight: false },
                          { label: 'Ajuste hepático (IH)', value: data.dosing?.hepatic_note, highlight: false },
                          { label: 'Idosos', value: data.dosing?.elderly_note, highlight: false },
                        ].filter(r => r.value).map(({ label, value, highlight }) => (
                          <div key={label} style={{ padding: '12px 14px', background: highlight ? 'var(--green-light)' : 'var(--bg-2)', border: `1px solid ${highlight ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 7 }}>
                            <div style={{ ...lbl, color: highlight ? 'var(--green)' : 'var(--ink-5)' }}>{label}</div>
                            <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: highlight ? 600 : 400, lineHeight: 1.5 }}>{value}</div>
                          </div>
                        ))}
                        {data.pregnancy && (
                          <div style={{ padding: '12px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 7 }}>
                            <div style={{ ...lbl, color: '#92400e' }}>Gravidez</div>
                            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{data.pregnancy}</div>
                          </div>
                        )}
                        {data.lactation && (
                          <div style={{ padding: '12px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 7 }}>
                            <div style={{ ...lbl, color: '#92400e' }}>Amamentação</div>
                            <div style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{data.lactation}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SAFETY TAB */}
                    {tab === 'safety' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {data.adverse_effects?.serious?.length > 0 && (
                          <div>
                            <div style={lbl}>Efeitos adversos graves</div>
                            {data.adverse_effects.serious.map((e, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < data.adverse_effects.serious.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                                <span style={{ color: '#dc2626', fontSize: 13, flexShrink: 0, marginTop: 2 }}>▲</span>
                                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{e}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {data.adverse_effects?.common?.length > 0 && (
                          <div>
                            <div style={lbl}>Efeitos adversos frequentes</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {data.adverse_effects.common.map(e => (
                                <span key={e} style={{ fontSize: 12, color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4 }}>{e}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {data.adverse_effects?.monitoring?.length > 0 && (
                          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 7, padding: '14px 16px' }}>
                            <div style={{ ...lbl, color: '#1d4ed8' }}>Monitorização necessária</div>
                            {data.adverse_effects.monitoring.map((m, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < data.adverse_effects.monitoring.length - 1 ? 6 : 0 }}>
                                <span style={{ color: '#1d4ed8', fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
                                <span style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.5 }}>{m}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {data.contraindications?.length > 0 && (
                          <div>
                            <div style={lbl}>Contraindicações</div>
                            {data.contraindications.map((c, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < data.contraindications.length - 1 ? '1px solid var(--bg-3)' : 'none' }}>
                                <span style={{ color: '#dc2626', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>CONTRA</span>
                                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>{c}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PK TAB */}
                    {tab === 'pk' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { label: 'Absorção', value: data.pharmacokinetics?.absorption },
                          { label: 'Semivida (t½)', value: data.pharmacokinetics?.half_life },
                          { label: 'Metabolismo', value: data.pharmacokinetics?.metabolism },
                          { label: 'Excreção', value: data.pharmacokinetics?.excretion },
                          { label: 'Última guideline', value: data.last_updated_guideline },
                        ].filter(r => r.value).map(({ label, value }) => (
                          <div key={label} style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                            <div style={{ width: 140, flexShrink: 0 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                            </div>
                            <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* COUNSELLING TAB */}
                    {tab === 'counselling' && (
                      <div>
                        <div style={{ marginBottom: 16 }}>
                          <div style={lbl}>O que dizer ao doente</div>
                          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '0 0 12px', lineHeight: 1.6 }}>
                            Linguagem simples, sem jargão técnico.
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {data.patient_counselling?.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: i % 2 === 0 ? 'var(--green-light)' : 'var(--bg-2)', border: `1px solid ${i % 2 === 0 ? 'var(--green-mid)' : 'var(--border)'}`, borderRadius: 7 }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--green)', flexShrink: 0, minWidth: 18 }}>{i + 1}</span>
                              <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--bg)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)' }}>
                Gerado por AI — confirma sempre com o RCM/SmPC do medicamento
              </span>
              {data?.name && (
                <a href={`/ficha?drug=${encodeURIComponent(data.name)}`} target="_blank"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', textDecoration: 'none', fontWeight: 700 }}>
                  Ficha completa →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}