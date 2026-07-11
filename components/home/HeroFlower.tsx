'use client'

// Elemento 3D do herói — a flor Phlox a abrir à medida que se desce a página.
// Arquitetura em 2 camadas, ambas orientadas pelo MESMO valor de progresso de
// scroll (0→1, calculado por rAF a partir da posição real do herói — nada de
// animation-timeline/CSS scroll-driven, que depende de suporte recente do
// browser e falha em silêncio quando não existe):
//   1. Sempre presente: uma flor SVG plana (5 pétalas, cor por mundo, zero
//      gradiente/glow) que abre por scale — funciona em qualquer browser, sem
//      JS 3D nenhum, idêntica em servidor/cliente.
//   2. Client-only, se o dispositivo tiver WebGL e sem prefers-reduced-motion:
//      substitui pela flor 3D real (FlowerScene, three.js) com a MESMA
//      geometria de pétala, agora a abrir de facto em profundidade.

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'

const FlowerScene = dynamic(() => import('./FlowerScene'), { ssr: false })

const PETAL_D = 'M100,100 C78,88 72,50 100,25 C128,50 122,88 100,100 Z'

// Se o WebGL falhar por qualquer razão (perda de contexto, driver, GPU
// esgotado) isto NUNCA deve derrubar a página inteira — só a flor 3D. Cai de
// volta para a versão SVG, que é sempre segura.
class FlowerErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('Flor 3D falhou, a usar versão SVG:', err) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function FlowerSVG({ accents, svgRef }: { accents: string[]; svgRef: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={svgRef} viewBox="0 0 200 200" className="flower-svg" aria-hidden="true" style={{ ['--bloom' as string]: 0.18 } as React.CSSProperties}>
      {accents.map((accent, i) => (
        <g key={accent} className="flower-petal" style={{ transformOrigin: '100px 100px', transform: `rotate(${(i * 360) / accents.length}deg) scale(var(--bloom))` }}>
          <path d={PETAL_D} fill={accent} />
        </g>
      ))}
      <circle cx="100" cy="100" r="13" fill="var(--ink)" />
    </svg>
  )
}

export default function HeroFlower({ accents }: { accents: string[] }) {
  const [can3d, setCan3d] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollRef = useRef(0)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduced) {
      try {
        const c = document.createElement('canvas')
        const gl = c.getContext('webgl2') || c.getContext('webgl')
        if (gl) setCan3d(true)
      } catch { /* fica na versão SVG */ }
    }

    let raf = 0
    function update() {
      raf = 0
      const el = wrapRef.current
      if (!el) return
      const vh = window.innerHeight
      const pin = el.closest('.lp-hero-pin') as HTMLElement | null
      let p: number
      if (pin) {
        const r = pin.getBoundingClientRect()
        const range = Math.max(1, r.height - vh)
        p = Math.min(1, Math.max(0, -r.top / range))
      } else {
        const r = el.getBoundingClientRect()
        p = Math.min(1, Math.max(0, -r.top / Math.max(1, vh * 0.85)))
      }
      scrollRef.current = p
      if (svgRef.current) svgRef.current.style.setProperty('--bloom', String(0.18 + p * 0.82))
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  return (
    <div className="flower-wrap" ref={wrapRef}>
      {can3d ? (
        <FlowerErrorBoundary fallback={<FlowerSVG accents={accents} svgRef={svgRef} />}>
          <div className="flower-3d">
            <FlowerScene accents={accents} scrollRef={scrollRef} />
          </div>
        </FlowerErrorBoundary>
      ) : (
        <FlowerSVG accents={accents} svgRef={svgRef} />
      )}
    </div>
  )
}
