'use client'

// ModuleToggleList — "super customizável a partir das definições" (item
// pedido 2026-07-21). Liga/desliga os módulos do /inicio para o modo atual.

import { useEffect, useState } from 'react'
import { MODULES_BY_MODE, getModulePrefs, toggleModule, type ModuleId } from '@/lib/inicioModules'

export default function ModuleToggleList({ mode }: { mode: string }) {
  const [enabled, setEnabled] = useState<ModuleId[] | null>(null)
  useEffect(() => { setEnabled(getModulePrefs(mode)) }, [mode])

  const modules = MODULES_BY_MODE[mode] || []
  if (modules.length === 0 || enabled === null) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {modules.map(m => {
        const on = enabled.includes(m.id)
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{m.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{m.hint}</div>
            </div>
            <button onClick={() => setEnabled(toggleModule(mode, m.id))} aria-label={on ? 'Desativar' : 'Ativar'}
              style={{ width: 42, height: 24, borderRadius: 12, background: on ? '#0d6e42' : 'var(--bg-3)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
