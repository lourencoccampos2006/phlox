'use client'

// Wrapper do herói — NÃO pinado, NÃO fixo, scroll normal sempre disponível
// (pedido explícito: nada de esconder o scroll real nem de câmara estilo CAD).
// A cena 3D vive dentro do fluxo normal do documento; o progresso é calculado
// pela posição real do próprio herói, e como ele deixa de estar no ecrã ao
// fim de pouco scroll, a animação de fecho conclui-se rapidamente — exatamente
// "mal se começa a dar scroll" — e depois o herói sai do ecrã como qualquer
// secção normal.

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'

const PhloxFlowerScene = dynamic(() => import('./PhloxFlowerScene'), { ssr: false })

class SceneErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('Flor 3D do herói falhou:', err) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function StaticFlower() {
  return (
    <svg viewBox="-1 -1 2 2" className="ph-static-flower" aria-hidden="true">
      {[0, 1, 2, 3, 4].map(i => (
        <path
          key={i}
          d="M0,0 C-0.32,0.18 -0.34,0.62 -0.16,0.84 C-0.1,0.9 -0.06,0.94 0,0.8 C0.06,0.94 0.1,0.9 0.16,0.84 C0.34,0.62 0.32,0.18 0,0 Z"
          transform={`rotate(${i * 72})`}
          fill="none"
          stroke="#3f6b52"
          strokeWidth="0.016"
        />
      ))}
      <circle r="0.055" fill="none" stroke="#3f6b52" strokeWidth="0.016" />
    </svg>
  )
}

export default function PhloxHero() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef(0)
  const [can3d, setCan3d] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) {
      try {
        const c = document.createElement('canvas')
        const gl = c.getContext('webgl2') || c.getContext('webgl')
        if (gl) setCan3d(true)
      } catch { /* fica na versão estática */ }
    }

    let raf = 0
    function update() {
      raf = 0
      const el = wrapRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      // progresso 0→1 nos primeiros ~55% da altura do próprio herói scrollado
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height * 0.55)))
      scrollRef.current = p
      el.style.setProperty('--ph-p', String(p))
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <section className="ph-hero" ref={wrapRef}>
      <div className="ph-stage">
        {can3d ? (
          <SceneErrorBoundary fallback={<StaticFlower />}>
            <PhloxFlowerScene scrollRef={scrollRef} />
          </SceneErrorBoundary>
        ) : (
          <div className="ph-static-wrap">
            <StaticFlower />
            <span className="ph-static-text">Phlox Clinical</span>
          </div>
        )}
      </div>
      <div className="ph-cue">
        <span>Role para descobrir a rede</span>
        <span className="ph-cue-line" />
      </div>

      <style>{`
        .ph-hero { position:relative; height:88vh; min-height:560px; background:#f4f8f4; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .ph-stage { width:min(92vw, 640px); aspect-ratio:1/1; position:relative; }
        .ph-static-wrap { position:relative; width:100%; height:100%; display:flex; align-items:center; justify-content:center; }
        .ph-static-flower { position:absolute; inset:12%; }
        .ph-static-text { position:relative; font-family:var(--font-serif); font-weight:500; font-size:clamp(28px,5vw,44px); color:var(--ink); letter-spacing:-.01em; }
        .ph-cue { position:absolute; left:50%; bottom:5vh; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-4); }
        .ph-cue-line { width:1px; height:26px; background:linear-gradient(#3f6b52, transparent); }
        @media (max-width:640px) {
          .ph-hero { height:78vh; min-height:460px; }
        }
      `}</style>
    </section>
  )
}
