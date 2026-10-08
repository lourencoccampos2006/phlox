'use client'

import { useState, useEffect, useCallback, createElement } from 'react'
import Script from 'next/script'
import { useAuth } from '@/components/AuthContext'
import { areaOf } from '@/lib/studyAreas'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

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
  // Favoritos + notas pessoais (localStorage)
  const [favs, setFavs] = useState<(SModel & { note?: string })[]>([])
  const [tab, setTab] = useState<'search' | 'favs'>('search')
  const [noteDraft, setNoteDraft] = useState('')
  const FAVS_KEY = 'phlox-anatomia-favs'

  useEffect(() => { try { const r = localStorage.getItem(FAVS_KEY); if (r) setFavs(JSON.parse(r)) } catch { /* noop */ } }, [])
  const persistFavs = (n: typeof favs) => { setFavs(n); try { localStorage.setItem(FAVS_KEY, JSON.stringify(n)) } catch { /* noop */ } }
  const isFav = active ? favs.some(f => f.uid === active.uid) : false
  const activeFav = active ? favs.find(f => f.uid === active.uid) : null
  useEffect(() => { setNoteDraft(activeFav?.note || '') }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFav() {
    if (!active) return
    if (isFav) persistFavs(favs.filter(f => f.uid !== active.uid))
    else persistFavs([{ ...active, note: '' }, ...favs].slice(0, 60))
  }
  function saveNote() {
    if (!active) return
    if (!isFav) persistFavs([{ ...active, note: noteDraft }, ...favs])
    else persistFavs(favs.map(f => f.uid === active.uid ? { ...f, note: noteDraft } : f))
  }

  const search = useCallback(async (q: string) => {
    if (!q.trim()) return
    setQuery(q); setLoading(true); setError(''); setActive(null)
    try {
      const res = await fetch(`/api/models3d?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      // Mesmo com fallback (sem Sketchfab), mostramos os modelos curados.
      setModels(data.models || [])
      if (data.notice) setError(data.notice)
      else if (!res.ok && !data.models?.length) setError(data.error || 'Erro')
      if ((data.models || []).length) setActive(data.models[0])
    } catch (e: any) { setError(e.message || 'Não foi possível pesquisar.') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { search(suggestions[0]) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const glbViewer = glbSrc ? createElement('model-viewer', {
    src: glbSrc, alt: 'Modelo 3D', 'camera-controls': true, ar: true,
    'ar-modes': 'webxr scene-viewer quick-look', 'auto-rotate': true, 'touch-action': 'pan-y',
    style: { width: '100%', height: '100%', background: 'var(--ink)', borderRadius: 'var(--r-xl)' } as React.CSSProperties,
  }) : null

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Anatomia</span>
        </BarraDeTrabalho>
      }
    >
      <Script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js" strategy="afterInteractive" />
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · 3D · {area.label}</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 'var(--peso-normal)' as any, letterSpacing: '-0.02em', margin: 0 }}>Atlas 3D</h1>
            <p style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-4)', margin: '5px 0 0' }}>Pesquisa modelos 3D reais e explora-os — roda, aproxima e vê em realidade aumentada no telemóvel.</p>
          </div>
          {favs.length > 0 && (
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 'var(--r-lg)' }}>
              <button onClick={() => setTab('search')} style={{ padding: '7px 13px', borderRadius: 'var(--r-md)', border: 'none', background: tab === 'search' ? 'white' : 'transparent', color: tab === 'search' ? 'var(--roxo)' : 'var(--ink-4)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: tab === 'search' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>Pesquisar</button>
              <button onClick={() => setTab('favs')} style={{ padding: '7px 13px', borderRadius: 'var(--r-md)', border: 'none', background: tab === 'favs' ? 'white' : 'transparent', color: tab === 'favs' ? 'var(--roxo)' : 'var(--ink-4)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: tab === 'favs' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>★ {favs.length}</button>
            </div>
          )}
        </div>

        {/* Pesquisa */}
        {tab === 'search' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search(query)}
                placeholder="Pesquisar (ex: heart, brain, knee joint)…"
                style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '11px 14px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
              <button onClick={() => search(query)} disabled={loading} style={{ padding: '0 18px', background: 'var(--roxo)', color: 'white', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{loading ? '…' : 'Pesquisar'}</button>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
              {suggestions.map(s => <button key={s} onClick={() => search(s)} style={{ fontSize: 'var(--t-meta)', color: 'var(--roxo)', background: 'var(--roxo-claro)', border: '1px solid var(--roxo-borda)', borderRadius: 'var(--r-xl)', padding: '5px 11px', cursor: 'pointer' }}>{s}</button>)}
            </div>
          </>
        )}

        {/* Viewer ativo */}
        {active && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ height: 'min(58vh, 440px)', borderRadius: 'var(--r-xl)', overflow: 'hidden', background: 'var(--ink)' }}>
              <iframe title={active.name} src={active.embed} allow="autoplay; fullscreen; xr-spatial-tracking" allowFullScreen style={{ width: '100%', height: '100%', border: 0 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)' }}>{active.name} <span style={{ fontWeight: 'var(--peso-normal)' as any, color: 'var(--ink-5)', fontSize: 'var(--t-meta)' }}>por {active.author}</span></div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={toggleFav} style={{ padding: '6px 12px', borderRadius: 'var(--r-md)', border: `1.5px solid ${isFav ? 'var(--roxo)' : 'var(--border)'}`, background: isFav ? 'var(--roxo-claro)' : 'white', color: isFav ? 'var(--roxo)' : 'var(--ink-3)', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {isFav ? '★ Guardado' : '☆ Guardar'}
                </button>
                <a href={active.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--t-meta)', color: 'var(--roxo)', textDecoration: 'none', fontWeight: 'var(--peso-corpo)' as any }}>Sketchfab →</a>
              </div>
            </div>
            {isFav && (
              <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                <input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="Adicionar nota pessoal a este modelo…" style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '8px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={saveNote} style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--roxo)', color: 'white', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Guardar nota</button>
              </div>
            )}
          </div>
        )}

        {tab === 'favs' && (
          <div style={{ marginBottom: 14 }}>
            {favs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-5)', fontSize: 'var(--t-dado)' }}>Sem favoritos. Clica ☆ Guardar num modelo para o adicionares.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
                {favs.map(f => (
                  <button key={f.uid} onClick={() => { setActive(f); setTab('search'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    style={{ padding: 0, border: '2px solid var(--roxo-borda)', borderRadius: 'var(--r-lg)', overflow: 'hidden', cursor: 'pointer', background: 'white', textAlign: 'left' }}>
                    {f.thumb && <img src={f.thumb} alt={f.name} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />}
                    <div style={{ padding: '7px 9px' }}>
                      <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                      {f.note && <div style={{ fontSize: 'var(--t-micro)', color: 'var(--roxo)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.note}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)', marginBottom: 12 }}>{error}</div>}

        {/* Galeria de resultados — só no tab pesquisa */}
        {tab === 'search' && (loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>{[0,1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 'var(--r-lg)' }} />)}</div>
        ) : models.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8 }}>
            {models.map(m => (
              <button key={m.uid} onClick={() => { setActive(m); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                style={{ padding: 0, border: `2px solid ${active?.uid === m.uid ? 'var(--roxo)' : 'var(--border)'}`, borderRadius: 'var(--r-lg)', overflow: 'hidden', cursor: 'pointer', background: 'white', textAlign: 'left' }}>
                {m.thumb && <img src={m.thumb} alt={m.name} style={{ width: '100%', height: 86, objectFit: 'cover', display: 'block' }} />}
                <div style={{ padding: '6px 8px', fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
              </button>
            ))}
          </div>
        ) : !error && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-5)', textAlign: 'center', padding: 20 }}>Sem resultados. Tenta outro termo (em inglês dá mais resultados).</div>)}

        {/* .glb por URL */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink)', marginBottom: 8 }}>Tens um modelo próprio? Carrega .glb / .gltf</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={glbUrl} onChange={e => setGlbUrl(e.target.value)} placeholder="https://.../modelo.glb" style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)', padding: '9px 12px', fontSize: 'var(--t-dado)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => glbUrl.trim() && setGlbSrc(glbUrl.trim())} style={{ padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', fontWeight: 'var(--peso-forte)' as any, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Carregar</button>
          </div>
          {glbViewer && <div style={{ height: 'min(50vh, 380px)', marginTop: 12 }}>{glbViewer}</div>}
        </div>
      </div>
    </Mesa>
  )
}
