'use client'

// O fio — nasce do centro da flor fechada (herói) e desce pela página,
// SEMPRE em fluxo normal do documento (nada pinado, nada fixo — o scroll
// nunca é intercetado). Pensa-se como uma RAIZ que cresce: só se vê o troço já
// crescido (nunca uma pré-visualização do caminho por crescer) — um caminho
// SVG curvo e serpenteante desenha-se progressivamente à medida que se desce,
// e desfaz-se ao subir, porque a revelação é uma função direta e contínua da
// posição de scroll, não uma animação disparada uma vez. Ao longo dele, 4
// paragens (institucional → familiar → pessoal → estudante) e uma dúzia de
// flores pequenas que brotam apenas quando a raiz já cresceu até lá — a
// preencher o espaço vazio sem nunca antecipar o que ainda não cresceu.
// Sem elemento/modelo 3D a representar cada modo — só o caule/cartão com texto.

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import DecorativeBloom from './DecorativeBloom'

export interface ModeStop {
  n: string
  tag: string
  t: string
  lead: string
  href: string
  side: 'left' | 'right'
  topPct: number
}

const THREAD_D = 'M50,0 C80,35 10,50 20,85 C30,120 75,140 80,175 C85,205 15,225 20,260 C25,295 78,315 82,350 C86,380 12,400 18,435 C24,470 74,495 78,530 C82,560 14,585 20,620 C26,655 76,680 80,715 C84,745 16,770 22,805 C28,840 72,865 76,900 C80,930 30,955 50,980'

// frações de comprimento ao longo do caminho onde brota um botão pequeno —
// só fica visível quando a raiz (o troço desenhado) já lá chegou.
const BUD_T = [0.05, 0.12, 0.19, 0.27, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9, 0.96]
const BUD_PETAL = 'M0,0 C-0.32,0.18 -0.34,0.62 -0.16,0.84 C-0.1,0.9 -0.06,0.94 0,0.8 C0.06,0.94 0.1,0.9 0.16,0.84 C0.34,0.62 0.32,0.18 0,0 Z'

export default function ThreadJourney({ modes }: { modes: ModeStop[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const hiRef = useRef<SVGPathElement>(null)
  const budRefs = useRef<(SVGGElement | null)[]>([])
  const [totalLen, setTotalLen] = useState(0)
  const [budPts, setBudPts] = useState<{ ax: number; ay: number; x: number; y: number; r: number; tone: number }[]>([])

  useEffect(() => {
    if (pathRef.current) setTotalLen(pathRef.current.getTotalLength())
  }, [])

  useEffect(() => {
    const path = pathRef.current
    if (!path || !totalLen) return
    setBudPts(BUD_T.map((t, i) => {
      const pt = path.getPointAtLength(t * totalLen)
      const side = i % 2 === 0 ? 1 : -1
      const jitter = 5 + (i % 3) * 2.6
      return { ax: pt.x, ay: pt.y, x: pt.x + side * jitter, y: pt.y - 1.2, r: 1.3 + (i % 3) * 0.5, tone: i % 2 }
    }))
  }, [totalLen])

  useEffect(() => {
    const track = trackRef.current
    const path = pathRef.current
    if (!track || !path || !totalLen) return
    let raf = 0
    function update() {
      raf = 0
      const r = track!.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.3)))
      const len = p * totalLen
      path!.style.strokeDasharray = `${len} ${totalLen}`
      if (hiRef.current) hiRef.current.style.strokeDasharray = `${len} ${totalLen}`
      budRefs.current.forEach((el, i) => { if (el) el.classList.toggle('is-grown', p >= BUD_T[i]) })
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [totalLen])

  useEffect(() => {
    const items = document.querySelectorAll('.tj-reveal')
    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle('is-in', e.isIntersecting)
    }, { threshold: 0.3, rootMargin: '0px 0px -10% 0px' })
    items.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section className="tj-track" ref={trackRef}>
      <svg className="tj-svg" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="tj-root-grad" x1="0" y1="0" x2="0" y2="1000" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#75a988" />
            <stop offset="55%" stopColor="#537d61" />
            <stop offset="100%" stopColor="#3f6b52" />
          </linearGradient>
        </defs>
        {/* o caule/raiz principal — gradiente + linha de brilho central, para ler como um caule redondo, não um traço plano */}
        <path ref={pathRef} d={THREAD_D} className="tj-thread" />
        <path ref={hiRef} d={THREAD_D} className="tj-thread-hi" />

        {budPts.map((pt, i) => (
          <g key={i} ref={el => { budRefs.current[i] = el }} className="tj-bloom-unit">
            {/* caulezinho — liga a flor pequena ao caule principal, desenha-se primeiro */}
            <line x1={pt.ax} y1={pt.ay} x2={pt.x} y2={pt.y} className="tj-stalk" />
            {/* a flor só "floresce" (escala com pop, não aparece do nada) depois do caulezinho */}
            <g className="tj-bud" style={{ transform: `translate(${pt.x}px, ${pt.y}px) scale(${pt.r})` }}>
              <g className="tj-bud-inner">
                {[0, 1, 2, 3, 4].map(k => (
                  <path
                    key={k} d={BUD_PETAL} transform={`rotate(${k * 72})`}
                    fill={pt.tone === 0 ? '#c98bb0' : '#a9cdb3'}
                    fillOpacity="0.85"
                    stroke={pt.tone === 0 ? '#7c4f7a' : '#5b8a6b'}
                    strokeWidth="0.05"
                  />
                ))}
              </g>
            </g>
          </g>
        ))}
      </svg>

      <DecorativeBloom accent="#5b8a6b" side="left" />
      <div style={{ position: 'absolute', top: '54%', right: '6%', width: 120, height: 120 }}>
        <DecorativeBloom accent="#c2542f" side="right" />
      </div>

      {modes.map(m => (
        <Link key={m.n} href={m.href} className={`tj-card tj-reveal tj-${m.side}`} style={{ top: `${m.topPct}%` }}>
          <span className="tj-card-num" aria-hidden="true">{m.n}</span>
          <span className="tj-card-stem" aria-hidden="true" />
          <span className="tj-card-kicker">{m.n} · {m.tag}</span>
          <h3 className="tj-card-t">{m.t}</h3>
          <p className="tj-card-lead">{m.lead}</p>
          <span className="tj-card-go">Entrar <span>→</span></span>
        </Link>
      ))}

      <style>{`
        .tj-track { position:relative; height:380vh; background:var(--green-light); overflow:hidden; }
        .tj-svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; }
        .tj-thread { fill:none; stroke:url(#tj-root-grad); stroke-width:0.85; stroke-linecap:round; filter:drop-shadow(0 0 3px rgba(63,107,82,0.4)); }
        .tj-thread-hi { fill:none; stroke:#bfdcc7; stroke-width:0.18; stroke-linecap:round; opacity:0.5; }

        .tj-stalk { stroke:#6b8f77; stroke-width:0; stroke-linecap:round; opacity:0; transition:stroke-width .5s cubic-bezier(.16,1,.3,1), opacity .35s ease; }
        .tj-bloom-unit.is-grown .tj-stalk { stroke-width:0.14; opacity:0.85; }
        .tj-bud { opacity:0; transition:opacity .3s ease .25s; transform-box:fill-box; }
        .tj-bloom-unit.is-grown .tj-bud { opacity:1; }
        .tj-bud-inner { transform-box:fill-box; transform-origin:center; transform:scale(0.2); }
        .tj-bloom-unit.is-grown .tj-bud-inner { animation:tj-bloom .75s cubic-bezier(.34,1.56,.64,1) .3s both; }
        @keyframes tj-bloom { 0% { transform:scale(0.18) rotate(-10deg); } 65% { transform:scale(1.16) rotate(3deg); } 100% { transform:scale(1) rotate(0deg); } }

        .tj-card { display:block; box-sizing:border-box; position:absolute; width:min(420px, 42vw); text-decoration:none; background:rgba(255,255,255,0.94); backdrop-filter:blur(6px); border:1px solid var(--border); border-radius:20px; padding:30px 32px; box-shadow:0 28px 56px -30px rgba(22,40,28,0.28); opacity:0; transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); overflow:hidden; }
        .tj-card.is-in { opacity:1; transform:none; }
        .tj-card:hover { transform:translateY(-4px); box-shadow:0 34px 64px -28px rgba(22,40,28,0.34); }
        .tj-card.is-in:hover { transform:translateY(-4px); }
        .tj-left { left:8%; transform:translateX(-24px); }
        .tj-right { right:8%; transform:translateX(24px); }
        .tj-card-num { position:absolute; top:-0.15em; right:14px; font-family:var(--font-serif); font-weight:500; font-size:96px; line-height:1; color:var(--green); opacity:0.07; pointer-events:none; }
        .tj-card-stem { position:absolute; top:50%; width:34px; height:2px; background:#a8c4ae; }
        .tj-left .tj-card-stem { right:100%; }
        .tj-right .tj-card-stem { left:100%; }
        .tj-card-kicker { position:relative; font-family:var(--font-mono); font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:#5b8a6b; font-weight:700; display:block; margin-bottom:12px; }
        .tj-card-t { position:relative; font-family:var(--font-serif); font-weight:500; font-size:clamp(20px,2.4vw,27px); letter-spacing:-.01em; color:var(--ink); margin:0 0 10px; line-height:1.15; }
        .tj-card-lead { position:relative; font-size:14px; color:var(--ink-3); line-height:1.6; margin:0 0 16px; }
        .tj-card-go { position:relative; font-family:var(--font-mono); font-size:11px; font-weight:700; color:#5b8a6b; text-transform:uppercase; letter-spacing:.06em; display:inline-flex; gap:6px; transition:gap .25s ease; }
        .tj-card:hover .tj-card-go { gap:10px; }

        @media (max-width:860px) {
          .tj-track { height:auto; padding:40px 0; }
          .tj-svg { display:none; }
          .tj-card { position:static; left:auto; right:auto; width:auto; max-width:none; margin:20px clamp(20px,6vw,32px); opacity:1; transform:none; transition:none; }
          .tj-card-stem { display:none; }
        }
        @media (prefers-reduced-motion:reduce) {
          .tj-card, .tj-bud, .tj-stalk { transition:none; }
          .tj-bloom-unit.is-grown .tj-bud-inner { animation:none; transform:scale(1); }
        }
      `}</style>
    </section>
  )
}
