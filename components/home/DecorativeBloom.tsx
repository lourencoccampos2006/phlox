'use client'

// Uma pequena flor decorativa que floresce do fio — usada só 2-3 vezes,
// espaçada, nunca como elemento principal. Abre quando entra no ecrã; fecha
// se voltar a sair (scroll para cima reverte, como o resto do sistema).

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'

const DecorativeBloomScene = dynamic(() => import('./DecorativeBloomScene'), { ssr: false })

class BloomErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* silencioso — decorativo, não crítico */ }
  render() { return this.state.failed ? null : this.props.children }
}

export default function DecorativeBloom({ accent = '#5b8a6b', side = 'left' as 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0)
  const [can3d, setCan3d] = useState(false)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') || c.getContext('webgl')
      if (gl) setCan3d(true)
    } catch { /* sem 3D */ }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([entry]) => {
      progressRef.current = entry.isIntersecting ? 1 : 0
      el.classList.toggle('is-in', entry.isIntersecting)
    }, { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (!can3d) return null

  return (
    <div className={`db-wrap db-${side}`} ref={ref}>
      <BloomErrorBoundary>
        <DecorativeBloomScene accent={accent} progressRef={progressRef} />
      </BloomErrorBoundary>
      <style>{`
        .db-wrap { position:absolute; width:120px; height:120px; opacity:0; transition:opacity .6s ease; }
        .db-wrap.is-in { opacity:1; }
        .db-left { left:6%; }
        .db-right { right:6%; }
        @media (max-width:640px) { .db-wrap { width:80px; height:80px; } }
      `}</style>
    </div>
  )
}
