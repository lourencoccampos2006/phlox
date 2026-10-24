'use client'

// components/institution/PedirIndicacao.tsx
// ═══════════════════════════════════════════════════════════════════════════
// «POR INDICAÇÃO DE QUEM?» — a pergunta que faltava a cada mudança de medicação
// ═══════════════════════════════════════════════════════════════════════════
//
// Uma mudança de dose sem quem a mandou fazer é uma mudança que ninguém
// consegue explicar daqui a um mês. O médico de família não usa o Phlox, por
// isso o nome escreve-se — e vem preenchido com o da última vez, porque quase
// sempre é o mesmo. Na maior parte das vezes isto é um toque em «Gravar».
//
// Não bloqueia: quem não souber deixa em branco, e o histórico diz «indicação
// não registada», que também é informação.
//
//   const indicacao = usePedirIndicacao()
//   const i = await indicacao.pedir('Alterar Metformina', sugestao)
//   if (!i) return            // cancelado — nada se grava
//   … e no JSX: {indicacao.elemento}

import { useState, useCallback, useRef, useMemo, type ReactNode, type CSSProperties } from 'react'
import { Folha, Botao, ROTULO } from '@/components/ui/mesa'
import { TIPOS_DE_INDICACAO, type Indicacao, type TipoDeIndicacao } from '@/lib/mapaTerapeutico'

const CAMPO: CSSProperties = {
  width: '100%', boxSizing: 'border-box', minHeight: 'var(--tap-min)', padding: '10px 12px',
  borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
  fontFamily: 'inherit', fontSize: 'var(--t-corpo)', background: 'var(--bg)', color: 'var(--ink)',
}

export function usePedirIndicacao(): {
  pedir: (titulo: string, sugestao?: Indicacao | null) => Promise<Indicacao | null>
  elemento: ReactNode
} {
  const [titulo, setTitulo] = useState<string | null>(null)
  const [de, setDe] = useState('')
  const [tipo, setTipo] = useState<TipoDeIndicacao>('medico_familia')
  const [nota, setNota] = useState('')
  const resolver = useRef<((i: Indicacao | null) => void) | null>(null)

  const pedir = useCallback((t: string, sugestao?: Indicacao | null) => new Promise<Indicacao | null>(res => {
    // Um pedido anterior sem resposta não pode ficar pendurado para sempre.
    resolver.current?.(null)
    resolver.current = res
    setDe(sugestao?.de || '')
    setTipo(sugestao?.tipo || 'medico_familia')
    setNota('')
    setTitulo(t)
  }), [])

  const fechar = useCallback((i: Indicacao | null) => {
    resolver.current?.(i)
    resolver.current = null
    setTitulo(null)
  }, [])

  const elemento = useMemo(() => titulo === null ? null : (
    <Folha titulo={titulo} aoFechar={() => fechar(null)}>
      <div style={{ padding: 16, display: 'grid', gap: 14 }}>
        <div>
          <label htmlFor="indicacao-de" style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>
            Por indicação de
          </label>
          <input id="indicacao-de" value={de} onChange={e => setDe(e.target.value)} autoFocus
            placeholder="Quem prescreveu ou mandou mudar" style={CAMPO} />
        </div>

        <div>
          <span style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>De onde veio</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TIPOS_DE_INDICACAO.map(t => {
              const on = tipo === t.id
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => setTipo(t.id)} style={{
                  minHeight: 'var(--tap-min)', padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--green)' : 'var(--border)'}`,
                  background: on ? 'var(--green-light)' : 'var(--bg)',
                  color: on ? 'var(--green)' : 'var(--ink-2)',
                  fontFamily: 'inherit', fontSize: 'var(--t-dado)',
                }}>{t.rotulo}</button>
              )
            })}
          </div>
        </div>

        <div>
          <label htmlFor="indicacao-nota" style={{ ...ROTULO, display: 'block', marginBottom: 6 }}>
            Nota (opcional)
          </label>
          <input id="indicacao-nota" value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ex.: consulta de 3 de março, carta de alta" style={CAMPO} />
        </div>

        <p style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-4)', margin: 0, lineHeight: 1.5 }}>
          Fica no histórico desta medicação, com o seu nome e a hora. Se não souber, deixe em branco.
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Botao onClick={() => fechar(null)}>CANCELAR</Botao>
          <Botao feitio="principal" onClick={() => fechar({ de, tipo, nota })}>GRAVAR</Botao>
        </div>
      </div>
    </Folha>
  ), [titulo, de, tipo, nota, fechar])

  /* Memorizado: um objeto novo a cada render, usado como dependência por quem
     o chama, punha a página em ciclo — ver scripts/check-hooks-estaveis. */
  return useMemo(() => ({ pedir, elemento }), [pedir, elemento])
}
