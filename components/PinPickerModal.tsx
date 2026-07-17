'use client'

// PinPickerModal — o "escolher atalhos fixos" extraído do PinnedToolsBar
// (2026-07-17) para poder ser aberto tanto em /inicio como em
// /settings?tab=ferramentas ("personalizado nas definições") sem duplicar a
// grelha de escolha em dois sítios.

import { PIN_MAX } from '@/lib/pinnedTools'
import PinPickerGrid from '@/components/PinPickerGrid'

export default function PinPickerModal({ open, onClose, pins, onToggle }: { open: boolean; onClose: () => void; pins: string[]; onToggle: (path: string) => void }) {
  if (!open) return null
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400 }}>Atalhos fixos</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>Selecionados {pins.length} de {PIN_MAX}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-2)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px 22px' }}>
          <PinPickerGrid pins={pins} onToggle={onToggle} />
        </div>
      </div>
    </div>
  )
}
