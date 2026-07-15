'use client'

// /rastreio-visual — Rastreio Visual com risco dermatológico ABCDE (Pro).
// Fotografa uma lesão/mancha ao longo do tempo; a IA de visão pontua cada
// foto pelos critérios ABCDE (o mesmo que um dermatologista usa) e compara
// com a foto anterior da MESMA lesão para avaliar evolução — não é só um
// arquivo de fotos lado a lado, é uma pontuação de risco real e contínua.

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#7c3aed'

interface Track { id: string; label: string; body_area?: string | null; created_at: string }
interface Abcde { asymmetry?: string; border?: string; color?: string; diameter_mm?: number | null; evolution_note?: string | null; recommendation?: string; confidence?: string }
interface Photo { id: string; track_id: string; photo_url: string; abcde: Abcde; risk_score: number; risk_level: 'baixo' | 'moderado' | 'alto'; taken_at: string }

const RISK_META: Record<string, { color: string; bg: string; border: string }> = {
  baixo: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  moderado: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  alto: { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
}

function downscaleImage(file: File, maxDim = 1024, q = 0.82): Promise<{ b64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(); const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) { if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim } else { w = Math.round(w * maxDim / h); h = maxDim } }
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const ctx = c.getContext('2d'); if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve({ b64: (c.toDataURL('image/jpeg', q).split(',')[1]) || '', mime: 'image/jpeg' })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')) }
    img.src = url
  })
}

export default function RastreioVisualPage() {
  const { user, supabase } = useAuth() as any
  const [tracks, setTracks] = useState<Track[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newArea, setNewArea] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/lesion-track', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
    const data = await res.json()
    if (res.ok) { setTracks(data.tracks || []); setPhotos(data.photos || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  function photosFor(trackId: string) {
    return photos.filter(p => p.track_id === trackId).sort((a, b) => new Date(b.taken_at).getTime() - new Date(a.taken_at).getTime())
  }

  async function uploadPhoto(file: File, trackId: string | null) {
    setUploading(trackId || 'new'); setErr('')
    try {
      const { b64, mime } = await downscaleImage(file)
      const { data: sd } = await supabase.auth.getSession()
      const body: any = { image: b64, mimeType: mime }
      if (trackId) body.track_id = trackId
      else { body.new_track_label = newLabel.trim(); body.new_track_body_area = newArea.trim() }
      const res = await fetch('/api/lesion-track', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao analisar a foto')
      setAdding(false); setNewLabel(''); setNewArea('')
      await load()
    } catch (e: any) { setErr(e.message || 'Erro ao processar a foto.') }
    finally { setUploading(null) }
  }

  function triggerUpload(trackId: string | null) {
    setPendingTrackId(trackId)
    fileInputRef.current?.click()
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    uploadPhoto(file, pendingTrackId)
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChosen} style={{ display: 'none' }} />

      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #5b21b6)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Pro · Visão IA</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Rastreio Visual</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Fotografa uma lesão ou mancha ao longo do tempo. A IA pontua os critérios ABCDE e avisa se a evolução for preocupante.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 780 }}>
        {err && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 16 }}>{err}</div>}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 14 }} />)}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {tracks.map(t => {
              const tphotos = photosFor(t.id)
              const latest = tphotos[0]
              const prev = tphotos[1]
              const rm = latest ? RISK_META[latest.risk_level] : RISK_META.baixo
              return (
                <div key={t.id} style={{ background: 'white', border: `1px solid ${rm.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {latest?.photo_url && <img src={latest.photo_url} alt={t.label} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>{t.label}</div>
                      {t.body_area && <div style={{ fontSize: 12, color: '#94a3b8' }}>{t.body_area}</div>}
                    </div>
                    {latest && <span style={{ fontSize: 10.5, fontWeight: 800, color: rm.color, background: rm.bg, border: `1px solid ${rm.border}`, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>Risco {latest.risk_level} · {latest.risk_score}</span>}
                  </div>

                  {latest && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 10 }}>
                        {latest.abcde.asymmetry && <div style={{ fontSize: 12, color: '#475569' }}><strong>A</strong> · {latest.abcde.asymmetry}</div>}
                        {latest.abcde.border && <div style={{ fontSize: 12, color: '#475569' }}><strong>B</strong> · {latest.abcde.border}</div>}
                        {latest.abcde.color && <div style={{ fontSize: 12, color: '#475569' }}><strong>C</strong> · {latest.abcde.color}</div>}
                        {latest.abcde.diameter_mm != null && <div style={{ fontSize: 12, color: '#475569' }}><strong>D</strong> · ~{latest.abcde.diameter_mm}mm</div>}
                      </div>
                      {prev && latest.abcde.evolution_note && (
                        <div style={{ fontSize: 12.5, color: rm.color, background: rm.bg, borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                          <strong>Evolução (vs {new Date(prev.taken_at).toLocaleDateString('pt-PT')}):</strong> {latest.abcde.evolution_note}
                        </div>
                      )}
                      {latest.abcde.recommendation && <div style={{ fontSize: 12.5, color: '#0b1120', marginBottom: 10 }}>💡 {latest.abcde.recommendation}</div>}
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{tphotos.length} foto{tphotos.length === 1 ? '' : 's'} · última em {new Date(latest.taken_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                  )}

                  <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f1f5f9' }}>
                    <button onClick={() => triggerUpload(t.id)} disabled={uploading === t.id} style={{ padding: '9px 16px', background: uploading === t.id ? '#e2e8f0' : ACCENT, color: uploading === t.id ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: uploading === t.id ? 'wait' : 'pointer' }}>
                      {uploading === t.id ? 'A analisar…' : '📷 Nova foto desta lesão'}
                    </button>
                  </div>
                </div>
              )
            })}

            {adding ? (
              <div style={{ background: 'white', border: `1px dashed ${ACCENT}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Nova lesão a vigiar</div>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Ex: Sinal no braço esquerdo" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
                <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Zona do corpo (opcional)" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => triggerUpload(null)} disabled={!newLabel.trim() || uploading === 'new'} style={{ padding: '9px 16px', background: newLabel.trim() ? ACCENT : '#e2e8f0', color: newLabel.trim() ? 'white' : '#94a3b8', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: newLabel.trim() ? 'pointer' : 'default' }}>
                    {uploading === 'new' ? 'A analisar…' : '📷 Tirar primeira foto'}
                  </button>
                  <button onClick={() => setAdding(false)} style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} style={{ padding: '14px', background: 'white', border: `2px dashed ${ACCENT}66`, borderRadius: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Vigiar uma nova lesão</button>
            )}

            <p style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.6 }}>Apoio informativo, não substitui a avaliação de um dermatologista. Se uma lesão sangra, cresce depressa ou muda muito, marca consulta.</p>
          </div>
        )}
      </div>
    </div>
  )
}
