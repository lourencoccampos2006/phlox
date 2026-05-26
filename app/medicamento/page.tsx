'use client'

// "O que é este medicamento?" — explica em linguagem simples o que um medicamento faz,
// que doenças/sintomas trata, se precisa de receita, como tomar e cuidados. Foto ou nome.

import { useState } from 'react'
import Link from 'next/link'

interface Result {
  identified: string; active: string; what_it_is: string
  what_it_treats: string[]; symptoms: string[]; how_to_take: string
  prescription: string; common_side_effects: string[]; cautions: string[]
  avoid_if: string[]; good_to_know: string; confidence: string; queried?: string
}

function downscale(file: File, maxDim = 1280, q = 0.82): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('img')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ b64: (c.toDataURL('image/jpeg', q).split(',')[1]) || '', mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

const RX_CFG: Record<string, { label: string; color: string; bg: string }> = {
  'sem receita': { label: 'Não precisa de receita', color: '#16a34a', bg: '#f0fdf4' },
  'com receita médica': { label: 'Precisa de receita médica', color: '#d97706', bg: '#fffbeb' },
  'com receita médica especial': { label: 'Receita médica especial', color: '#dc2626', bg: '#fef2f2' },
}

export default function MedicamentoPage() {
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function explain() {
    if (!name.trim() && !photo) return
    setLoading(true); setError(''); setResult(null)
    try {
      let payload: any = { name: name.trim() }
      if (photo && !name.trim()) { const { b64, mime } = await downscale(photo); payload = { image: b64, mimeType: mime } }
      const res = await fetch('/api/medicamento', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setResult(data)
    } catch (e: any) { setError(e.message || 'Não foi possível. Tenta novamente.') }
    finally { setLoading(false) }
  }

  const rx = result ? (RX_CFG[(result.prescription || '').toLowerCase()] || { label: result.prescription, color: '#6b7280', bg: 'var(--bg-2)' }) : null

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const sectionTitle = (t: string, emoji: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
      <span style={{ fontSize: 15 }}>{emoji}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{t}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)', padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Perceber</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>O que é este medicamento?</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>Tira uma foto à caixa ou escreve o nome. Explicamos em palavras simples para que serve, se precisa de receita e o que ter em atenção.</p>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Entrada */}
        <div style={{ ...card, marginBottom: 16 }}>
          <label style={{ display: 'block', border: `1.5px dashed ${photo ? '#0d9488' : 'var(--border)'}`, borderRadius: 12, padding: photo ? 12 : '22px 16px', textAlign: 'center', cursor: 'pointer', background: photo ? '#f0fdfa' : 'var(--bg-2)', marginBottom: 12 }}>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setPhoto(f); setName(''); setResult(null); setError('') } }} />
            {photo ? <div style={{ fontSize: 13, color: '#0d9488', fontWeight: 600 }}>📷 {photo.name} · tocar para trocar</div>
              : <div><div style={{ fontSize: 26, marginBottom: 4 }}>📷</div><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-3)' }}>Tirar foto à caixa</div></div>}
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} /><span style={{ fontSize: 11, color: 'var(--ink-5)' }}>ou escreve o nome</span><div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={name} onChange={e => { setName(e.target.value); if (e.target.value) setPhoto(null) }}
              onKeyDown={e => e.key === 'Enter' && explain()} placeholder="Ex: Ben-u-ron, Brufen, Concor..."
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <button onClick={explain} disabled={loading || (!name.trim() && !photo)}
              style={{ padding: '0 20px', background: (name.trim() || photo) && !loading ? '#0d9488' : 'var(--bg-3)', color: (name.trim() || photo) && !loading ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (name.trim() || photo) && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
              {loading ? 'A ver…' : 'Explicar'}
            </button>
          </div>
          {error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{error}</div>}
        </div>

        {/* Resultado */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)' }}>{result.identified || result.queried}</div>
                  {result.active && <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 2 }}>{result.active}</div>}
                </div>
                {rx && <span style={{ fontSize: 12, fontWeight: 700, color: rx.color, background: rx.bg, border: `1px solid ${rx.color}33`, padding: '5px 11px', borderRadius: 8, whiteSpace: 'nowrap' }}>{rx.label}</span>}
              </div>
              {result.what_it_is && <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, marginTop: 10 }}>{result.what_it_is}</div>}
              {result.confidence === 'baixa' && <div style={{ marginTop: 10, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 11px' }}>⚠ Não tenho a certeza de qual é este medicamento — confirma na farmácia.</div>}
            </div>

            {result.what_it_treats?.length > 0 && (
              <div style={card}>{sectionTitle('Para que serve', '🎯')}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {result.what_it_treats.map((t, i) => <span key={i} style={{ fontSize: 13, color: '#0f766e', background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 7, padding: '5px 11px' }}>{t}</span>)}
                </div>
                {result.symptoms?.length > 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.5 }}><strong>Sintomas:</strong> {result.symptoms.join(', ')}</div>}
              </div>
            )}

            {result.how_to_take && (
              <div style={card}>{sectionTitle('Como se costuma tomar', '💊')}<div style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.how_to_take}</div></div>
            )}

            {result.cautions?.length > 0 && (
              <div style={{ ...card, borderColor: '#fde68a', background: '#fffdf7' }}>{sectionTitle('Cuidados', '⚠️')}
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{result.cautions.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}

            {result.avoid_if?.length > 0 && (
              <div style={{ ...card, borderColor: '#fca5a5', background: '#fff7f7' }}>{sectionTitle('Não tomar (sem falar com o médico) se', '🚫')}
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#991b1b', lineHeight: 1.6 }}>{result.avoid_if.map((c, i) => <li key={i}>{c}</li>)}</ul>
              </div>
            )}

            {result.common_side_effects?.length > 0 && (
              <div style={card}>{sectionTitle('Efeitos secundários comuns', '🩺')}
                <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>{result.common_side_effects.join(' · ')}</div>
              </div>
            )}

            {result.good_to_know && (
              <div style={{ ...card, background: '#f0fdfa', borderColor: '#99f6e4' }}>
                <div style={{ fontSize: 13.5, color: '#0f766e', lineHeight: 1.6 }}>💡 {result.good_to_know}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/interactions" style={{ flex: 1, textAlign: 'center', padding: '11px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Verificar interações →</Link>
              <Link href="/mymeds" style={{ flex: 1, textAlign: 'center', padding: '11px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', textDecoration: 'none' }}>Adicionar à minha lista →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
