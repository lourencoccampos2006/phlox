'use client'

import { useState, createElement } from 'react'
import Script from 'next/script'

// Visualizador 3D para estudo (Google <model-viewer>). Rodar, zoom e AR no telemóvel.
// Carrega qualquer modelo .glb/.gltf. Base para um atlas 3D por área de saúde.

interface Model { id: string; label: string; area: string; src: string }

// Modelos de demonstração (públicos) — substituir por modelos anatómicos próprios (.glb).
const MODELS: Model[] = [
  { id: 'heart', label: 'Coração (demo)', area: 'Cardiologia', src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb' },
  { id: 'mol', label: 'Molécula (demo)', area: 'Química / Farmácia', src: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb' },
]

export default function Anatomia3DPage() {
  const [src, setSrc] = useState(MODELS[0].src)
  const [activeId, setActiveId] = useState(MODELS[0].id)
  const [urlInput, setUrlInput] = useState('')
  const [autoRotate, setAutoRotate] = useState(true)

  const viewer = createElement('model-viewer', {
    src,
    alt: 'Modelo 3D',
    'camera-controls': true,
    ar: true,
    'ar-modes': 'webxr scene-viewer quick-look',
    'shadow-intensity': '1',
    exposure: '1',
    'auto-rotate': autoRotate ? true : undefined,
    'touch-action': 'pan-y',
    style: { width: '100%', height: '100%', background: '#0b1120', borderRadius: 14, '--poster-color': 'transparent' } as React.CSSProperties,
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Script type="module" src="https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js" strategy="afterInteractive" />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Estudo · 3D</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Atlas 3D</h1>
          <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Roda, aproxima e explora modelos 3D. No telemóvel toca em <strong>AR</strong> para ver em realidade aumentada.</p>
        </div>

        {/* Viewer */}
        <div style={{ height: 'min(60vh, 460px)', marginBottom: 12 }}>{viewer}</div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {MODELS.map(m => (
            <button key={m.id} onClick={() => { setSrc(m.src); setActiveId(m.id) }} style={{ padding: '8px 14px', borderRadius: 9, border: `1.5px solid ${activeId === m.id ? '#7c3aed' : 'var(--border)'}`, background: activeId === m.id ? '#faf5ff' : 'white', color: activeId === m.id ? '#7c3aed' : 'var(--ink-3)', fontSize: 13, fontWeight: activeId === m.id ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
              {m.label}
            </button>
          ))}
          <button onClick={() => setAutoRotate(r => !r)} style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'white', color: 'var(--ink-4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            {autoRotate ? 'Parar rotação' : 'Rodar'}
          </button>
        </div>

        {/* Load by URL */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Carregar modelo por URL (.glb / .gltf)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://.../modelo.glb" style={{ flex: 1, minWidth: 200, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={() => { if (urlInput.trim()) { setSrc(urlInput.trim()); setActiveId('') } }} style={{ padding: '9px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Carregar</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 8, lineHeight: 1.5 }}>
            Os modelos atuais são demonstrações. Para um atlas anatómico real, alojam-se modelos <strong>.glb</strong> (ex.: no Supabase Storage) e listam-se por área de estudo.
          </div>
        </div>
      </div>
    </div>
  )
}
