'use client'

// WelcomeTour reescrito 2026-06-24 — conversacional e por modo. Em vez de setas
// técnicas, é o Phlox a apresentar-se em 1ª pessoa, em 3 passos curtos, com tom
// adaptado a quem usa (quente para pessoal/cuidador, direto para estudante).
// Só na 1ª visita; saltável; nunca repete. Pensado para quem tem menos à-vontade.

import { useEffect, useState, useCallback } from 'react'
import { modeTheme } from '@/lib/modeTheme'

const SEEN_KEY = 'phlox-welcome-tour-v2'

interface Step { sel?: string; emoji: string; title: string; body: string }

function stepsFor(mode: string): Step[] {
  const common3: Step = { sel: '.phlox-bottom-nav', emoji: '🧭', title: 'Voltar é sempre fácil', body: 'Esta barra em baixo está sempre consigo. Toque em “Início” para voltar aqui a qualquer momento — nunca se vai perder.' }
  if (mode === 'student') return [
    { emoji: '👋', title: 'Bem-vindo ao Phlox', body: 'Aqui treina para os exames com casos reais, flashcards e a Arena. Eu mostro-lhe sempre o melhor passo seguinte.' },
    { sel: '[data-tour="focus"]', emoji: '🎯', title: 'Comece por aqui', body: 'No topo mostro-lhe o que mais lhe convém treinar agora — onde está mais fraco ou o que falta para a meta de hoje.' },
    common3,
  ]
  if (mode === 'caregiver') return [
    { emoji: '👋', title: 'Bem-vindo ao Phlox', body: 'Vou ajudá-lo a cuidar de quem precisa, sem confusões. Tudo num só sítio, em português claro.' },
    { sel: '[data-tour="focus"]', emoji: '💡', title: 'Eu antecipo-me', body: 'No topo digo-lhe o que merece atenção agora — uma toma, uma consulta a chegar. Não precisa de andar à procura.' },
    common3,
  ]
  return [
    { emoji: '👋', title: 'Olá, sou o Phlox', body: 'Vou ajudá-lo com a sua medicação e saúde, de forma simples. Sem termos complicados.' },
    { sel: '[data-tour="focus"]', emoji: '💡', title: 'Eu antecipo-me a si', body: 'No topo do ecrã mostro-lhe sempre a coisa mais importante para agora — uma toma à espera, uma consulta a chegar. É só seguir.' },
    common3,
  ]
}

export default function WelcomeTour({ mode = 'personal' }: { mode?: string }) {
  const [step, setStep] = useState(-1)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const t = modeTheme(mode)
  const steps = stepsFor(mode)

  useEffect(() => {
    try { if (localStorage.getItem(SEEN_KEY)) return } catch { return }
    const tm = setTimeout(() => setStep(0), 800)
    return () => clearTimeout(tm)
  }, [])

  const finish = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch {}
    setStep(-1)
  }, [])

  useEffect(() => {
    if (step < 0 || step >= steps.length) return
    const s = steps[step]
    if (!s.sel) { setRect(null); return }
    const measure = () => {
      const el = document.querySelector(s.sel!) as HTMLElement | null
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => setRect(el.getBoundingClientRect()), 320)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [step]) // eslint-disable-line

  if (step < 0 || step >= steps.length) return null
  const s = steps[step]
  const last = step === steps.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9500 }}>
      <div onClick={() => (last ? finish() : setStep(step + 1))} style={{ position: 'absolute', inset: 0, background: 'rgba(8,12,24,0.6)', backdropFilter: 'blur(2px)' }} />
      {rect && (
        <div style={{ position: 'absolute', top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16, borderRadius: 20, boxShadow: '0 0 0 9999px rgba(8,12,24,0.6)', border: '2px solid rgba(255,255,255,0.9)', pointerEvents: 'none', transition: 'all 0.25s' }} />
      )}

      {/* Cartão central — o Phlox a falar. Calmo, não invasivo. */}
      <div style={{ position: 'absolute', left: '50%', bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))', transform: 'translateX(-50%)', width: 'min(360px, calc(100vw - 28px))', background: 'white', borderRadius: 22, boxShadow: '0 24px 70px rgba(0,0,0,0.35)', padding: '22px 20px 16px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 26 }}>{s.emoji}</div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#0b1120', marginBottom: 7, letterSpacing: '-0.01em' }}>{s.title}</div>
        <p style={{ fontSize: 14.5, color: '#475569', lineHeight: 1.6, margin: '0 0 18px' }}>{s.body}</p>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 16 }}>
          {steps.map((_, i) => <span key={i} style={{ width: i === step ? 20 : 6, height: 6, borderRadius: 3, background: i === step ? t.accent : '#dbe0e6', transition: 'width 0.2s' }} />)}
        </div>
        <button onClick={() => (last ? finish() : setStep(step + 1))} style={{ width: '100%', background: t.accent, color: 'white', border: 'none', borderRadius: 13, padding: '13px', fontSize: 15.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
          {last ? 'Começar a usar' : 'Continuar'}
        </button>
        {!last && <button onClick={finish} style={{ background: 'none', border: 'none', marginTop: 10, fontSize: 13.5, color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Saltar apresentação</button>}
      </div>
    </div>
  )
}
