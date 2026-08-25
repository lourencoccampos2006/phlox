'use client'

// Logótipo 3D do Phlox — invólucro React para o web component <phlox-logo>
// (lib/phlox-logo/, gerado por código; ver o README que veio no pacote).
//
// DUAS DECISÕES QUE INTERESSAM:
//
// 1. CARREGAMENTO DIFERIDO. O three.js são ~150KB e o rodapé aparece em 14
//    rotas públicas. Só importamos o módulo quando o logótipo está prestes a
//    entrar no ecrã (IntersectionObserver com margem), por isso o arranque das
//    páginas não paga nada por ele.
//
// 2. DEGRADAÇÃO HONESTA. Até o 3D montar — e para sempre, se o WebGL falhar
//    num aparelho antigo ou bloqueado — mostra-se a palavra na serifa da marca,
//    na mesma caixa. Nunca há buraco nem salto de layout.

import { useEffect, useRef, useState } from 'react'

declare global {
  namespace React.JSX {
    interface IntrinsicElements {
      'phlox-logo': React.HTMLAttributes<HTMLElement> & {
        color?: string
        font?: string
        speed?: string
        punch?: string
        'flower-scale'?: string
        env?: string
        static?: string
      }
    }
  }
}

type Props = {
  /** Cor das letras. Fundo claro: var(--ink). Fundo escuro: #f7f8f5 + env="dark". */
  color?: string
  /** 'light' (omissão) ou 'dark' — ajusta os reflexos ao fundo. */
  env?: 'light' | 'dark'
  /** Largura em CSS. A altura sai da proporção 260/108. */
  largura?: number | string
  /** Sem rotação nem florescer, na pose final. */
  estatico?: boolean
  className?: string
}

const PROPORCAO = 260 / 108

export default function PhloxLogo3D({
  color = 'var(--ink)',
  env = 'light',
  largura = 168,
  estatico = false,
  className,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    const el = caixa.current
    if (!el) return

    // Se não houver WebGL não vale a pena descarregar 150KB para falhar.
    try {
      const c = document.createElement('canvas')
      if (!c.getContext('webgl2') && !c.getContext('webgl')) return
    } catch {
      return
    }

    const io = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return
        io.disconnect()
        import('@/lib/phlox-logo/phlox-logo-element.js')
          .then(() => setMontado(true))
          .catch((e) => console.warn('[phlox-logo] não carregou, fica a palavra:', e))
      },
      { rootMargin: '300px' } // começa a carregar um pouco antes de aparecer
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const w = typeof largura === 'number' ? `${largura}px` : largura

  return (
    <div
      ref={caixa}
      className={className}
      role="img"
      aria-label="Phlox"
      style={{ width: w, aspectRatio: String(PROPORCAO), position: 'relative' }}
    >
      {montado ? (
        <phlox-logo
          color={color === 'var(--ink)' ? '#16181d' : color}
          env={env}
          {...(estatico ? { static: '' } : {})}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      ) : (
        // A mesma palavra, na serifa da marca. Ocupa a caixa exata, por isso
        // a troca para o 3D não mexe com nada à volta.
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'var(--font-serif)',
            fontStyle: 'italic',
            fontSize: `calc(${w} * 0.31)`,
            lineHeight: 1,
            letterSpacing: '-0.015em',
            color: color === 'var(--ink)' ? 'var(--ink)' : color,
          }}
        >
          phlox
        </span>
      )}
    </div>
  )
}
