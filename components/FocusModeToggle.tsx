'use client'

// FocusModeToggle — alterna entre "Tudo" e "Foco" (só o essencial). Quando em foco,
// adiciona uma classe ao <body> que outras zonas podem usar para esconder ruído.
// Combate confusão de quem prefere uma vista mais limpa.

import { useEffect, useState } from 'react'

const LS_KEY = 'phlox-focus-mode'

export function isFocusMode(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(LS_KEY) === '1'
}

export default function FocusModeToggle() {
  const [focus, setFocus] = useState(false)

  useEffect(() => {
    setFocus(isFocusMode())
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (focus) document.body.classList.add('phlox-focus')
    else document.body.classList.remove('phlox-focus')
  }, [focus])

  function toggle() {
    const next = !focus
    setFocus(next)
    try { localStorage.setItem(LS_KEY, next ? '1' : '0') } catch { /* noop */ }
  }

  return (
    <button onClick={toggle} title={focus ? 'Mostrar tudo' : 'Modo foco — só o essencial'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px',
        background: focus ? '#0b1120' : 'white', color: focus ? 'white' : 'var(--ink-3)',
        border: `1px solid ${focus ? '#0b1120' : 'var(--border)'}`, borderRadius: 10,
        cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)',
      }}>
      <span style={{ fontSize: 13 }}>{focus ? '◉' : '○'}</span>
      {focus ? 'Modo foco' : 'Foco'}
    </button>
  )
}
