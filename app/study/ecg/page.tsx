'use client'

// /study/ecg — Biblioteca de ECGs + treino de interpretação com IA.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { usePhloxContext } from '@/lib/copilotContext'

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

// Nome curto de categoria para a etiqueta neutra (sem revelar o diagnóstico)
const CAT_SHORT: Record<string, string> = {
  sca: 'Síndrome coronário', arritmias: 'Arritmia', 'condução': 'Condução',
  'eletrólitos': 'Eletrólitos', normal: 'Normal / variante', outros: 'Outro',
}
const DIFF_LABEL: Record<string, string> = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' }

// Etiqueta NEUTRA do caso — não revela o diagnóstico (o título da BD É o
// diagnóstico, por isso nunca o mostramos antes do reveal).
function caseLabel(e: ECG, index?: number): string {
  const cat = CAT_SHORT[e.category] || 'Caso'
  const n = typeof index === 'number' ? `Caso ${String(index + 1).padStart(2, '0')} · ` : ''
  return `${n}${cat}`
}

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

  // Publica o ECG em análise para o Copilot (revela diagnóstico só depois do reveal)
  usePhloxContext(
    selected ? 'ECG em análise' : '',
    selected ? {
      caso: caseLabel(selected), apresentacao: selected.context,
      frequencia: selected.rate_bpm, eixo: selected.axis, PR: selected.pr_ms, QRS: selected.qrs_ms, QTc: selected.qtc_ms,
      ...(revealed ? { diagnostico: selected.diagnosis, ritmo: selected.rhythm, achados: selected.findings } : {}),
    } : null
  )

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

        {/* Antes do reveal: etiqueta NEUTRA + apresentação clínica. NUNCA o título/diagnóstico. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>{revealed ? selected.title : caseLabel(selected)}</h1>
          <span style={{ padding: '2px 10px', borderRadius: 999, background: selected.difficulty === 'easy' ? '#dcfce7' : selected.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: selected.difficulty === 'easy' ? '#065f46' : selected.difficulty === 'medium' ? '#92400e' : '#991b1b', fontSize: 11, fontWeight: 700 }}>
            {DIFF_LABEL[selected.difficulty] || selected.difficulty}
          </span>
        </div>

        {/* Apresentação clínica — dá contexto sem revelar o diagnóstico */}
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderLeft: `3px solid ${ACCENT}`, borderRadius: 8, padding: '10px 14px', margin: '10px 0 16px' }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>Apresentação clínica</div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{selected.context}</p>
        </div>

        {selected.image_url ? (
          <img src={selected.image_url} alt="ECG" style={{ width: '100%', borderRadius: 8, marginBottom: 16, border: '1px solid #e5e7eb' }} />
        ) : (
          <ECGRenderer ecg={selected} />
        )}

        {!revealed && (
          <>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Medições do traçado</div>
              {/* Mostramos as MEDIÇÕES (o que se lê do ECG), não o "ritmo" — esse é parte da resposta. */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, fontSize: 13 }}>
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
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>ACHADOS-CHAVE</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                {selected.findings.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 8, fontSize: 12, color: '#6b7280' }}>
              <div><b>Ritmo:</b> {selected.rhythm}</div>
              <div><b>FC:</b> {selected.rate_bpm} bpm</div>
              <div><b>QTc:</b> {selected.qtc_ms} ms</div>
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
          {ecgs.map((e, idx) => (
            <button key={e.id} onClick={() => pickEcg(e)} style={{
              textAlign: 'left', background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                {/* Etiqueta NEUTRA — não revela o diagnóstico */}
                <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{caseLabel(e, idx)}</span>
                <span style={{ padding: '2px 8px', borderRadius: 999, background: e.difficulty === 'easy' ? '#dcfce7' : e.difficulty === 'medium' ? '#fef3c7' : '#fee2e2', color: e.difficulty === 'easy' ? '#065f46' : e.difficulty === 'medium' ? '#92400e' : '#991b1b', fontSize: 10, fontWeight: 700 }}>
                  {DIFF_LABEL[e.difficulty] || e.difficulty}
                </span>
              </div>
              {/* Só a apresentação clínica — o "porquê estás a ver este ECG" */}
              <p style={{ margin: 0, fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{e.context}</p>
              <div style={{ marginTop: 10, fontSize: 11, color: ACCENT, fontWeight: 700 }}>Interpretar →</div>
            </button>
          ))}
        </div>
      )}
    </main>
  )
}

// ─── ECGRenderer ─────────────────────────────────────────────────────────
// Gera uma tira de ECG REALISTA e limpa a partir dos parâmetros (ritmo, FC, PR,
// QRS, QTc, achados). Amostragem ponto-a-ponto de curvas suaves (Gaussianas p/
// P e T, deflexões nítidas no QRS) sobre papel ECG clássico cor-de-rosa, à escala
// 25 mm/s · 10 mm/mV. Pensado para parecer um traçado de verdade, não um rabisco.
function ECGRenderer({ ecg }: { ecg: ECG }) {
  const PX_PER_MM = 4
  const SECONDS = 10
  const W = SECONDS * 25 * PX_PER_MM   // 25 mm/s
  const H = 44 * PX_PER_MM
  const baseline = H * 0.58            // ligeiramente abaixo do centro (mais espaço p/ R)
  const mm = (v: number) => v * PX_PER_MM
  const SAMPLE_DT = 0.002              // 2 ms por amostra → curva suave

  const rate = Math.max(20, ecg.rate_bpm || 75)
  const rrBase = 60 / rate
  const pr = (ecg.pr_ms || 160) / 1000
  const qrsDur = Math.max(0.06, (ecg.qrs_ms || 90) / 1000)
  const qtc = (ecg.qtc_ms || 410) / 1000
  const qt = qtc * Math.sqrt(rrBase)
  const wide = (ecg.qrs_ms || 90) >= 120
  const f = (ecg.findings || []).join(' ').toLowerCase()
  const stE = /supra.{0,5}st|stemi|eleva/.test(f)
  const stD = /depress.{0,5}st|nstemi|infra/.test(f)
  const tPeak = /t apicul|apicul|hiperc/.test(f)
  const tInv = /t invert|onda t invert/.test(f)
  const qPath = /onda q|q patol/.test(f)
  const rhythm = ecg.rhythm || 'sinus'

  // gaussiana centrada em c, largura w (s), amplitude a (mm)
  const gauss = (t: number, c: number, w: number, a: number) =>
    a * Math.exp(-((t - c) ** 2) / (2 * (w / 2.5) ** 2))

  // Amplitude (mV→mm; 10 mm/mV) num instante t (segundos) dentro de UM batimento de duração rr.
  function beatY(t: number, rr: number): number {
    let y = 0  // em mm, positivo = para cima
    // FV: caos — não há batimentos organizados
    if (rhythm === 'vf') return Math.sin(t * 47) * 6 + Math.sin(t * 113) * 4
    // P (ausente na FA; serrilhado no flutter)
    if (rhythm === 'afib') {
      y += (Math.sin(t * 60) + Math.sin(t * 97)) * 0.35   // ondulação fina da linha de base
    } else if (rhythm === 'aflutter') {
      y += Math.abs(((t * rate * 5) % 1) - 0.5) * -3 + 0.8 // dentes de serra
    } else {
      y += gauss(t, pr * 0.45, 0.05, 1.6)                 // onda P
    }
    // QRS centrado logo após o PR
    const q0 = pr
    if (rhythm === 'vt' || wide) {
      // QRS largo e bizarro (TV / bloqueio de ramo)
      y += gauss(t, q0 + qrsDur * 0.5, qrsDur * 0.9, rhythm === 'vt' ? 13 : 11) * (rhythm === 'vt' ? -1 : 1) * -1
      y += gauss(t, q0 + qrsDur * 1.05, qrsDur * 0.6, 5) * (wide ? 1 : -1)
    } else {
      if (qPath) y -= gauss(t, q0 + 0.012, 0.012, 3)      // Q patológica
      y -= gauss(t, q0 + qrsDur * 0.25, 0.012, 2.5)       // q fisiológica
      y += gauss(t, q0 + qrsDur * 0.5, 0.018, 14)         // R (pico alto e estreito)
      y -= gauss(t, q0 + qrsDur * 0.8, 0.016, 4.5)        // S
    }
    // Segmento ST (deslocamento)
    const stStart = q0 + qrsDur
    const tCenter = q0 + qt * 0.72
    if (t > stStart && t < tCenter) {
      const stShift = stE ? 3 : stD ? -2 : 0
      // transição suave do J-point até ao início da T
      const k = Math.min(1, (t - stStart) / 0.04)
      y += stShift * k
    }
    // Onda T
    const tAmp = (tPeak ? 8 : 3.5) * (tInv ? -1 : 1)
    y += gauss(t, tCenter, qt * 0.28, tAmp)
    return y
  }

  // Constrói o caminho amostrando vários batimentos com RR (irregular na FA).
  function buildPath(): string {
    let d = ''
    let tAbs = 0
    let first = true
    let rr = rrBase
    let beatT = 0
    while (tAbs < SECONDS) {
      // novo batimento?
      if (beatT >= rr) {
        beatT -= rr
        rr = rhythm === 'afib' ? rrBase * (0.55 + Math.random() * 0.8)
           : rhythm === 'vt'   ? Math.min(rrBase, 0.42)
           : rrBase
      }
      const yMm = beatY(beatT, rr)
      const x = tAbs * 25 * PX_PER_MM
      const y = baseline - mm(yMm)
      d += first ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      first = false
      tAbs += SAMPLE_DT
      beatT += SAMPLE_DT
    }
    return d
  }

  const path = buildPath()
  const measur = `${rate} bpm · PR ${ecg.pr_ms || '—'} ms · QRS ${ecg.qrs_ms || '—'} ms · QTc ${ecg.qtc_ms || '—'} ms`

  return (
    <div style={{ border: '1px solid #f3d2d6', borderRadius: 12, marginBottom: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fff', borderBottom: '1px solid #f3d2d6' }}>
        <span style={{ fontSize: 11, color: '#9f1239', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>Tira · derivação II · 25 mm/s · 10 mm/mV</span>
        <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'var(--font-mono, monospace)' }}>{measur}</span>
      </div>
      <div style={{ overflowX: 'auto', background: '#fff5f6' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }}>
          <defs>
            <pattern id="ecg-sm" width={PX_PER_MM} height={PX_PER_MM} patternUnits="userSpaceOnUse">
              <path d={`M ${PX_PER_MM} 0 L 0 0 0 ${PX_PER_MM}`} fill="none" stroke="#f7c6cd" strokeWidth={0.4} />
            </pattern>
            <pattern id="ecg-lg" width={5 * PX_PER_MM} height={5 * PX_PER_MM} patternUnits="userSpaceOnUse">
              <rect width={5 * PX_PER_MM} height={5 * PX_PER_MM} fill="url(#ecg-sm)" />
              <path d={`M ${5 * PX_PER_MM} 0 L 0 0 0 ${5 * PX_PER_MM}`} fill="none" stroke="#ec9aa6" strokeWidth={0.9} />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#ecg-lg)" />
          {/* calibração 1 mV (10 mm) */}
          <path d={`M ${mm(3)} ${baseline} L ${mm(5)} ${baseline} L ${mm(5)} ${baseline - mm(10)} L ${mm(9)} ${baseline - mm(10)} L ${mm(9)} ${baseline} L ${mm(11)} ${baseline}`}
            stroke="#111" strokeWidth={1.4} fill="none" strokeLinejoin="round" />
          {/* traçado */}
          <path d={path} stroke="#0b0b0b" strokeWidth={1.6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 10.5, color: '#9ca3af', padding: '6px 12px', background: '#fff' }}>
        Traçado gerado a partir dos parâmetros do caso (ilustrativo, derivação única) — treina o padrão; o ECG de 12 derivações está na literatura citada.
      </div>
    </div>
  )
}

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
