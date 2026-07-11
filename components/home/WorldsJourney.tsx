'use client'

// A secção herói+rede — adaptação direta do mecanismo de vectrfl.com
// (referência trazida pelo Fernando) ao Phlox: UM diorama 3D contínuo fica
// fixo no ecrã enquanto se desce a página. Nos primeiros ~14% do scroll
// pinado, mostra-se o herói (título grande + CTA) sobre o diorama, câmara
// parada. Depois o herói esbate-se, entra a lista numerada, a câmara começa
// a percorrer o diorama e um caminho desenha-se a ligar cada "mundo" — o
// passo ativo expande, os outros ficam reduzidos a uma linha. Aqui a
// metáfora até encaixa melhor que no original: a "rede" já é o conceito
// central do Phlox ("Toda a saúde, numa só rede").
// Todo o crossfade herói↔lista corre por mutação direta de estilo num ref
// (sem re-render por frame); só o índice ativo (5 valores possíveis) passa
// por React state. Desligado em mobile (<960px) — vira herói normal + lista
// simples, sem diorama nem pin.

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import type { DioramaNode } from './DioramaScene'

export interface WorldNode {
  n: string
  tag: string
  t: string
  lead: string
  items: string[]
  accent: string
  href: string
  tier: number
}

const DioramaScene = dynamic(() => import('./DioramaScene'), { ssr: false })
const HERO_END = 0.16

export function useCanRender3D() {
  const [can, setCan] = useState(false)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (gl) setCan(true)
    } catch { /* fica sem diorama */ }
  }, [])
  return can
}

class DioramaErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.error('Diorama 3D falhou:', err) }
  render() { return this.state.failed ? null : this.props.children }
}

export default function WorldsJourney({
  worlds, heroKicker, heroTitle, heroLead,
}: {
  worlds: WorldNode[]
  heroKicker: string
  heroTitle: ReactNode
  heroLead: string
}) {
  const can3d = useCanRender3D()
  const pinRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const journeyScrollRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    // position:sticky não funciona aqui: <body> tem overflow-x:hidden sitewide
    // (globals.css, ~145 páginas), o que força overflow-y:auto e torna o body
    // um "scroll container" — quebra sticky para QUALQUER descendente, por
    // mais fundo que esteja. Em vez disso: fixed/absolute alternado a JS,
    // consoante a posição real do .wj-pin (a mesma técnica usada como
    // alternativa clássica quando sticky não é viável).
    let raf = 0
    function update() {
      raf = 0
      const el = pinRef.current
      const inner = innerRef.current
      if (!el || !inner) return
      const vh = window.innerHeight

      // <961px o CSS assume layout mobile (.wj-inner:position:static, sem pin
      // nem diorama) — nunca escrever position inline aí, ou vencia a media
      // query (inline style tem mais especificidade) e partia o fallback.
      if (window.innerWidth < 961) {
        if (inner.style.position) { inner.style.position = ''; inner.style.top = ''; inner.style.bottom = '' }
        journeyScrollRef.current = 1
        if (activeIndexRef.current !== 0) { activeIndexRef.current = 0; setActiveIndex(0) }
        return
      }

      const r = el.getBoundingClientRect()

      if (r.top > 0) {
        inner.style.position = 'absolute'
        inner.style.top = '0'
        inner.style.bottom = 'auto'
      } else if (r.bottom > vh) {
        inner.style.position = 'fixed'
        inner.style.top = '0'
        inner.style.bottom = 'auto'
      } else {
        inner.style.position = 'absolute'
        inner.style.top = 'auto'
        inner.style.bottom = '0'
      }

      const range = Math.max(1, r.height - vh)
      const p = Math.min(1, Math.max(0, -r.top / range))

      const journeyP = Math.min(1, Math.max(0, (p - HERO_END) / (1 - HERO_END)))
      journeyScrollRef.current = journeyP

      const heroOpacity = Math.min(1, Math.max(0, 1 - p / (HERO_END * 0.82)))
      const listOpacity = Math.min(1, Math.max(0, (p - HERO_END * 0.55) / (HERO_END * 0.5)))
      if (heroRef.current) {
        heroRef.current.style.opacity = String(heroOpacity)
        heroRef.current.style.transform = `translateY(${(1 - heroOpacity) * -18}px)`
        heroRef.current.style.pointerEvents = heroOpacity < 0.05 ? 'none' : 'auto'
      }
      if (listRef.current) {
        listRef.current.style.opacity = String(listOpacity)
        listRef.current.style.transform = `translateY(${(1 - listOpacity) * 18}px)`
        listRef.current.style.pointerEvents = listOpacity < 0.6 ? 'none' : 'auto'
      }

      const idx = Math.min(worlds.length - 1, Math.floor(journeyP * worlds.length))
      if (idx !== activeIndexRef.current) {
        activeIndexRef.current = idx
        setActiveIndex(idx)
      }
    }
    function onScroll() { if (!raf) raf = requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    update()
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [worlds.length])

  const dioramaNodes: DioramaNode[] = worlds.map(w => ({ accent: w.accent, tier: w.tier }))

  return (
    <section className="wj-pin" ref={pinRef} id="mundos">
      <div className="wj-inner" ref={innerRef}>
        <div className="wj-frame">
          <div className="wj-stage">
            {can3d && (
              <DioramaErrorBoundary>
                <div className="wj-canvas">
                  <DioramaScene nodes={dioramaNodes} scrollRef={journeyScrollRef} />
                </div>
              </DioramaErrorBoundary>
            )}
          </div>

          <div className="wj-hero" ref={heroRef}>
            <div className="wj-kicker"><span className="wj-kicker-rule" />{heroKicker}</div>
            <h1 className="wj-h1">{heroTitle}</h1>
            <p className="wj-lead">{heroLead}</p>
            <div className="wj-actions">
              <Link href="/login" className="wj-go">Criar conta grátis</Link>
            </div>
            <div className="wj-cue"><span>Role para descobrir a rede</span><span className="wj-cue-line" /></div>
          </div>

          <div className="wj-panel" ref={listRef}>
            <span className="wj-panel-kicker">A rede Phlox</span>
            <ol className="wj-list">
              {worlds.map((w, i) => {
                const on = i === activeIndex
                return (
                  <li key={w.n} className={`wj-item ${on ? 'on' : ''}`}>
                    <Link href={w.href} className="wj-item-row">
                      <span className="wj-num" style={{ ['--a' as string]: w.accent } as React.CSSProperties}>{w.n}</span>
                      <span className="wj-item-t">{w.t}</span>
                    </Link>
                    <div className="wj-item-body">
                      <p className="wj-item-lead">{w.lead}</p>
                      <ul className="wj-item-list">
                        {w.items.map(it => <li key={it}>{it}</li>)}
                      </ul>
                      <Link href={w.href} className="wj-item-go" style={{ ['--a' as string]: w.accent } as React.CSSProperties}>Entrar <span>→</span></Link>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      </div>

      <style>{`
        .wj-pin { position:relative; height:640vh; background:#dde9e1; }
        .wj-inner { position:absolute; top:0; left:0; right:0; height:100vh; overflow:hidden; }
        .wj-frame { position:relative; width:100%; height:100%; }
        .wj-stage { position:absolute; inset:0; }
        .wj-canvas { position:absolute; left:0; right:0; top:25vh; height:100vh; }

        .wj-hero { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; text-align:center; padding:7vh clamp(20px,6vw,40px) 0; }
        .wj-kicker { display:flex; align-items:center; gap:11px; font-family:var(--font-mono); font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--ink-3); font-weight:700; margin-bottom:18px; }
        .wj-kicker-rule { width:34px; height:1.5px; background:#c2542f; }
        .wj-h1 { font-family:var(--font-serif); font-weight:500; font-size:clamp(38px,6.4vw,84px); line-height:0.98; letter-spacing:-.03em; margin:0 0 18px; color:var(--ink); max-width:16ch; }
        .wj-h1 em { font-style:italic; color:#c2542f; }
        .wj-lead { font-size:clamp(15px,1.6vw,17px); color:var(--ink-3); line-height:1.55; max-width:44ch; margin:0 0 22px; }
        .wj-actions { margin-bottom:0; }
        .wj-go { display:inline-block; padding:15px 28px; background:var(--ink); color:#fff; border-radius:2px; text-decoration:none; font-weight:700; font-size:15px; letter-spacing:.01em; transition:background .18s, transform .15s; }
        .wj-go:hover { background:#c2542f; transform:translateY(-1px); }
        .wj-cue { position:absolute; left:50%; bottom:5vh; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-4); }
        .wj-cue-line { width:1px; height:26px; background:linear-gradient(var(--ink-4), transparent); }

        .wj-panel { position:absolute; left:clamp(20px,5vw,56px); top:50%; transform:translateY(-50%); width:min(440px, 92vw); max-height:82vh; overflow-y:auto; background:rgba(255,255,255,0.88); backdrop-filter:blur(14px) saturate(160%); border:1px solid rgba(255,255,255,0.6); border-radius:14px; padding:clamp(20px,3vw,30px); box-shadow:0 30px 60px -30px rgba(22,24,29,.25); }
        .wj-panel-kicker { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.14em; text-transform:uppercase; color:#c2542f; font-weight:700; display:block; margin-bottom:16px; }
        .wj-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; }
        .wj-item { border-top:1px solid var(--border); }
        .wj-item:first-child { border-top:none; }
        .wj-item-row { display:flex; align-items:center; gap:14px; text-decoration:none; padding:14px 0; }
        .wj-num { font-family:var(--font-mono); font-size:11px; font-weight:700; color:var(--ink-4); border:1.5px solid var(--border-2); border-radius:6px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .2s; }
        .wj-item.on .wj-num { color:#fff; background:var(--a); border-color:var(--a); }
        .wj-item-t { font-family:var(--font-serif); font-size:16.5px; color:var(--ink-3); transition:color .2s, font-weight .2s; }
        .wj-item.on .wj-item-t { color:var(--ink); font-weight:600; font-size:20px; }
        .wj-item-body { padding:0 0 22px 40px; }
        @media (min-width:961px) { .wj-item:not(.on) .wj-item-body { display:none; } }
        .wj-item-lead { font-size:13.5px; color:var(--ink-3); line-height:1.55; margin:0 0 12px; }
        .wj-item-list { list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:6px; }
        .wj-item-list li { position:relative; padding-left:14px; font-size:12.5px; color:var(--ink-4); line-height:1.4; }
        .wj-item-list li::before { content:''; position:absolute; left:0; top:6px; width:5px; height:5px; border-radius:50%; background:var(--a); }
        .wj-item-go { font-family:var(--font-mono); font-size:11px; font-weight:700; color:var(--a); text-transform:uppercase; letter-spacing:.06em; text-decoration:none; display:inline-flex; gap:6px; }

        @media (max-width:960px) {
          .wj-pin { height:auto; background:#dde9e1; padding:clamp(56px,12vh,80px) 0 40px; }
          .wj-inner { position:static; height:auto; overflow:visible; }
          .wj-stage { display:none; }
          .wj-hero { position:static; padding:0 clamp(20px,6vw,32px); opacity:1 !important; transform:none !important; pointer-events:auto !important; }
          .wj-cue { display:none; }
          .wj-panel { position:static; transform:none; width:auto; max-height:none; margin:36px clamp(20px,6vw,32px) 0; opacity:1 !important; pointer-events:auto !important; background:#fff; }
          .wj-item-body { padding-left:0; margin-top:8px; }
          .wj-item-t, .wj-item.on .wj-item-t { font-size:18px; font-weight:600; color:var(--ink); }
          .wj-num, .wj-item.on .wj-num { color:#fff; background:var(--a); border-color:var(--a); }
        }
        @media (prefers-reduced-motion:reduce) {
          .wj-hero, .wj-panel { transition:none; }
        }
      `}</style>
    </section>
  )
}
