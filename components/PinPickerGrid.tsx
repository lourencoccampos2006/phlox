'use client'

// PinPickerGrid — a grelha de escolha de atalhos fixos, sem chrome nenhum à
// volta (nem modal nem título) para poder ser usada tanto dentro de um modal
// (PinPickerModal, em /inicio) como diretamente numa página (/settings —
// "personalizado nas definições", item pedido pelo Fernando 2026-07-17).

import { PINNABLE_TOOLS, PIN_MAX } from '@/lib/pinnedTools'

export default function PinPickerGrid({ pins, onToggle }: { pins: string[]; onToggle: (path: string) => void }) {
  return (
    <>
      {Array.from(new Set(PINNABLE_TOOLS.map(t => t.group))).map(group => (
        <div key={group} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{group}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 6 }}>
            {PINNABLE_TOOLS.filter(t => t.group === group).map(t => {
              const checked = pins.includes(t.path)
              const disabled = !checked && pins.length >= PIN_MAX
              return (
                <button key={t.path} onClick={() => !disabled && onToggle(t.path)} disabled={disabled}
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
    </>
  )
}
