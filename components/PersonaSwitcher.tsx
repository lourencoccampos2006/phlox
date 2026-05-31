'use client'

// PersonaSwitcher — mudar de modo (Pessoal/Cuidador/Estudante/Clínico) num clique.
// Aparece no topo do /inicio e em outras páginas pessoais. Resolve a confusão de
// quem usa o Phlox em mais de um contexto (ex: estudante + cuidador da família).

import { useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { ALL_PERSONAS, personaFor } from '@/lib/userPersona'
import { useToast } from '@/components/Toast'

export default function PersonaSwitcher() {
  const { user, supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  if (!user) return null
  const current = personaFor(user.experience_mode)

  async function switchTo(mode: string) {
    if (mode === user.experience_mode) { setOpen(false); return }
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ experience_mode: mode }).eq('id', user.id)
    if (error) toast.error('Não consegui mudar de modo', error.message)
    else { toast.success(`Modo alterado para ${personaFor(mode).label}`, 'Recarrega para veres o novo dashboard'); setOpen(false); setTimeout(() => location.reload(), 600) }
    setBusy(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 10px',
          background: 'white', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink-2)', fontWeight: 600,
        }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: current.color + '14', color: current.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{current.emoji}</span>
        Modo · <strong style={{ color: current.color }}>{current.label}</strong>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div role="menu" style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 80,
            background: 'white', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 16px 40px -12px rgba(8,12,24,0.18), 0 4px 12px -6px rgba(8,12,24,0.08)',
            minWidth: 280, padding: 6, fontFamily: 'var(--font-sans)',
          }}>
            <div style={{ padding: '6px 10px 8px', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>Mudar de modo</div>
            {ALL_PERSONAS.map(p => {
              const active = p.mode === current.mode
              return (
                <button key={p.mode} onClick={() => switchTo(p.mode)} disabled={busy}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
                    padding: '10px 12px', border: 'none', borderRadius: 9, cursor: busy ? 'wait' : 'pointer',
                    background: active ? p.color + '0d' : 'transparent', fontFamily: 'var(--font-sans)',
                  }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: p.color + '14', color: p.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{p.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{p.label}{active && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: p.color, fontFamily: 'var(--font-mono)' }}>● ATUAL</span>}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{p.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
