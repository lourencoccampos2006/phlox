'use client'

// ShortcutsModule — atalhos personalizáveis (todos os modos).
// REDESIGN 2026-08-09 (pedido do Fernando): as linhas finas em texto eram
// pouco amigáveis/pouco óbvias como botões — passam a grelha de "widgets":
// cartões maiores, com ícone destacado, mais fáceis de reconhecer e tocar.
// A personalização em si (escolher os 6) continua a viver no mesmo
// PinPickerModal, aberto por "Personalizar" ou em /settings.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import PinPickerModal from '@/components/PinPickerModal'
import { getPins, setPins as persistPins, PINNABLE_TOOLS } from '@/lib/pinnedTools'
import { quickActions } from '@/lib/homeIntelligence'
import type { ModeTheme } from '@/lib/modeTheme'

const PIN_ICON: Record<string, string> = {
  '/mymeds': 'pill', '/scan': 'camera', '/interactions': 'shield', '/ai': 'spark',
  '/familia': 'family', '/vitals': 'heart', '/sintomas': 'heart',
  '/arena': 'trophy', '/study': 'cards', '/tutor': 'spark', '/labs': 'search',
  '/medicamento': 'question', '/timeline': 'calendar', '/passport': 'shield',
  '/health-import': 'calendar', '/guardados': 'star', '/calendario': 'calendar',
  '/adherencia': 'target',
}
const MAX = 6

export default function ShortcutsModule({ mode, theme: t }: { mode: string; theme: ModeTheme }) {
  const [pinIds, setPinIds] = useState<string[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => { setPinIds(getPins()) }, [])

  function togglePin(path: string) {
    setPinIds(prev => {
      const cur = prev || []
      const next = cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path].slice(0, MAX)
      persistPins(next)
      return next
    })
  }

  if (pinIds === null) return <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />

  const pins = pinIds
    .map(id => PINNABLE_TOOLS.find(x => x.path === id))
    .filter(Boolean)
    .map((x: any) => ({ href: x.path, icon: PIN_ICON[x.path] || 'grid', label: x.label }))
  const seen = new Set(pins.map(p => p.href))
  const combined = [...pins, ...quickActions(mode).filter(a => !seen.has(a.href)).map(a => ({ href: a.href, icon: a.icon, label: a.label }))].slice(0, MAX)

  return (
    <div>
      <PinPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} pins={pinIds} onToggle={togglePin} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {combined.map(a => (
          <Link key={a.href} href={a.href} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10,
            padding: '16px 14px', borderRadius: t.radius, background: t.surface,
            border: `1px solid ${t.border}`, textDecoration: 'none', minHeight: 92,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={a.icon} size={19} color={t.accent} />
            </div>
            <span style={{ fontSize: 13, color: t.ink, fontWeight: 700, lineHeight: 1.3 }}>{a.label}</span>
          </Link>
        ))}
      </div>
      <button onClick={() => setPickerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: t.accent, fontFamily: 'var(--font-sans)' }}>
        <Icon name="sliders" size={14} color={t.accent} /> Personalizar
      </button>
    </div>
  )
}
