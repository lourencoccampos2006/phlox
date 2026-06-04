'use client'

// /study/ecg — Biblioteca de ECGs + treino de interpretação com IA.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d6e42'

interface ECG {
  id: string; title: string; description: string|null; image_url: string|null
  rhythm: string; rate_bpm: number; axis: string; pr_ms: number; qrs_ms: number; qtc_ms: number
  findings: string[]; diagnosis: string; context: string; difficulty: string; category: string
}

const CATEGORIES = [
  { v: '', label: 'Todas' },
  { v: 'sca', label: 'Síndromes coronários' },
  { v: 'arritmias', label: 'Arritmias' },
  { v: 'condução', label: 'Distúrbios da condução' },
  { v: 'eletrólitos', label: 'Eletrólitos' },
  { v: 'normal', label: 'Normais / variantes' },
  { v: 'outros', label: 'Outros' },
]

export default function ECGPage() {
  const { supabase } = useAuth() as any
  const [ecgs, setEcgs] = useState<ECG[]>([])
  const [selected, setSelected] = useState<ECG | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [category, setCategory] = useState('')
  const [interp, setInterp] = useState('')
  const [feedback, setFeedback] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: sd } = await supabase.auth.getSession()
    const url = new URL('/api/study/ecg', window.location.origin)
    if (category) url.searchParams.set('category', category)
    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
    const j = await r.json()
    setEcgs(j.ecgs || [])
    setLoading(false)
  }, [supabase, category])

  useEffect(() => { load() }, [load])

  async function evaluate() {
    if (!selected || !interp.trim()) return
    setBusy(true); setFeedback(null)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch('/api/study/ecg-interpret', { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}`,
      }, body: JSON.stringify({ ecg_id: selected.id, interpretation: interp }) })
      const j = await r.json()
      if (r.ok) setFeedback(j)
    } finally { setBusy(false) }
  }

  function pickEcg(e: ECG) {
    setSelected(e); setRevealed(false); setInterp(''); setFeedback(null)
  }

  if (loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>

  if (selected) {
    return (
      <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1000, margin: '0 auto' }}>
        <button onClick={() => setSelected(null)} style={{ ...btn('ghost'), marginBottom: 12 }}>← Voltar à lista</button>

        <h1 style={{ margin: 0, fontSize: 22 }}>{selected.title}</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>{selected.context}</p>

        {selected.image_url ? (
          <img src={selected.image_url} alt="ECG" style={{ width: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }} />
        ) : (
          <ECGRenderer ecg={selected} />
        )}

        {!revealed && (
          <>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados do ECG</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, fontSize: 13 }}>
                <div><b>Ritmo:</b> {selected.rhythm}</div>
                <div><b>Frequência:</b> {selected.rate_bpm} bpm</div>
                <div><b>Eixo:</b> {selected.axis}</div>
                <div><b>PR:</b> {selected.pr_ms || '—'} ms</div>
                <div><b>QRS:</b> {selected.qrs_ms} ms</div>
                <div><b>QTc:</b> {selected.qtc_ms} ms</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', marginBottom: 6, display: 'block' }}>A tua interpretação</label>
              <textarea value={interp} onChange={e => setInterp(e.target.value)} rows={5}
                placeholder="Descreve achados, diagnóstico provável e o que farias de seguida."
                style={{ width: '100%', padding: 12, border: '1px solid #d1d5db', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={evaluate} disabled={busy || !interp.trim()} style={btn('primary')}>{busy ? 'A avaliar…' : 'Submeter para avaliação IA'}</button>
              <button onClick={() => setRevealed(true)} style={btn('ghost')}>Revelar diagnóstico</button>
            </div>

            {feedback && (
              <div style={{ marginTop: 16, background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Avaliação</span>
                  <span style={{ padding: '4px 12px', borderRadius: 999, background: feedback.score >= 70 ? '#dcfce7' : feedback.score >= 40 ? '#fef3c7' : '#fee2e2', color: feedback.score >= 70 ? '#065f46' : feedback.score >= 40 ? '#92400e' : '#991b1b', fontWeight: 700, fontSize: 13 }}>
                    {feedback.score}/100
                  </span>
                </div>
                <p style={{ fontSize: 14, color: '#374151', margin: '0 0 10px', lineHeight: 1.5 }}>{feedback.feedback}</p>
                {feedback.correct?.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#065f46', fontWeight: 700, marginBottom: 4 }}>✓ ACERTASTE</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                      {feedback.correct.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {feedback.missed?.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, marginBottom: 4 }}>✗ FALHASTE</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                      {feedback.missed.map((c: string, i: number) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {revealed && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16 }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, color: ACCENT }}>Diagnóstico: {selected.diagnosis}</h2>
            <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{selected.description}</p>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>ACHADOS</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                {selected.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          </div>
        )}
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ margin: 0, fontSize: 26 }}>Biblioteca de ECGs</h1>
      <p style={{ color: '#6b7280', margin: '4px 0 16px', fontSize: 14 }}>
        Treina interpretação de ECGs. A IA avalia a tua resposta livre.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATEGORIES.map(c => (
          <button key={c.v} onClick={() => setCategory(c.v)} style={{
            padding: '5px 12px', border: 'none', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            background: category === c.v ? ACCENT : '#f3f4f6',
            color: category === c.v ? 'white' : '#374151',
          }}>{c.label}</button>
        ))}
      </div>

      {ecgs.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>Nenhum ECG disponível ainda. Aplica o sprint70 SQL.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {ecgs.map(e => (
            <button key={e.id} onClick={() => pickEcg(e)} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{e.title}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, background: e.difficulty === 'easy' ? '#dcfce7' : e.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: e.difficulty === 'easy' ? '#065f46' : e.difficulty === 'medium' ? '#92400e' : '#991b1b', fontSize: 10, fontWeight: 700 }}>
                  {e.difficulty}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{e.context}</p>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

// ─── ECGRenderer ─────────────────────────────────────────────────────────
// Gera SVG de tira de ECG sintética a partir dos parâmetros (ritmo, FC,
// PR, QRS, QTc, achados). Não é uma reprodução exacta de um ECG real mas
// permite visualizar o padrão característico para treino de interpretação.
function ECGRenderer({ ecg }: { ecg: ECG }) {
  // Geometria: papel ECG padrão — 25 mm/s, 10 mm/mV
  // 1 quadrado pequeno = 1 mm = 0.04 s horizontal, 0.1 mV vertical
  const PX_PER_MM = 4
  const SECONDS = 10                                // 10 segundos típicos
  const WIDTH_MM = SECONDS * 25                     // 250 mm
  const HEIGHT_MM = 40
  const W = WIDTH_MM * PX_PER_MM
  const H = HEIGHT_MM * PX_PER_MM
  const baseline = H / 2

  function mm(v: number) { return v * PX_PER_MM }

  // Gera os QRS com base na frequência e ritmo
  function generatePath(): string {
    let path = `M 0 ${baseline}`
    const rate = ecg.rate_bpm || 75
    const rr_s = rate > 0 ? 60 / rate : 0
    const pr_s = (ecg.pr_ms || 160) / 1000
    const qrs_s = (ecg.qrs_ms || 90) / 1000
    const qt_s = ((ecg.qtc_ms || 410) / 1000) * Math.sqrt(rr_s || 1)

    if (ecg.rhythm === 'vf') {
      // FV: ondulação caótica de alta frequência
      for (let i = 0; i <= W; i += 4) {
        const y = baseline + (Math.sin(i / 5) * 25 + (Math.random() - 0.5) * 30)
        path += ` L ${i} ${y}`
      }
      return path
    }

    if (ecg.rhythm === 'vt') {
      // TV monomórfica: QRS largos consecutivos
      const period_px = (rr_s || 0.4) * 25 * PX_PER_MM
      let t = 0
      while (t < W) {
        path += ` L ${t + mm(5)} ${baseline}`
        path += ` L ${t + mm(8)} ${baseline - mm(15)}`
        path += ` L ${t + mm(12)} ${baseline + mm(8)}`
        path += ` L ${t + mm(16)} ${baseline}`
        path += ` L ${t + period_px} ${baseline}`
        t += period_px
      }
      return path
    }

    // Ritmo normal/sinusal/afib/aflutter — gera batimentos
    let t = 0
    let beatNum = 0
    while (t < SECONDS) {
      let rr = rr_s
      // FA: RR irregular
      if (ecg.rhythm === 'afib') rr = rr_s * (0.7 + Math.random() * 0.6)
      const startPx = t * 25 * PX_PER_MM
      if (startPx >= W) break

      // Onda P (excepto na FA/flutter típico)
      if (ecg.rhythm !== 'afib' && ecg.rhythm !== 'aflutter') {
        path += ` L ${startPx + mm(2)} ${baseline}`
        path += ` Q ${startPx + mm(4)} ${baseline - mm(2.5)} ${startPx + mm(6)} ${baseline}`
      } else if (ecg.rhythm === 'aflutter') {
        // ondas F em "dente de serra"
        for (let i = 0; i < pr_s * 25 * PX_PER_MM; i += mm(2)) {
          path += ` L ${startPx + i} ${baseline - (i % mm(4) === 0 ? mm(2) : 0)}`
        }
      }

      // PR segmento (isoeléctrico)
      path += ` L ${startPx + pr_s * 25 * PX_PER_MM} ${baseline}`

      // Complexo QRS — vários padrões conforme achados
      const qrsStart = startPx + pr_s * 25 * PX_PER_MM
      const qrsWidth = qrs_s * 25 * PX_PER_MM
      const hasWideQRS = (ecg.qrs_ms || 90) >= 120
      const findings = (ecg.findings || []).join(' ').toLowerCase()
      const hasSupraST = /supra.{0,5}st|stemi/.test(findings)
      const hasDepressaoST = /depress.{0,5}st|nstemi/.test(findings)
      const hasTApiculadas = /t apicul|apicul/.test(findings)
      const hasQpatologica = /onda q|q patol/.test(findings)

      // Q (se patológica)
      if (hasQpatologica) {
        path += ` L ${qrsStart + mm(1)} ${baseline + mm(3)}`
      }
      // R
      path += ` L ${qrsStart + qrsWidth * 0.3} ${baseline - mm(12)}`
      // S
      path += ` L ${qrsStart + qrsWidth * 0.6} ${baseline + mm(4)}`
      if (hasWideQRS) {
        // Padrão BCRE/BCRD adicional
        path += ` L ${qrsStart + qrsWidth * 0.8} ${baseline - mm(3)}`
      }
      path += ` L ${qrsStart + qrsWidth} ${baseline}`

      // Segmento ST
      const stStart = qrsStart + qrsWidth
      let stLevel = baseline
      if (hasSupraST) stLevel = baseline - mm(3)
      else if (hasDepressaoST) stLevel = baseline + mm(2)
      path += ` L ${stStart + mm(2)} ${stLevel}`

      // Onda T
      const tStart = stStart + mm(2)
      const tWidth = mm(6)
      const tHeight = hasTApiculadas ? mm(8) : mm(3)
      const tDir = /t invert|onda t invert/.test(findings) ? 1 : -1  // invertida = positiva no SVG (y aumenta para baixo)
      path += ` Q ${tStart + tWidth / 2} ${baseline + tDir * tHeight} ${tStart + tWidth} ${baseline}`

      // Fim do batimento — linha até próximo
      path += ` L ${startPx + rr * 25 * PX_PER_MM} ${baseline}`
      t += rr
      beatNum++
    }
    return path
  }

  const path = generatePath()

  return (
    <div style={{ background: '#fef3c7', padding: 12, borderRadius: 12, marginBottom: 16, overflow: 'auto' }}>
      <div style={{ fontSize: 11, color: '#92400e', marginBottom: 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Tira sintética — gerada a partir dos parâmetros · 25 mm/s, 10 mm/mV
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 600, height: 'auto', display: 'block', background: '#fff8e1' }}>
        {/* Papel ECG: grelha grande (5 mm) e pequena (1 mm) */}
        <defs>
          <pattern id="ecg-small" width={PX_PER_MM} height={PX_PER_MM} patternUnits="userSpaceOnUse">
            <rect width={PX_PER_MM} height={PX_PER_MM} fill="none" stroke="#fde68a" strokeWidth={0.3} />
          </pattern>
          <pattern id="ecg-large" width={5 * PX_PER_MM} height={5 * PX_PER_MM} patternUnits="userSpaceOnUse">
            <rect width={5 * PX_PER_MM} height={5 * PX_PER_MM} fill="url(#ecg-small)" stroke="#f59e0b" strokeWidth={0.7} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#ecg-large)" />
        {/* Calibração — pulse de 1mV no início */}
        <path d={`M ${mm(2)} ${baseline} L ${mm(2)} ${baseline - mm(10)} L ${mm(6)} ${baseline - mm(10)} L ${mm(6)} ${baseline}`}
          stroke="#7c2d12" strokeWidth={1.5} fill="none" />
        {/* Traçado */}
        <path d={path} stroke="#000" strokeWidth={1.5} fill="none" />
      </svg>
      <div style={{ fontSize: 10, color: '#78350f', marginTop: 4 }}>
        Nota: tira ilustrativa. Para casos reais consulta as imagens originais na descrição da literatura citada.
      </div>
    </div>
  )
}

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
