'use client'

// O fio — nasce do centro da flor fechada (herói) e desce pela página,
// SEMPRE em fluxo normal do documento (nada pinado, nada fixo — o scroll
// nunca é intercetado). Um caminho SVG curvo (nunca reto, nunca anguloso)
// desenha-se progressivamente à medida que se desce — e desfaz-se ao subir,
// porque a revelação é uma função direta e contínua da posição de scroll, não
// uma animação disparada uma vez. Ao longo dele, 4 paragens (institucional →
// familiar → pessoal → estudante) e 2 flores decorativas raras.
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

const THREAD_D = 'M50,0 C75,40 20,55 25,80 C30,105 65,150 70,200 C75,240 30,280 50,320 C70,360 15,400 25,440 C35,480 60,530 70,560 C80,590 65,640 70,680 C75,715 30,760 50,800 C70,835 18,865 25,900 C32,930 45,960 50,980'

export default function ThreadJourney({ modes }: { modes: ModeStop[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const [totalLen, setTotalLen] = useState(0)

  useEffect(() => {
    if (pathRef.current) setTotalLen(pathRef.current.getTotalLength())
  }, [])

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
        <path d={THREAD_D} className="tj-thread-bg" />
        <path ref={pathRef} d={THREAD_D} className="tj-thread" />
      </svg>

      <DecorativeBloom accent="#5b8a6b" side="left" />
      <div style={{ position: 'absolute', top: '54%', right: '6%', width: 120, height: 120 }}>
        <DecorativeBloom accent="#c2542f" side="right" />
      </div>

      {modes.map(m => (
        <Link key={m.n} href={m.href} className={`tj-card tj-reveal tj-${m.side}`} style={{ top: `${m.topPct}%` }}>
          <span className="tj-card-stem" aria-hidden="true" />
          <span className="tj-card-kicker">{m.n} · {m.tag}</span>
          <h3 className="tj-card-t">{m.t}</h3>
          <p className="tj-card-lead">{m.lead}</p>
          <span className="tj-card-go">Entrar <span>→</span></span>
        </Link>
      ))}

      <style>{`
        .tj-track { position:relative; height:380vh; background:#f4f8f4; overflow:hidden; }
        .tj-svg { position:absolute; inset:0; width:100%; height:100%; }
        .tj-thread-bg { fill:none; stroke:#dbe6dd; stroke-width:0.45; stroke-linecap:round; }
        .tj-thread { fill:none; stroke:#5b8a6b; stroke-width:0.45; stroke-linecap:round; filter:drop-shadow(0 0 2.5px rgba(91,138,107,0.45)); }

        .tj-card { display:block; box-sizing:border-box; position:absolute; width:min(420px, 42vw); text-decoration:none; background:rgba(255,255,255,0.92); border:1px solid #e2ebe3; border-radius:16px; padding:26px 28px; box-shadow:0 24px 48px -28px rgba(22,40,28,0.22); opacity:0; transition:opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
        .tj-card.is-in { opacity:1; transform:none; }
        .tj-left { left:8%; transform:translateX(-24px); }
        .tj-right { right:8%; transform:translateX(24px); }
        .tj-card-stem { position:absolute; top:50%; width:34px; height:2px; background:#a8c4ae; }
        .tj-left .tj-card-stem { right:100%; }
        .tj-right .tj-card-stem { left:100%; }
        .tj-card-kicker { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:#5b8a6b; font-weight:700; display:block; margin-bottom:10px; }
        .tj-card-t { font-family:var(--font-serif); font-weight:500; font-size:clamp(20px,2.4vw,26px); letter-spacing:-.01em; color:var(--ink); margin:0 0 10px; line-height:1.15; }
        .tj-card-lead { font-size:14px; color:var(--ink-3); line-height:1.6; margin:0 0 16px; }
        .tj-card-go { font-family:var(--font-mono); font-size:11px; font-weight:700; color:#5b8a6b; text-transform:uppercase; letter-spacing:.06em; display:inline-flex; gap:6px; }

        @media (max-width:860px) {
          .tj-track { height:auto; padding:40px 0; }
          .tj-svg { display:none; }
          .tj-card { position:static; left:auto; right:auto; width:auto; max-width:none; margin:20px clamp(20px,6vw,32px); opacity:1; transform:none; transition:none; }
          .tj-card-stem { display:none; }
        }
        @media (prefers-reduced-motion:reduce) {
          .tj-card { transition:none; }
        }
      `}</style>
    </section>
  )
}
