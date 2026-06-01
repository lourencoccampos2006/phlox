'use client'

// /estudar-conceito — Agrega "Explica-me" e "Mnemónicas" numa só ferramenta.
// O utilizador reportou que ter as duas em páginas separadas era inútil.
// Agora: começa por explicar a fundo (3 níveis), gera mnemónica relacionada
// SE for útil, e propõe estudo guiado a partir do conceito.
//
// 2026-06-01.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'
import SaveButton from '@/components/SaveButton'
import { consumeReopen } from '@/lib/saves'
import Link from 'next/link'

interface Explanation {
  concept: string
  simple: string
  exam: string
  clinical: string
  analogy: string
  key_points: string[]
  common_mistake: string
}

interface Mnemonic {
  mnemonic: string
  breakdown: { letter: string; stands_for: string }[]
  tip?: string
  alt?: string
}

type Tab = 'explica' | 'mnemonica' | 'estudo'

export default function EstudarConceitoPage() {
  const { user } = useAuth() as any
  const area = areaOf(user?.student_area)
  const [concept, setConcept] = useState('')
  const [tab, setTab] = useState<Tab>('explica')
  const [level, setLevel] = useState<'simple' | 'exam' | 'clinical'>('exam')

  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [mnemonic, setMnemonic] = useState<Mnemonic | null>(null)
  const [studyPlan, setStudyPlan] = useState<{ steps: string[]; questions: string[]; further_reading: string[] } | null>(null)

  const [loadingE, setLoadingE] = useState(false)
  const [loadingM, setLoadingM] = useState(false)
  const [loadingS, setLoadingS] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const d = consumeReopen<any>()
    if (d) {
      if (d.concept) { setConcept(d.concept); setExplanation(d) }
      else if (d.mnemonic) { setConcept(d.topic || ''); setMnemonic(d); setTab('mnemonica') }
    }
  }, [])

  async function runExplica(c?: string) {
    const cp = (c ?? concept).trim()
    if (!cp) return
    setConcept(cp); setLoadingE(true); setError('')
    try {
      const res = await fetch('/api/explica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept: cp, area: area.label }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      setExplanation(d); setTab('explica')
    } catch (e: any) { setError(e.message) }
    finally { setLoadingE(false) }
  }

  async function runMnemonica() {
    const cp = concept.trim()
    if (!cp) return
    setLoadingM(true); setError('')
    try {
      const res = await fetch('/api/mnemonicas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: cp, area: area.label }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      setMnemonic(d); setTab('mnemonica')
    } catch (e: any) { setError(e.message) }
    finally { setLoadingM(false) }
  }

  async function runStudy() {
    const cp = concept.trim()
    if (!cp) return
    setLoadingS(true); setError('')
    try {
      const res = await fetch('/api/estudar-conceito', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: cp, area: area.label,
          context: explanation ? `Já viu: ${explanation.simple}` : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      setStudyPlan(d); setTab('estudo')
    } catch (e: any) { setError(e.message) }
    finally { setLoadingS(false) }
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Estudante · {area.label}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3vw, 32px)', color: '#0b1120', fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>Estudar um conceito</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>
            Explica a fundo, mnemónica (quando faz sentido), e plano de estudo guiado. Tudo a partir do mesmo conceito.
          </p>
        </div>

        <div style={{ ...card, marginBottom: 14 }}>
          <input
            value={concept} onChange={e => setConcept(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runExplica()}
            placeholder="Ex: insuficiência cardíaca · betabloqueadores · ciclo de Krebs…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 14.5, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button onClick={() => runExplica()} disabled={!concept.trim() || loadingE}
              style={{ flex: '1 1 180px', padding: '11px 16px', background: concept.trim() && !loadingE ? '#7c3aed' : 'var(--bg-3)', color: concept.trim() && !loadingE ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800, cursor: concept.trim() && !loadingE ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              {loadingE ? 'A explicar…' : '✨ Explicar a fundo'}
            </button>
            <button onClick={runMnemonica} disabled={!concept.trim() || loadingM}
              style={{ flex: '1 1 140px', padding: '11px 16px', background: 'white', color: '#7c3aed', border: '1.5px solid #ddd6fe', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: concept.trim() && !loadingM ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              {loadingM ? '…' : '🧠 Mnemónica'}
            </button>
            <button onClick={runStudy} disabled={!concept.trim() || loadingS}
              style={{ flex: '1 1 140px', padding: '11px 16px', background: 'white', color: '#0d6e42', border: '1.5px solid #bbf7d0', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: concept.trim() && !loadingS ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              {loadingS ? '…' : '📚 Plano de estudo'}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, padding: '9px 11px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12.5, color: '#991b1b' }}>{error}</div>}
        </div>

        {/* Tabs com resultados */}
        {(explanation || mnemonic || studyPlan) && (
          <>
            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 12, overflowX: 'auto' }}>
              {([
                ['explica',   '✨ Explicação',   !!explanation],
                ['mnemonica', '🧠 Mnemónica',    !!mnemonic],
                ['estudo',    '📚 Plano',        !!studyPlan],
              ] as [Tab, string, boolean][]).filter(([,, has]) => has).map(([id, l]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{ padding: '10px 14px', background: tab === id ? '#faf5ff' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#7c3aed' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#7c3aed' : 'var(--ink-3)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{l}</button>
              ))}
            </div>

            {tab === 'explica' && explanation && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...card }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {(['simple','exam','clinical'] as const).map(l => (
                      <button key={l} onClick={() => setLevel(l)}
                        style={{ padding: '5px 12px', borderRadius: 999, border: `1.5px solid ${level === l ? '#7c3aed' : 'var(--border)'}`, background: level === l ? '#faf5ff' : 'white', color: level === l ? '#7c3aed' : 'var(--ink-3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                        {l === 'simple' ? 'Simples' : l === 'exam' ? 'Exame' : 'Clínico'}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 14.5, color: 'var(--ink)', lineHeight: 1.7 }}>{explanation[level]}</div>
                </div>
                {explanation.analogy && (
                  <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>🌉 Analogia</div>
                    <div style={{ fontSize: 13.5, color: '#0b1120', lineHeight: 1.6 }}>{explanation.analogy}</div>
                  </div>
                )}
                {explanation.key_points?.length > 0 && (
                  <div style={{ ...card }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Pontos-chave</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                      {explanation.key_points.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {explanation.common_mistake && (
                  <div style={{ ...card, background: '#fffbeb', borderColor: '#fde68a' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#b45309', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>⚠ Erro comum</div>
                    <div style={{ fontSize: 13.5, color: '#78350f', lineHeight: 1.6 }}>{explanation.common_mistake}</div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <SaveButton kind="explanation" title={explanation.concept || concept}
                    preview={explanation.simple?.slice(0, 200)} href="/estudar-conceito"
                    data={explanation} color="#7c3aed" />
                </div>
              </div>
            )}

            {tab === 'mnemonica' && mnemonic && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...card, background: '#faf5ff', borderColor: '#e9d5ff' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#6b21a8', textAlign: 'center', letterSpacing: '0.04em', marginBottom: 10 }}>
                    {mnemonic.mnemonic}
                  </div>
                  {mnemonic.breakdown?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {mnemonic.breakdown.map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 10px', background: 'white', borderRadius: 7 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#7c3aed', minWidth: 22 }}>{b.letter}</span>
                          <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{b.stands_for}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {mnemonic.tip && (
                  <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#15803d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>💡 Dica</div>
                    <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>{mnemonic.tip}</div>
                  </div>
                )}
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                  💭 <strong>Importante:</strong> mnemónicas ajudam a memorizar listas. Mas para perceberes <em>mesmo</em> {concept}, usa o tab "Explicação" e o "Plano de estudo".
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <SaveButton kind="mnemonic" title={`${concept}: ${mnemonic.mnemonic}`}
                    preview={mnemonic.breakdown?.map(b => `${b.letter}—${b.stands_for}`).join(', ')}
                    href="/estudar-conceito" data={{ topic: concept, ...mnemonic }} color="#7c3aed" />
                </div>
              </div>
            )}

            {tab === 'estudo' && studyPlan && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {studyPlan.steps?.length > 0 && (
                  <div style={{ ...card }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📚 Como estudar isto</div>
                    <ol style={{ margin: 0, paddingLeft: 22, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7 }}>
                      {studyPlan.steps.map((s, i) => <li key={i} style={{ marginBottom: 4 }}>{s}</li>)}
                    </ol>
                  </div>
                )}
                {studyPlan.questions?.length > 0 && (
                  <div style={{ ...card, background: '#eff6ff', borderColor: '#bfdbfe' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>❓ Para te testares</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7 }}>
                      {studyPlan.questions.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
                    </ul>
                  </div>
                )}
                {studyPlan.further_reading?.length > 0 && (
                  <div style={{ ...card }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📖 Para aprofundar</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
                      {studyPlan.further_reading.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
                    </ul>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link href="/study360" style={{ flex: 1, textAlign: 'center', padding: 11, background: '#0d6e42', color: 'white', textDecoration: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800 }}>Levar para Estudo 360° →</Link>
                  <Link href="/biblioteca" style={{ flex: 1, textAlign: 'center', padding: 11, background: 'white', color: '#0d6e42', textDecoration: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, border: '1.5px solid #bbf7d0' }}>Procurar nos meus PDFs</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
