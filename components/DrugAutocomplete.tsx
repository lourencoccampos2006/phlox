'use client'

// DrugAutocomplete — input com sugestões de fármacos (DCI + marcas PT).
// 2026-06-01: criado para acabar com a inconsistência de só /mymeds ter o
// autocomplete bom. Agora qualquer ferramenta que peça nome de fármaco
// usa este componente.
//
// Uso:
//   <DrugAutocomplete value={x} onChange={setX} onPick={(dci) => ...} />
//
// O onPick é opcional — dispara quando o utilizador escolhe uma sugestão.
// onChange dispara em cada keystroke.

import { useState, useRef, useEffect } from 'react'
import { suggestDrugs, resolveDrugName } from '@/lib/drugNames'

interface Props {
  value: string
  onChange: (v: string) => void
  onPick?: (dci: string, displayed: string) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
  minChars?: number
  maxSuggestions?: number
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
  /** classNames para o input — útil quando integrado em forms existentes. */
  className?: string
  /** id do input (para labels) */
  id?: string
  /** Texto helper abaixo do input quando há sugestões. */
  helper?: string
}

export default function DrugAutocomplete({
  value, onChange, onPick, placeholder = 'Nome do medicamento (DCI ou marca)…',
  autoFocus, disabled, minChars = 2, maxSuggestions = 6, style, inputStyle, className, id, helper,
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  const trimmed = value.trim()
  const suggestions = trimmed.length >= minChars
    ? suggestDrugs(trimmed, maxSuggestions)
    : []
  const showList = open && suggestions.length > 0

  function pick(s: { display: string; dci: string }) {
    onChange(s.display)
    onPick?.(s.dci, s.display)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(suggestions.length - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && suggestions[active]) { e.preventDefault(); pick(suggestions[active]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  // Estilo default do input — caller pode sobrepor com inputStyle
  const defaultInput: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid var(--border)', borderRadius: 10,
    padding: '11px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none',
    background: 'white',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', ...style }}>
      <input
        id={id}
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        className={className}
        style={{ ...defaultInput, ...inputStyle }}
      />
      {showList && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 60,
          background: 'white', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 12px 28px rgba(0,0,0,0.12)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={`${s.display}-${i}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(s) }}
              onMouseEnter={() => setActive(i)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '9px 12px', background: i === active ? 'var(--bg-2)' : 'white',
                border: 'none', borderBottom: i < suggestions.length - 1 ? '1px solid var(--bg-3)' : 'none',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.display}
              </span>
              {s.isBrand && (
                <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  → {s.dci}
                </span>
              )}
            </button>
          ))}
          {helper && (
            <div style={{ fontSize: 10.5, color: 'var(--ink-5)', padding: '7px 12px', background: 'var(--bg-2)', borderTop: '1px solid var(--bg-3)' }}>
              {helper}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Re-exporta resolveDrugName para conveniência das páginas que o usam após onPick.
export { resolveDrugName }
