'use client'

// AlertPrefsList — "avisos personalizados" (pedido 2026-07-21). Liga/desliga
// que TIPOS de aviso de saúde aparecem em "A minha saúde" no /inicio.

import { useEffect, useState } from 'react'
import { ALERT_CATEGORIES, getAlertPrefs, toggleAlertCategory } from '@/lib/alertPrefs'
import type { AlertCategory } from '@/lib/healthAlerts'

export default function AlertPrefsList() {
  const [enabled, setEnabled] = useState<AlertCategory[] | null>(null)
  useEffect(() => { setEnabled(getAlertPrefs()) }, [])

  if (enabled === null) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ALERT_CATEGORIES.map(c => {
        const on = enabled.includes(c.id)
        return (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--bg-3)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>{c.hint}</div>
            </div>
            <button onClick={() => setEnabled(toggleAlertCategory(c.id))} aria-label={on ? 'Desativar' : 'Ativar'}
              style={{ width: 42, height: 24, borderRadius: 12, background: on ? '#0d6e42' : 'var(--bg-3)', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
