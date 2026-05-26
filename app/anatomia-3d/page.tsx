'use client'

import { useState, useEffect, useCallback, createElement } from 'react'
import Script from 'next/script'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'

// Atlas 3D real — pesquisa modelos públicos na Sketchfab (API gratuita) e mostra-os
// embebidos. Sugestões por área do curso do estudante. Também aceita .glb por URL.

interface SModel { uid: string; name: string; author: string; thumb: string; faces: number; embed: string; link: string }

// Sugestões de pesquisa por área (termos em inglês — mais resultados 3D)
const SUGGESTIONS: Record<string, string[]> = {
  medicine: ['human heart anatomy', 'brain anatomy', 'skeleton', 'lungs', 'kidney', 'human skull'],
  dentistry: ['tooth anatomy', 'human teeth', 'jaw mandible', 'molar', 'oral cavity'],
  pharmacy: ['molecule', 'aspirin molecule', 'caffeine molecule', 'dna', 'protein structure'],
  nursing: ['human heart', 'skeleton', 'lungs anatomy', 'digestive system'],
  biomedical: ['cell', 'dna', 'bacteria', 'virus', 'antibody'],
  physiotherapy: ['knee joint', 'shoulder anatomy', 'spine', 'muscle anatomy', 'hip joint'],
  nutrition: ['digestive system', 'stomach anatomy', 'liver', 'glucose molecule'],
  veterinary: ['dog anatomy', 'cat skeleton', 'horse anatomy', 'animal skull'],
  psychology: ['brain anatomy', 'neuron', 'human brain', 'limbic system'],
  other: ['human heart', 'brain', 'skeleton', 'cell', 'dna'],
}

export default function Anatomia3DPage() {
  const { user } = useAuth() as any
  const area = areaOf(user?.student_area)
  const areaId = user?.student_area || 'other'
  const suggestions = SUGGESTIONS[areaId] || SUGGESTIONS.other

  const [query, setQuery] = useState('')
  const [models, setModels] = useState<SModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<SModel | null>(null)
  const [glbUrl, setGlbUrl] = useState('')
  const [glbSrc, setGlbSrc] = useState('')

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return
    setQuery(q); setLoading(true); setError(''); setActive(null)
    try {
      const res = await fetch(`/api/models3d?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro')
      setModels(data.models || [])
      if ((data.models || []).length) setActive(data.models[0])
    } catch (e: any) { setError(e.message || 'Não foi possível pesquisar.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { search(suggestions[0]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const glbViewer = glbSrc ? createElement('model-viewer', {
    src: glbSrc, alt: 'Modelo 3D', 'camera-controls': true, ar: true,
    'ar-modes': 'webxr scene-viewer quick-look', 'auto-rotate': true, 'touch-action': 'pan-y',
    style: { width: '100%', height: '100%', background: '#0b1120', borderRadius: 14 } as React.CSSProperties,
  }) : null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js" strategy="afterInteractive" />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · 3D · {area.label}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Atlas 3D</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Pesquisa modelos 3D reais e explora-os — roda, aproxima e vê em realidade aumentada no telemóvel.</p>
        </div>

        {/* Pesquisa */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(query)}
            placeholder="Pesquisar (ex: heart, brain, knee joint)…"
            style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <button onClick={() => search(query)} disabled={loading} style={{ padding: '0 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{loading ? '…' : 'Pesquisar'}</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {suggestions.map(s => <button key={s} onClick={() => search(s)} style={{ fontSize: 12, color: '#7c3aed', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 20, padding: '5px 11px', cursor: 'pointer' }}>{s}</button>)}
        </div>

        {/* Viewer ativo */}
        {active && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 'min(58vh, 440px)', borderRadius: 14, overflow: 'hidden', background: '#0b1120' }}>
              <iframe title={active.name} src={active.embed} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{active.name} <span style={{ fontWeight: 400, color: 'var(--ink-5)', fontSize: 12 }}>por {active.author}</span></div>
              <a href={active.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>Abrir no Sketchfab →</a>
            </div>
          </div>
        )}

        {error && <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b', marginBottom: 12 }}>{error}</div>}

        {/* Galeria de resultados */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>{[0,1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 10 }} />)}</div>
        ) : models.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
            {models.map(m => (
              <button key={m.uid} onClick={() => { setActive(m); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{ padding: 0, border: `2px solid ${active?.uid === m.uid ? '#7c3aed' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', cursor: 'pointer', background: 'white', textAlign: 'left' }}>
                {m.thumb && <img src={m.thumb} alt={m.name} style={{ width: '100%', height: 86, objectFit: 'cover', display: 'block' }} />}
                <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
              </button>
            ))}
          </div>
        ) : !error && <div style={{ fontSize: 13, color: 'var(--ink-5)', textAlign: 'center', padding: 20 }}>Sem resultados. Tenta outro termo (em inglês dá mais resultados).</div>}

        {/* .glb por URL */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Tens um modelo próprio? Carrega .glb / .gltf</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={glbUrl} onChange={e => setGlbUrl(e.target.value)} placeholder="https://.../modelo.glb" style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => glbUrl.trim() && setGlbSrc(glbUrl.trim())} style={{ padding: '9px 16px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Carregar</button>
          </div>
          {glbViewer && <div style={{ height: 'min(50vh, 380px)', marginTop: 12 }}>{glbViewer}</div>}
        </div>
      </div>
    </div>
  )
}
