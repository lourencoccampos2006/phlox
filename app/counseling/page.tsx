'use client'

import { useState } from 'react'

interface CounselingResult {
  drug_name: string
  drug_class: string
  indication: string
  how_to_take: { dose: string; timing: string; duration: string; missed_dose: string }
  important_notes: string[]
  food_interactions: string[]
  side_effects: { common: string[]; call_doctor: string[] }
  storage: string
  special_populations: { elderly: string | null; renal: string | null; pregnancy: string }
  monitoring: string[]
  interactions_alert: string[]
  patient_tips: string[]
}

const COMMON_DRUGS = [
  'Metformina', 'Metoprolol', 'Lisinopril', 'Atorvastatina', 'Omeprazol',
  'Varfarina', 'Rivaroxabano', 'Levotiroxina', 'Amlodipina', 'Bisoprolol',
  'Ramipril', 'Furosemida', 'Espironolactona', 'Amoxicilina', 'Azitromicina',
  'Ibuprofeno', 'Paracetamol', 'Methotrexato', 'Prednisolona', 'Alendronato',
]

export default function CounselingPage() {
  const [drug, setDrug] = useState('')
  const [indication, setIndication] = useState('')
  const [age, setAge] = useState('')
  const [conditions, setConditions] = useState('')
  const [otherMeds, setOtherMeds] = useState('')
  const [result, setResult] = useState<CounselingResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    if (!drug.trim()) { setError('Introduz o nome do medicamento.'); return }
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drug, indication: indication || undefined, age: age || undefined, conditions: conditions || undefined, otherMeds: otherMeds || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
    } catch (e: any) { setError(e.message || 'Erro ao gerar.') }
    setLoading(false)
  }

  const Section = ({ title, color = '#f8fafc', borderColor = 'var(--border)', children }: { title: string; color?: string; borderColor?: string; children: React.ReactNode }) => (
    <div style={{ background: color, border: `1px solid ${borderColor}`, borderRadius: 10, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  )

  const List = ({ items, icon = '•', iconColor = 'var(--ink-4)' }: { items: string[]; icon?: string; iconColor?: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--ink-2)', alignItems: 'flex-start', lineHeight: 1.5 }}>
          <span style={{ color: iconColor, flexShrink: 0, fontWeight: 700 }}>{icon}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 24, paddingBottom: 20 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Farmácia Clínica · Aconselhamento</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'white', marginBottom: 6 }}>Folha de Aconselhamento ao Doente</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', maxWidth: 520 }}>
            Gera fichas de informação personalizadas em linguagem simples — para entregar ao doente, impressas ou por email.
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 920 }}>
        <div style={{ display: 'grid', gridTemplateColumns: result ? '320px 1fr' : '520px', gap: 16, margin: '0 auto' }}>

          {/* Input */}
          <div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14 }}>Gerar ficha de aconselhamento</div>

              <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Medicamento *</label>
              <input value={drug} onChange={e => setDrug(e.target.value)} placeholder="ex: Metformina 500mg, Varfarina, Omeprazol..."
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />

              {/* Quick drugs */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Fármacos frequentes</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {COMMON_DRUGS.map(d => (
                    <button key={d} onClick={() => setDrug(d)}
                      style={{ padding: '3px 9px', background: drug === d ? '#0f172a' : 'var(--bg-2)', color: drug === d ? 'white' : 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Indicação neste doente</label>
                  <input value={indication} onChange={e => setIndication(e.target.value)} placeholder="ex: Diabetes tipo 2, pressão alta, colesterol..."
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Idade</label>
                    <input value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 72"
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Condições</label>
                    <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="DM, HTA, IRC..."
                      style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Outros medicamentos</label>
                  <input value={otherMeds} onChange={e => setOtherMeds(e.target.value)} placeholder="ex: Metoprolol, Furosemida, Varfarina..."
                    style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, boxSizing: 'border-box' }} />
                </div>
              </div>

              {error && <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#991b1b', marginTop: 10 }}>{error}</div>}

              <button onClick={generate} disabled={loading}
                style={{ width: '100%', padding: '12px', background: loading ? '#9ca3af' : '#0f172a', color: 'white', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', marginTop: 14 }}>
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      A gerar ficha...
                    </span>
                  : 'Gerar folha de aconselhamento'}
              </button>
            </div>
          </div>

          {/* Result — printable sheet */}
          {result && (
            <div>
              {/* Print controls */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={() => window.print()}
                  style={{ padding: '8px 16px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  Imprimir / PDF
                </button>
                <button onClick={() => {
                  const text = [
                    result.drug_name,
                    result.drug_class,
                    '',
                    'PARA QUE SERVE',
                    result.indication,
                    '',
                    'COMO TOMAR',
                    result.how_to_take.dose,
                    result.how_to_take.timing,
                    result.how_to_take.duration,
                    `Se se esquecer: ${result.how_to_take.missed_dose}`,
                    '',
                    'EFEITOS SECUNDÁRIOS COMUNS',
                    ...result.side_effects.common,
                    '',
                    'QUANDO LIGAR AO MÉDICO',
                    ...result.side_effects.call_doctor,
                    '',
                    'GUARDAR',
                    result.storage,
                  ].join('\n')
                  navigator.clipboard.writeText(text)
                }}
                  style={{ padding: '8px 16px', background: 'var(--bg-2)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
                  Copiar texto
                </button>
              </div>

              {/* Sheet */}
              <div id="counseling-sheet" style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 28 }}>

                {/* Drug header */}
                <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 22, fontFamily: 'var(--font-serif)', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{result.drug_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>{result.drug_class}</div>
                  <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, fontSize: 13, color: '#065f46', lineHeight: 1.5 }}>
                    <strong>Para que serve:</strong> {result.indication}
                  </div>
                </div>

                {/* How to take */}
                <Section title="Como tomar" color="#f0f9ff" borderColor="#bae6fd">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    {[
                      { label: 'Dose', val: result.how_to_take.dose },
                      { label: 'Quando', val: result.how_to_take.timing },
                      { label: 'Duração', val: result.how_to_take.duration },
                    ].map(f => (
                      <div key={f.label} style={{ padding: '8px 10px', background: 'white', borderRadius: 6, border: '1px solid #bae6fd' }}>
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{f.label}</div>
                        <div style={{ fontSize: 12, color: '#0c4a6e', fontWeight: 600 }}>{f.val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '8px 10px', background: '#fef9c3', borderRadius: 6, border: '1px solid #fde68a', fontSize: 12, color: '#854d0e' }}>
                    <strong>Se se esquecer:</strong> {result.how_to_take.missed_dose}
                  </div>
                </Section>

                {/* Important notes */}
                {result.important_notes.length > 0 && (
                  <Section title="Pontos importantes" color="#fff7ed" borderColor="#fdba74">
                    <List items={result.important_notes} icon="⚠" iconColor="#c2410c" />
                  </Section>
                )}

                {/* Side effects */}
                <Section title="Efeitos secundários">
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 6 }}>Efeitos comuns (geralmente passam sozinhos)</div>
                    <List items={result.side_effects.common} icon="•" />
                  </div>
                  <div style={{ padding: '10px 12px', background: '#fee2e2', borderRadius: 8, border: '1px solid #fca5a5' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>Ligar ao médico se:</div>
                    <List items={result.side_effects.call_doctor} icon="!" iconColor="#dc2626" />
                  </div>
                </Section>

                {/* Food + Interactions */}
                {(result.food_interactions.length > 0 || result.interactions_alert.length > 0) && (
                  <Section title="O que evitar" color="#faf5ff" borderColor="#c4b5fd">
                    {result.food_interactions.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 5 }}>Alimentos / bebidas</div>
                        <List items={result.food_interactions} icon="✗" iconColor="#7c3aed" />
                      </div>
                    )}
                    {result.interactions_alert.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginBottom: 5 }}>Medicamentos / suplementos</div>
                        <List items={result.interactions_alert} icon="✗" iconColor="#7c3aed" />
                      </div>
                    )}
                  </Section>
                )}

                {/* Monitoring */}
                {result.monitoring.length > 0 && (
                  <Section title="O que vigiar">
                    <List items={result.monitoring} icon="→" iconColor="#0369a1" />
                  </Section>
                )}

                {/* Special populations */}
                {(result.special_populations.elderly || result.special_populations.renal || result.special_populations.pregnancy) && (
                  <Section title="Grupos especiais">
                    {result.special_populations.elderly && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>Idosos: </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{result.special_populations.elderly}</span>
                      </div>
                    )}
                    {result.special_populations.renal && (
                      <div style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>Rim: </span>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{result.special_populations.renal}</span>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>Gravidez/amamentação: </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{result.special_populations.pregnancy}</span>
                    </div>
                  </Section>
                )}

                {/* Storage + Tips */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Section title="Como guardar">
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>{result.storage}</div>
                  </Section>
                  {result.patient_tips.length > 0 && (
                    <Section title="Dicas práticas" color="#f0fdf4" borderColor="#86efac">
                      <List items={result.patient_tips} icon="💡" iconColor="#059669" />
                    </Section>
                  )}
                </div>

                {/* Footer */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>Phlox — Aconselhamento Farmacêutico · {new Date().toLocaleDateString('pt-PT')}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>Em caso de dúvida, fala com o teu farmacêutico</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @media print { .page-container > div:first-child { display: none } #counseling-sheet { border: none; padding: 0 } }`}</style>
    </div>
  )
}
