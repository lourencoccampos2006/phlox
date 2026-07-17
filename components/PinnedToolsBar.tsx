'use client'

// PinnedToolsBar — atalhos que o utilizador FIXA (até 6). Aparece no /inicio
// acima do hero. Não confundir com MyTopTools (que aprende automaticamente).
// Tem um botão "Personalizar" que abre um modal.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getPins, setPins, PINNABLE_TOOLS, PIN_MAX } from '@/lib/pinnedTools'
import PinPickerModal from '@/components/PinPickerModal'

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
        // 2026-06-01: grid de tiles mais compacto e organizado em mobile.
        // 4 colunas em telefones (90 px mínimo), 5+ em desktop.
        <div className="pin-grid">
          {items.map(it => (
            <Link key={it.path} href={it.path} className="pin-tile" title={it.label} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '11px 6px', background: 'white', border: '1px solid var(--border)', borderRadius: 12,
              textDecoration: 'none', textAlign: 'center', transition: 'all 0.15s',
              aspectRatio: '1 / 0.95', minHeight: 76,
            }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.2,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
              }}>{it.label}</span>
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

      <PinPickerModal open={open} onClose={() => setOpen(false)} pins={pins} onToggle={toggle} />
      <style>{`
        .pin-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        @media (min-width: 480px) {
          .pin-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
        }
        @media (min-width: 720px) {
          .pin-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
        }
        .pin-tile:hover { border-color: #0d6e42; transform: translateY(-1px); }
      `}</style>
    </div>
  )
}
