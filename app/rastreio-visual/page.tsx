'use client'

// /rastreio-visual — Rastreio Visual (Pro). Dois modos, escolhidos ao criar
// cada track:
// - "Rastreio de risco": critérios ABCDE de melanoma, tom conservador de
//   propósito (mais vale assinalar de mais que de menos).
// - "Acompanhar doença diagnosticada" (2026-07-22): para quem já tem uma
//   condição confirmada por um médico (ex: hidradenite supurativa, eczema,
//   ferida em tratamento) e só quer ver a progressão ao longo do tempo, com
//   relatórios claros — sem alarme a cada foto. Só sinaliza o médico perante
//   sinais de alerta concretos.
// Compara sempre com a foto anterior da MESMA track para avaliar evolução —
// nunca com uma leitura falhada (fotos ilegíveis não ficam guardadas).

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { printDoc } from '@/lib/print'

const ACCENT = '#7c3aed'

interface Track { id: string; label: string; body_area?: string | null; mode: 'screening' | 'condition'; condition_name?: string | null; created_at: string }
interface Abcde {
  // modo 'screening'
  asymmetry?: string; border?: string; color?: string; diameter_mm?: number | null; evolution_note?: string | null; recommendation?: string
  // modo 'condition'
  description?: string; trend?: 'melhoria' | 'estavel' | 'a_agravar'; trend_note?: string | null; doctor_flag?: boolean; doctor_reason?: string | null
  confidence?: string
}
interface Photo { id: string; track_id: string; photo_url: string; abcde: Abcde; risk_score: number; risk_level: 'baixo' | 'moderado' | 'alto'; taken_at: string }

const RISK_META: Record<string, { color: string; bg: string; border: string }> = {
  baixo: { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  moderado: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  alto: { color: '#991b1b', bg: '#fee2e2', border: '#fca5a5' },
}
const TREND_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  melhoria: { label: 'Melhoria', color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  estavel: { label: 'Estável', color: '#475569', bg: '#f8fafc', border: '#e2e8f0' },
  a_agravar: { label: 'A agravar', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
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
  const [newMode, setNewMode] = useState<'screening' | 'condition'>('screening')
  const [newConditionName, setNewConditionName] = useState('')
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
      else {
        body.new_track_label = newLabel.trim()
        body.new_track_body_area = newArea.trim()
        body.new_track_mode = newMode
        if (newMode === 'condition') body.new_track_condition_name = newConditionName.trim()
      }
      const res = await fetch('/api/lesion-track', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao analisar a foto')
      if (data.retry) {
        // Foto ilegível — não foi guardada (para não poluir a comparação de
        // evolução seguinte com uma leitura falhada). Pede para tentar outra vez.
        setErr(data.message || 'Não foi possível identificar uma lesão nesta foto — tenta outra vez, mais próxima e bem iluminada.')
        return
      }
      setAdding(false); setNewLabel(''); setNewArea(''); setNewConditionName(''); setNewMode('screening')
      await load()
    } catch (e: any) { setErr(e.message || 'Erro ao processar a foto.') }
    finally { setUploading(null) }
  }

  async function deleteTrack(trackId: string, label: string) {
    if (!confirm(`Apagar "${label}" e todas as suas fotos? Não se pode desfazer.`)) return
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch(`/api/lesion-track?track_id=${trackId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` },
    })
    if (res.ok) await load()
    else { const data = await res.json().catch(() => ({})); setErr(data.error || 'Não foi possível apagar.') }
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

  function printReport(t: Track) {
    const tphotos = photosFor(t.id).slice().sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime())
    printDoc({
      docTitle: `Acompanhamento — ${t.condition_name || t.label}`,
      docSubtitle: t.body_area ? `${t.label} · ${t.body_area}` : t.label,
      meta: [{ label: 'fotos registadas', value: String(tphotos.length) }],
      sections: [{
        heading: 'Evolução ao longo do tempo',
        records: tphotos.map(p => ({
          title: new Date(p.taken_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' }),
          tags: p.abcde.trend ? [{ label: TREND_META[p.abcde.trend]?.label || p.abcde.trend, color: TREND_META[p.abcde.trend]?.color || '#475569' }] : undefined,
          body: [p.abcde.description, p.abcde.trend_note].filter(Boolean).join(' — ') || undefined,
        })),
      }],
      footerNote: 'Relatório gerado a partir do acompanhamento fotográfico no Phlox. Documento informativo — não substitui o processo clínico oficial.',
    })
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Link href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</Link>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChosen} style={{ display: 'none' }} />

      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #5b21b6)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Pro · Visão IA</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Rastreio Visual</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Fotografa uma lesão ao longo do tempo — para rastrear risco (ABCDE) ou para acompanhar com calma uma condição já diagnosticada.</p>
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
              const isCondition = t.mode === 'condition'
              const rm = latest ? RISK_META[latest.risk_level] : RISK_META.baixo
              const tm = latest?.abcde.trend ? TREND_META[latest.abcde.trend] : null
              return (
                <div key={t.id} style={{ background: 'white', border: `1px solid ${rm.border}`, borderRadius: 14, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    {latest?.photo_url && <img src={latest.photo_url} alt={t.label} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>{t.label}</div>
                        {isCondition && <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT, background: `${ACCENT}14`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acompanhamento</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{[t.condition_name, t.body_area].filter(Boolean).join(' · ')}</div>
                    </div>
                    {latest && !isCondition && <span style={{ fontSize: 10.5, fontWeight: 800, color: rm.color, background: rm.bg, border: `1px solid ${rm.border}`, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>Risco {latest.risk_level} · {latest.risk_score}</span>}
                    {latest && isCondition && tm && <span style={{ fontSize: 10.5, fontWeight: 800, color: tm.color, background: tm.bg, border: `1px solid ${tm.border}`, borderRadius: 6, padding: '3px 9px', flexShrink: 0 }}>{tm.label}</span>}
                  </div>

                  {latest && !isCondition && (
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

                  {latest && isCondition && (
                    <div style={{ padding: '0 16px 14px' }}>
                      {latest.abcde.description && <div style={{ fontSize: 12.5, color: '#334155', marginBottom: 8, lineHeight: 1.5 }}>{latest.abcde.description}</div>}
                      {prev && latest.abcde.trend_note && (
                        <div style={{ fontSize: 12.5, color: tm?.color || '#475569', background: tm?.bg || '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                          <strong>Desde {new Date(prev.taken_at).toLocaleDateString('pt-PT')}:</strong> {latest.abcde.trend_note}
                        </div>
                      )}
                      {latest.abcde.doctor_flag && latest.abcde.doctor_reason && (
                        <div style={{ fontSize: 12.5, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                          ⚠️ <strong>Vale a pena falar com o médico:</strong> {latest.abcde.doctor_reason}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{tphotos.length} foto{tphotos.length === 1 ? '' : 's'} · última em {new Date(latest.taken_at).toLocaleDateString('pt-PT')}</div>
                    </div>
                  )}

                  <div style={{ padding: '10px 16px 14px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => triggerUpload(t.id)} disabled={uploading === t.id} style={{ padding: '9px 16px', background: uploading === t.id ? '#e2e8f0' : ACCENT, color: uploading === t.id ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: uploading === t.id ? 'wait' : 'pointer' }}>
                      {uploading === t.id ? 'A analisar…' : '📷 Nova foto (câmara ou galeria)'}
                    </button>
                    {isCondition && tphotos.length > 0 && (
                      <button onClick={() => printReport(t)} style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#0b1120', cursor: 'pointer' }}>
                        📄 Relatório
                      </button>
                    )}
                    <button onClick={() => deleteTrack(t.id, t.label)} title="Apagar" style={{ padding: '9px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, color: '#94a3b8', cursor: 'pointer' }}>
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}

            {adding ? (
              <div style={{ background: 'white', border: `1px dashed ${ACCENT}`, borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Novo acompanhamento</div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 10, padding: 3, background: 'var(--bg-2)', borderRadius: 9 }}>
                  {(['screening', 'condition'] as const).map(m => (
                    <button key={m} onClick={() => setNewMode(m)} style={{
                      flex: 1, padding: '8px 10px', border: 'none', borderRadius: 7, cursor: 'pointer',
                      fontSize: 12, fontWeight: newMode === m ? 800 : 600,
                      background: newMode === m ? ACCENT : 'transparent', color: newMode === m ? 'white' : '#64748b',
                    }}>
                      {m === 'screening' ? 'Lesão nova (rastreio)' : 'Doença já diagnosticada'}
                    </button>
                  ))}
                </div>
                {newMode === 'condition' && (
                  <p style={{ fontSize: 11.5, color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>Para uma condição já confirmada por um médico. Acompanha a progressão com calma — só avisa perante sinais de alerta concretos.</p>
                )}

                {newMode === 'condition' && (
                  <input value={newConditionName} onChange={e => setNewConditionName(e.target.value)} placeholder="Nome da condição (como o médico a chamou)" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
                )}
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={newMode === 'condition' ? 'Onde é (ex: zona a acompanhar)' : 'Onde é (ex: sinal ou mancha)'} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
                <input value={newArea} onChange={e => setNewArea(e.target.value)} placeholder="Zona do corpo (opcional)" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => triggerUpload(null)} disabled={!newLabel.trim() || uploading === 'new'} style={{ padding: '9px 16px', background: newLabel.trim() ? ACCENT : '#e2e8f0', color: newLabel.trim() ? 'white' : '#94a3b8', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: newLabel.trim() ? 'pointer' : 'default' }}>
                    {uploading === 'new' ? 'A analisar…' : '📷 Primeira foto (câmara ou galeria)'}
                  </button>
                  <button onClick={() => setAdding(false)} style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAdding(true)} style={{ padding: '14px', background: 'white', border: `2px dashed ${ACCENT}66`, borderRadius: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Vigiar uma nova lesão ou condição</button>
            )}

            <p style={{ fontSize: 11, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.6 }}>Apoio informativo, não substitui a avaliação de um dermatologista. Se uma lesão sangra, cresce depressa ou muda muito, marca consulta.</p>
          </div>
        )}
      </div>
    </div>
  )
}
