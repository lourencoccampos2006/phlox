'use client'

// PinPickerGrid — a grelha de escolha de atalhos fixos, sem chrome nenhum à
// volta (nem modal nem título) para poder ser usada tanto dentro de um modal
// (PinPickerModal, em /inicio) como diretamente numa página (/settings —
// "personalizado nas definições", item pedido pelo Fernando 2026-07-17).

import { PINNABLE_TOOLS, PIN_MAX } from '@/lib/pinnedTools'
import Icon from '@/components/Icon'

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
                    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 'var(--r-lg)',
                    border: `1.5px solid ${checked ? 'var(--green)' : 'var(--border)'}`,
                    background: checked ? 'var(--badge-green-bg)' : 'white',
                    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
                    fontFamily: 'var(--font-sans)', textAlign: 'left',
                  }}>
                  <Icon name={t.icon} size={16} />
                  <span style={{ fontSize: 12.5, color: checked ? 'var(--green)' : 'var(--ink-2)', fontWeight: checked ? 700 : 500, flex: 1 }}>{t.label}</span>
                  {checked && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
