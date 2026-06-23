'use client'

// WelcomeTour — tour guiado curto na 1ª visita ao /inicio. Destaca o essencial
// da ORIENTAÇÃO (o que fazer, onde está o resto, como voltar ao início), não
// funcionalidades. Saltável, e nunca mais aparece depois de visto. Pensado para
// quem tem menos à-vontade com tecnologia: linguagem simples, passos curtos.

import { useEffect, useState, useCallback } from 'react'

const SEEN_KEY = 'phlox-welcome-tour-v1'

interface Step { sel: string; title: string; body: string; place: 'bottom' | 'top' }
const STEPS: Step[] = [
  { sel: '[data-tour="needs"]', title: 'Comece por aqui', body: 'Toque numa destas opções para fazer o que precisa. Estão sempre aqui à entrada.', place: 'bottom' },
  { sel: '[data-tour="all"]', title: 'Está tudo aqui', body: 'Para ver tudo o que o Phlox faz, é só tocar neste botão. Nada fica escondido.', place: 'top' },
  { sel: '.phlox-bottom-nav', title: 'Voltar é fácil', body: 'Esta barra em baixo está sempre consigo. Toque em "Início" para voltar a este ecrã a qualquer momento.', place: 'top' },
]

export default function WelcomeTour({ mode }: { mode?: string }) {
  const [step, setStep] = useState(-1)
  const [rect, setRect] = useState<DOMRect | null>(null)

  // Arranca o tour após a página montar (e só se nunca foi visto).
  useEffect(() => {
    try { if (localStorage.getItem(SEEN_KEY)) return } catch { return }
    const t = setTimeout(() => setStep(0), 700)
    return () => clearTimeout(t)
  }, [])

  const finish = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch {}
    setStep(-1)
  }, [])

  // Mede o elemento-alvo do passo atual.
  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return
    const measure = () => {
      const el = document.querySelector(STEPS[step].sel) as HTMLElement | null
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => setRect(el.getBoundingClientRect()), 320)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step])

  if (step < 0 || step >= STEPS.length) return null
  const s = STEPS[step]
  const last = step === STEPS.length - 1

  // Posição do balão relativa ao alvo (com fallback ao centro do ecrã).
  const vw = typeof window !== 'undefined' ? window.innerWidth : 360
  const vh = typeof window !== 'undefined' ? window.innerHeight : 640
  let top = vh / 2 - 80, left = vw / 2, anchored = false
  if (rect) {
    anchored = true
    left = Math.min(Math.max(rect.left + rect.width / 2, 170), vw - 170)
    top = s.place === 'bottom' ? rect.bottom + 14 : rect.top - 14
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }}>
      {/* Véu escuro com recorte à volta do alvo */}
      <div onClick={() => (last ? finish() : setStep(step + 1))} style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,24,0.55)', backdropFilter: 'blur(1px)' }} />
      {rect && (
        <div style={{
          position: 'absolute', top: rect.top - 8, left: rect.left - 8,
          width: rect.width + 16, height: rect.height + 16, borderRadius: 18,
          boxShadow: '0 0 0 9999px rgba(8,12,24,0.55)', border: '2px solid white',
          pointerEvents: 'none', transition: 'all 0.25s',
        }} />
      )}

      {/* Balão */}
      <div style={{
        position: 'absolute', top, left, transform: `translateX(-50%) ${anchored && s.place === 'top' ? 'translateY(-100%)' : ''}`,
        width: 'min(320px, calc(100vw - 32px))', background: 'white', borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.28)', padding: '18px 18px 14px', transition: 'all 0.25s',
      }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {STEPS.map((_, i) => (
            <span key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? '#0d6e42' : '#e5e7eb' }} />
          ))}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: '#0b1120', marginBottom: 6 }}>{s.title}</div>
        <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.55, margin: '0 0 16px' }}>{s.body}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <button onClick={finish} style={{ background: 'none', border: 'none', padding: '8px 4px', fontSize: 14, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            Saltar
          </button>
          <button onClick={() => (last ? finish() : setStep(step + 1))} style={{ background: '#0d6e42', color: 'white', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
            {last ? 'Começar' : 'Seguinte'}
          </button>
        </div>
      </div>
    </div>
  )
}
