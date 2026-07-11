'use client'

// Wrapper do herói — NÃO pinado, NÃO fixo, scroll normal sempre disponível
// (pedido explícito: nada de esconder o scroll real nem de câmara estilo CAD).
// Composição em camadas: a flor 3D vive em FUNDO (desfocada, esmorecida por
// uma vinheta radial), o texto "Phlox Clinical" é DOM real (Syne, uma linha,
// enorme, efeito oco: contorno colorido + interior da mesma cor do fundo —
// nunca deixa ver a flor por dentro das letras). Ao iniciar o scroll, o texto
// encolhe e desvanece para o centro exatamente quando a flor fecha as pétalas
// — a mesma coreografia de "engolir", agora com o texto sempre legível em
// repouso em vez de competir com a flor pelo mesmo desenho de contorno.

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
          fill="#c98bb0"
          fillOpacity="0.55"
          stroke="#7c4f7a"
          strokeWidth="0.012"
        />
      ))}
      <circle r="0.055" fill="#2f4a3a" />
    </svg>
  )
}

export default function PhloxHero() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const wordWrapRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLHeadingElement>(null)
  const scrollRef = useRef(0)
  const [can3d, setCan3d] = useState(false)

  // Ajusta o tamanho do texto para preencher exatamente a largura disponível
  // numa única linha — "maior do que a flor" só é seguro em qualquer ecrã se
  // for calculado a partir da largura real do texto, não adivinhado em vw.
  useEffect(() => {
    const word = wordRef.current
    const wrap = wordWrapRef.current
    if (!word || !wrap) return
    function fit() {
      const cs = getComputedStyle(wrap!)
      const available = wrap!.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      word!.style.fontSize = '10vw'
      const natural = word!.scrollWidth
      if (natural > 0 && available > 0) {
        const baseline = parseFloat(getComputedStyle(word!).fontSize)
        const next = Math.min(200, Math.max(18, baseline * (available / natural) * 0.96))
        word!.style.fontSize = `${next}px`
      }
    }
    fit()
    // a Syne só fica com as métricas finais depois de carregada — sem isto,
    // o ajuste calcula com a fonte de substituição e a palavra transborda
    // assim que a Syne troca (efeito mais visível em ecrãs estreitos).
    if (document.fonts?.ready) document.fonts.ready.then(fit)
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

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
      <div className="ph-canvas-layer">
        {can3d ? (
          <SceneErrorBoundary fallback={<StaticFlower />}>
            <PhloxFlowerScene scrollRef={scrollRef} />
          </SceneErrorBoundary>
        ) : (
          <StaticFlower />
        )}
      </div>
      <div className="ph-vignette" aria-hidden="true" />

      <div className="ph-word-wrap" ref={wordWrapRef}>
        <h1 className="ph-word" ref={wordRef}>Phlox Clinical</h1>
      </div>

      <div className="ph-cue">
        <span>Role para descobrir a rede</span>
        <span className="ph-cue-line" />
      </div>

      <style>{`
        .ph-hero { position:relative; height:100vh; min-height:640px; background:var(--green-light); display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .ph-canvas-layer { position:absolute; inset:0; filter:blur(4px) saturate(1.02); opacity:0.8; transform-origin:center; animation:ph-canvas-in 1.8s ease both; }
        .ph-static-flower { position:absolute; inset:0; width:100%; height:100%; }
        .ph-vignette { position:absolute; inset:0; background:radial-gradient(ellipse 58% 52% at 50% 46%, var(--green-light) 0%, var(--green-light) 38%, rgba(241,246,243,0.55) 62%, transparent 82%); pointer-events:none; }

        .ph-word-wrap { position:relative; z-index:2; padding:0 5vw; }
        .ph-word {
          margin:0; text-align:center; white-space:nowrap;
          font-family:var(--font-sans); font-weight:800; text-transform:uppercase;
          font-size:clamp(34px, 11.5vw, 158px); letter-spacing:-0.01em; line-height:1;
          -webkit-text-fill-color:var(--green-light); color:var(--green-light);
          -webkit-text-stroke:1.6px var(--green-3);
          paint-order:stroke fill;
          transform:scale(calc(1 - var(--ph-p, 0) * 0.8)) translateY(calc(var(--ph-p, 0) * -14px));
          opacity:calc(1 - var(--ph-p, 0) * 1.35);
          animation:ph-word-in 1.15s cubic-bezier(.16,1,.3,1) both;
          animation-delay:0.15s;
        }

        .ph-cue { position:absolute; z-index:2; left:50%; bottom:5vh; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-4); opacity:calc(1 - var(--ph-p, 0) * 2.2); animation:ph-cue-in 1s ease both; animation-delay:0.9s; }
        .ph-cue-line { width:1px; height:26px; background:linear-gradient(var(--green-3), transparent); }

        @keyframes ph-canvas-in { from { opacity:0; transform:scale(1.3); } to { opacity:0.8; transform:scale(1.14); } }
        @keyframes ph-word-in { from { opacity:0; transform:translateY(22px) scale(0.94); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes ph-cue-in { from { opacity:0; } to { opacity:1; } }

        @media (max-width:640px) {
          .ph-hero { height:92vh; min-height:520px; }
          .ph-word { -webkit-text-stroke:1.1px var(--green-3); }
        }
        @media (prefers-reduced-motion:reduce) {
          .ph-canvas-layer, .ph-word, .ph-cue { animation:none; opacity:1; }
          .ph-word { transform:none; opacity:1; }
        }
      `}</style>
    </section>
  )
}
