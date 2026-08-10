'use client'

// WidgetPickerModal — escolher que widgets aparecem em /inicio (pessoal/
// cuidador). Mesma folha de estilo do PinPickerModal, mas por cima de
// WidgetToggleList (lib/homeWidgets.ts) em vez do sistema de pins genérico.

import WidgetToggleList from '@/components/WidgetToggleList'

export default function WidgetPickerModal({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: string }) {
  if (!open) return null
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400 }}>Widgets do início</div>
            <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>Escolha o que quer ver — a disposição fica sempre organizada</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-2)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--ink-4)' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px 22px' }}>
          <WidgetToggleList mode={mode} />
        </div>
      </div>
    </div>
  )
}
