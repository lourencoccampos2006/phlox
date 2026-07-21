'use client'

// Reveal — revela uma secção da homepage (fade + subida curta) quando entra no
// ecrã ao fazer scroll. Movimento moderado e orquestrado: um padrão só,
// repetido por secção, nunca simultâneo — não um efeito diferente em cada
// sítio. Respeita prefers-reduced-motion (regra global em app/globals.css).

import { useEffect, useRef, useState } from 'react'

export default function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect() }
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={`lp-reveal ${visible ? 'lp-reveal-in' : ''} ${className}`}>
      {children}
    </div>
  )
}
