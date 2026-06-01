'use client'

// SaveButton — botão único e consistente para guardar qualquer coisa.
// Aparece em todas as ferramentas. Lê o estado atual do que está a ser produzido
// e guarda no sistema central (lib/saves). Mostra "Guardado ✓" durante 1.5s.

import { useEffect, useState, useCallback } from 'react'
import { save, getAllSaves, remove, SAVES_EVENT, type NewSave, type SavedKind } from '@/lib/saves'
import { useToast } from '@/components/Toast'

interface Props<T> extends NewSave<T> {
  // tonalidade dominante para combinar com a ferramenta (default: verde Phlox)
  color?: string
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Detecta se já existe um item igual (mesmo kind + título) guardado — para
 * permitir desguardar com o mesmo botão.
 */
function useIsSaved(kind: SavedKind, title: string) {
  const [hit, setHit] = useState<string | null>(null)
  const refresh = useCallback(() => {
    const found = getAllSaves().find(s => s.kind === kind && s.title === title)
    setHit(found?.id || null)
  }, [kind, title])
  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(SAVES_EVENT, onChange)
    return () => window.removeEventListener(SAVES_EVENT, onChange)
  }, [refresh])
  return hit
}

export default function SaveButton<T = any>(props: Props<T>) {
  const { color = '#0d6e42', size = 'md', className } = props
  const savedId = useIsSaved(props.kind, props.title)
  const toast = useToast()

  function onClick() {
    if (savedId) {
      remove(savedId)
      toast.info('Removido dos Guardados')
    } else {
      save({ kind: props.kind, title: props.title, preview: props.preview, data: props.data, href: props.href, tags: props.tags })
      toast.success('Guardado', 'Acede em Guardados.')
    }
  }

  const isSaved = !!savedId
  const padding = size === 'sm' ? '6px 10px' : '8px 14px'
  const font = size === 'sm' ? 12 : 13

  return (
    <button onClick={onClick} className={className} aria-pressed={isSaved}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding, borderRadius: 8,
        background: isSaved ? color : 'white',
        color: isSaved ? 'white' : color,
        border: `1.5px solid ${color}${isSaved ? '' : '55'}`,
        fontSize: font, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
      }}>
      <span aria-hidden style={{ fontSize: font + 1 }}>{isSaved ? '★' : '☆'}</span>
      {isSaved ? 'Guardado' : 'Guardar'}
    </button>
  )
}
