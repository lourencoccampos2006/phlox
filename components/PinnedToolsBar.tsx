'use client'

// PinnedToolsBar — atalhos que o utilizador FIXA (até 6). Aparece no /inicio
// acima do hero. Não confundir com MyTopTools (que aprende automaticamente).
// Tem um botão "Personalizar" que abre um modal.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPins, setPins, PINNABLE_TOOLS, PIN_MAX } from '@/lib/pinnedTools'

export default function PinnedToolsBar() {
  const [pins, setLocalPins] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => { setLocalPins(getPins()) }, [])

  function toggle(path: string) {
    setLocalPins(prev => {
      const next = prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path].slice(0, PIN_MAX)
      setPins(next); return next
    })
  }

  const items = pins.map(p => PINNABLE_TOOLS.find(t => t.path === p)).filter(Boolean) as typeof PINNABLE_TOOLS

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
          {items.length === 0 ? 'Atalhos fixos' : `Atalhos fixos (${items.length}/${PIN_MAX})`}
        </span>
        <button onClick={() => setOpen(true)} style={{ fontSize: 11, fontWeight: 700, color: '#0d6e42', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          {items.length === 0 ? '＋ Adicionar' : 'Personalizar'}
        </button>
      </div>

      {items.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 130px), 1fr))', gap: 8 }}>
          {items.map(it => (
            <Link key={it.path} href={it.path} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: '12px 10px', background: 'white', border: '1px solid var(--border)', borderRadius: 12,
              textDecoration: 'none', textAlign: 'center', transition: 'all 0.15s',
            }} className="pin-tile">
              <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.25 }}>{it.label}</span>
            </Link>
          ))}
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{
          width: '100%', padding: '16px', background: 'white', border: '1.5px dashed var(--border)', borderRadius: 12,
          cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', fontFamily: 'var(--font-sans)', textAlign: 'center',
        }}>
          ＋ Escolhe até {PIN_MAX} ferramentas para teres sempre à mão
        </button>
      )}

      {open && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400 }}>Atalhos fixos</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>Selecionados {pins.length} de {PIN_MAX}</div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-2)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px 22px' }}>
              {Array.from(new Set(PINNABLE_TOOLS.map(t => t.group))).map(group => (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{group}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 6 }}>
                    {PINNABLE_TOOLS.filter(t => t.group === group).map(t => {
                      const checked = pins.includes(t.path)
                      const disabled = !checked && pins.length >= PIN_MAX
                      return (
                        <button key={t.path} onClick={() => !disabled && toggle(t.path)} disabled={disabled}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 9,
                            border: `1.5px solid ${checked ? '#0d6e42' : 'var(--border)'}`,
                            background: checked ? '#f0fdf4' : 'white',
                            cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
                            fontFamily: 'var(--font-sans)', textAlign: 'left',
                          }}>
                          <span style={{ fontSize: 16 }}>{t.icon}</span>
                          <span style={{ fontSize: 12.5, color: checked ? '#15803d' : 'var(--ink-2)', fontWeight: checked ? 700 : 500, flex: 1 }}>{t.label}</span>
                          {checked && <span style={{ fontSize: 11, color: '#15803d' }}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`.pin-tile:hover { border-color: #0d6e42; transform: translateY(-1px); }`}</style>
    </div>
  )
}
