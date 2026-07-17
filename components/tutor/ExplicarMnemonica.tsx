'use client'

// Explicar + Mnemónica + Plano de estudo — era /estudar-conceito (que já tinha
// absorvido /explica e /mnemonicas), agora fundido diretamente em /tutor.
// Traz de volta o histórico do /explica e a biblioteca guardada do /mnemonicas,
// que se tinham perdido na primeira fusão.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'
import SaveButton from '@/components/SaveButton'
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
  topic?: string
  mnemonic: string
  breakdown: { letter: string; stands_for: string }[]
  tip?: string
  alt?: string
}
interface HistoryItem { concept: string; at: string }
interface SavedMnemonic extends Mnemonic { id: string; savedAt: string }

type Tab = 'explica' | 'mnemonica' | 'estudo'
const HISTORY_KEY = 'phlox-explica-history'
const SAVED_KEY = 'phlox-mnemonicas-saved'

export default function ExplicarMnemonica() {
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

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [savedMnemonics, setSavedMnemonics] = useState<SavedMnemonic[]>([])
  const [showLibrary, setShowLibrary] = useState(false)

  useEffect(() => {
    try { const r = localStorage.getItem(HISTORY_KEY); if (r) setHistory(JSON.parse(r)) } catch {}
    try { const r = localStorage.getItem(SAVED_KEY); if (r) setSavedMnemonics(JSON.parse(r)) } catch {}
  }, [])

  function persistHistory(c: string) {
    const next: HistoryItem[] = [{ concept: c, at: new Date().toISOString() }, ...history.filter(h => h.concept !== c)].slice(0, 8)
    setHistory(next)
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)) } catch {}
  }
  function persistSavedMnemonics(next: SavedMnemonic[]) {
    setSavedMnemonics(next)
    try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)) } catch {}
  }
  const isMnemonicSaved = mnemonic ? savedMnemonics.some(s => s.mnemonic === mnemonic.mnemonic && s.topic === concept) : false
  function toggleSaveMnemonic() {
    if (!mnemonic) return
    if (isMnemonicSaved) persistSavedMnemonics(savedMnemonics.filter(s => !(s.mnemonic === mnemonic.mnemonic && s.topic === concept)))
    else persistSavedMnemonics([{ ...mnemonic, topic: concept, id: Date.now().toString(36), savedAt: new Date().toISOString() }, ...savedMnemonics].slice(0, 100))
  }
  function copyMnemonic() {
    if (!mnemonic) return
    const text = `${mnemonic.mnemonic}\n\n${mnemonic.breakdown?.map(b => `${b.letter} — ${b.stands_for}`).join('\n') || ''}${mnemonic.tip ? `\n\n💡 ${mnemonic.tip}` : ''}`
    navigator.clipboard.writeText(text)
  }

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
      setExplanation(d); setTab('explica'); persistHistory(cp)
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
        body: JSON.stringify({ concept: cp, area: area.label, context: explanation ? `Já viu: ${explanation.simple}` : undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro')
      setStudyPlan(d); setTab('estudo')
    } catch (e: any) { setError(e.message) }
    finally { setLoadingS(false) }
  }

  function openSavedMnemonic(s: SavedMnemonic) {
    setMnemonic(s); setConcept(s.topic || ''); setTab('mnemonica'); setShowLibrary(false)
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 18px' }

  return (
    <div>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: '#475569' }}>Explica a fundo, mnemónica, e plano de estudo guiado — a partir do mesmo conceito.</div>
          {savedMnemonics.length > 0 && (
            <button onClick={() => setShowLibrary(s => !s)} style={{ padding: '6px 12px', background: 'white', border: '1.5px solid #e9d5ff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, color: '#7c3aed', cursor: 'pointer', flexShrink: 0 }}>
              {showLibrary ? 'Fechar' : `🧠 Biblioteca · ${savedMnemonics.length}`}
            </button>
          )}
        </div>
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
        {history.length > 0 && !explanation && !mnemonic && !studyPlan && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7, fontFamily: 'var(--font-mono)' }}>Já explicaste</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {history.map(h => (
                <button key={h.concept} onClick={() => { setConcept(h.concept); runExplica(h.concept) }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#581c87', background: 'white', border: '1px solid #e9d5ff', borderRadius: 20, padding: '6px 12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600 }}>
                  ↻ {h.concept}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {showLibrary && (
        <div style={{ ...card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>As tuas mnemónicas guardadas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {savedMnemonics.map(s => (
              <div key={s.id} style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{s.topic}</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: '#581c87', lineHeight: 1.4 }}>{s.mnemonic}</div>
                </div>
                <button onClick={() => openSavedMnemonic(s)} style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: 'white', border: '1px solid #e9d5ff', borderRadius: 6, padding: '5px 9px', cursor: 'pointer' }}>Abrir</button>
                <button onClick={() => persistSavedMnemonics(savedMnemonics.filter(x => x.id !== s.id))} aria-label="Remover" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-5)' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {(explanation || mnemonic || studyPlan) && (
        <>
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 12, overflowX: 'auto' }}>
            {([
              ['explica', '✨ Explicação', !!explanation],
              ['mnemonica', '🧠 Mnemónica', !!mnemonic],
              ['estudo', '📚 Plano', !!studyPlan],
            ] as [Tab, string, boolean][]).filter(([, , has]) => has).map(([id, l]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ padding: '10px 14px', background: tab === id ? '#faf5ff' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#7c3aed' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#7c3aed' : 'var(--ink-3)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>{l}</button>
            ))}
          </div>

          {tab === 'explica' && explanation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={card}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                  {(['simple', 'exam', 'clinical'] as const).map(l => (
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
                <div style={card}>
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
                  preview={explanation.simple?.slice(0, 200)} href="/tutor"
                  data={explanation} color="#7c3aed" />
              </div>
            </div>
          )}

          {tab === 'mnemonica' && mnemonic && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...card, background: 'linear-gradient(135deg,#faf5ff,#f5f3ff)', borderColor: '#e9d5ff', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#6b21a8', letterSpacing: '0.04em' }}>{mnemonic.mnemonic}</div>
              </div>
              {mnemonic.breakdown?.length > 0 && (
                <div style={card}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {mnemonic.breakdown.map((b, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '7px 10px', background: 'var(--bg-2)', borderRadius: 7 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#7c3aed', minWidth: 22 }}>{b.letter}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>{b.stands_for}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mnemonic.tip && (
                <div style={{ ...card, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#15803d', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>💡 Dica</div>
                  <div style={{ fontSize: 13, color: '#166534', lineHeight: 1.55 }}>{mnemonic.tip}</div>
                </div>
              )}
              {mnemonic.alt && <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center' }}>Alternativa: <strong style={{ color: 'var(--ink-2)' }}>{mnemonic.alt}</strong></div>}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 10, padding: '11px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.55 }}>
                💭 <strong>Importante:</strong> mnemónicas ajudam a memorizar listas. Para perceberes <em>mesmo</em> {concept}, usa o separador "Explicação" e o "Plano de estudo".
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button onClick={toggleSaveMnemonic} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid #e9d5ff', background: isMnemonicSaved ? '#faf5ff' : 'white', color: '#7c3aed', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                  {isMnemonicSaved ? '★ Guardada' : '☆ Guardar'}
                </button>
                <button onClick={copyMnemonic} style={{ padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'white', color: 'var(--ink-3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Copiar</button>
                <SaveButton kind="mnemonic" title={`${concept}: ${mnemonic.mnemonic}`}
                  preview={mnemonic.breakdown?.map(b => `${b.letter}—${b.stands_for}`).join(', ')}
                  href="/tutor" data={{ topic: concept, ...mnemonic }} color="#7c3aed" />
              </div>
            </div>
          )}

          {tab === 'estudo' && studyPlan && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {studyPlan.steps?.length > 0 && (
                <div style={card}>
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
                <div style={card}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>📖 Para aprofundar</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65 }}>
                    {studyPlan.further_reading.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <Link href="/study/notas" style={{ flex: 1, textAlign: 'center', padding: 11, background: '#0d6e42', color: 'white', textDecoration: 'none', borderRadius: 9, fontSize: 13, fontWeight: 800 }}>Levar para revisão espaçada →</Link>
                <Link href="/biblioteca" style={{ flex: 1, textAlign: 'center', padding: 11, background: 'white', color: '#0d6e42', textDecoration: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, border: '1.5px solid #bbf7d0' }}>Procurar nos meus PDFs</Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
