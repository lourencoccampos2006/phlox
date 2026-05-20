'use client'

import Header from '@/components/Header'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Voltar ao topo"
      style={{
        position: 'fixed', bottom: 80, right: 20, zIndex: 200,
        width: 40, height: 40, borderRadius: '50%',
        background: 'var(--ink)', color: 'white',
        border: 'none', cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        opacity: 0.85,
      }}
    >
      ↑
    </button>
  )
}

function CmdKHint() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 2400)
    return () => clearTimeout(timer)
  }, [show])
  return show ? (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--ink)', color: 'white', borderRadius: 8,
      padding: '8px 16px', fontSize: 13, fontFamily: 'var(--font-mono)',
      zIndex: 300, pointerEvents: 'none', whiteSpace: 'nowrap',
      boxShadow: '0 4px 16px rgba(0,0,0,0.22)',
    }}>
      ⌘K — Ferramentas rápidas
    </div>
  ) : null
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [cmdK, setCmdK] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      setCmdK(true)
      setTimeout(() => setCmdK(false), 2400)
      router.push('/ferramentas')
    }
  }, [router])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <>
      <Header />
      {children}
      <ScrollToTop />
      {cmdK && <CmdKHint />}
    </>
  )
}
