'use client'

// WidgetToggleList — liga/desliga os widgets de /inicio (pessoal/cuidador).
// Mesmo padrão visual do ModuleToggleList (liga/desliga módulos), mas para
// lib/homeWidgets.ts. Só mostra/esconde — a ORDEM fica sempre a desenhada
// em WIDGETS_BY_MODE, de propósito (ver comentário nesse ficheiro).

import { useEffect, useState } from 'react'
import { WIDGETS_BY_MODE, getWidgetPrefs, toggleWidget, type HomeWidgetId } from '@/lib/homeWidgets'

export default function WidgetToggleList({ mode }: { mode: string }) {
  const [enabled, setEnabled] = useState<HomeWidgetId[] | null>(null)
  useEffect(() => { setEnabled(getWidgetPrefs(mode)) }, [mode])

  const widgets = WIDGETS_BY_MODE[mode] || []
  if (widgets.length === 0 || enabled === null) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {widgets.map(w => {
        const on = enabled.includes(w.id)
        return (
          <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{w.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{w.hint}</div>
            </div>
            <button onClick={() => setEnabled(toggleWidget(mode, w.id))} aria-label={on ? 'Desativar' : 'Ativar'}
              style={{ width: 42, height: 24, borderRadius: 12, background: on ? '#0d6e42' : 'var(--bg-3)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
