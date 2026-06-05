'use client'

// /avaliar/[token] — página PÚBLICA onde o supervisor avalia o estudante sem
// precisar de conta. Token gerado pelo estudante na app.

import { useEffect, useState, use } from 'react'

const ACCENT = '#0d6e42'
const KIND_LABEL: Record<string, string> = {
  formative: 'Avaliação formativa', summative: 'Avaliação sumativa',
  mini_cex: 'Mini-CEX', dops: 'DOPS', cbd: 'Discussão de caso (CbD)',
}

const CRITERIA = [
  { key: 'knowledge', label: 'Conhecimento clínico' },
  { key: 'skills', label: 'Competências práticas' },
  { key: 'attitude', label: 'Atitude e profissionalismo' },
  { key: 'professionalism', label: 'Comunicação' },
  { key: 'overall', label: 'Avaliação global' },
]

export default function AvaliarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [info, setInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scores, setScores] = useState<Record<string, number>>({ knowledge: 4, skills: 4, attitude: 4, professionalism: 4, overall: 4 })
  const [name, setName] = useState('')
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [comments, setComments] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/internship/links?eval=${token}`)
        const j = await r.json()
        if (!r.ok) throw new Error(j.error || 'Link inválido')
        setInfo(j.evaluation)
        if (j.evaluation?.submitted) setDone(true)
        if (j.evaluation?.evaluator_name) setName(j.evaluation.evaluator_name)
      } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
    })()
  }, [token])

  async function submit() {
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/internship/links', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_eval', token, ...scores, strengths, improvements, comments, evaluator_name: name }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setDone(true)
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (loading) return <Shell><p style={{ color: '#6b7280' }}>A carregar…</p></Shell>
  if (err && !info) return <Shell><div style={{ background: '#fbf2f2', color: '#a82828', padding: 14, borderRadius: 10 }}>{err}</div></Shell>
  if (done) return <Shell><div style={{ textAlign: 'center', padding: 20 }}><div style={{ fontSize: 40 }}>✓</div><h2>Avaliação submetida</h2><p style={{ color: '#6b7280' }}>Obrigado. A avaliação foi registada no portefólio do estudante.</p></div></Shell>

  return (
    <Shell>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8b8f99' }}>{KIND_LABEL[info?.kind] || 'Avaliação'}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 24, fontFamily: 'var(--font-serif,serif)', fontWeight: 500 }}>Avaliar o estudante</h1>
        <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 4 }}>{info?.internship_name} · {info?.area} · {info?.student_period}</p>
      </div>

      <label style={lblStyle}>O teu nome</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do supervisor/avaliador" style={inp} />

      <div style={{ marginTop: 16 }}>
        {CRITERIA.map(c => (
          <div key={c.key} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{c.label}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setScores(s => ({ ...s, [c.key]: n }))} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 700,
                  border: `1px solid ${scores[c.key] === n ? ACCENT : '#e7e8ea'}`,
                  background: scores[c.key] === n ? ACCENT : 'white', color: scores[c.key] === n ? 'white' : '#374151',
                }}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <label style={lblStyle}>Pontos fortes</label>
      <textarea value={strengths} onChange={e => setStrengths(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      <label style={lblStyle}>A melhorar</label>
      <textarea value={improvements} onChange={e => setImprovements(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />
      <label style={lblStyle}>Comentários gerais</label>
      <textarea value={comments} onChange={e => setComments(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />

      {err && <div style={{ background: '#fbf2f2', color: '#a82828', padding: 10, borderRadius: 8, fontSize: 13, marginTop: 10 }}>{err}</div>}
      <button onClick={submit} disabled={busy || !name.trim()} style={{ marginTop: 16, width: '100%', padding: 13, background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: busy || !name.trim() ? 0.6 : 1 }}>
        {busy ? 'A submeter…' : 'Submeter avaliação'}
      </button>
      <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>Phlox · avaliação de estágio</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f6f7f8', fontFamily: 'var(--font-sans,sans-serif)', padding: '32px 16px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', background: 'white', border: '1px solid #e7e8ea', borderRadius: 14, padding: 24 }}>{children}</div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }
const lblStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', margin: '12px 0 5px', textTransform: 'uppercase', letterSpacing: 0.4 }
