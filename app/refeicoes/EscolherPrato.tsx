'use client'

// app/refeicoes/EscolherPrato.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Escolher um prato numa biblioteca de cem.
//
// Era um <select> nativo: para pôr "Bacalhau à Braz" numa quarta-feira havia
// que percorrer uma lista de cem nomes por ordem alfabética, vinte e oito vezes
// por semana. Escrever "baca" e carregar Enter é outra coisa.
//
// Escreve-se para filtrar, setas para andar, Enter para escolher, Esc para
// fechar. Ordena pelos pratos do momento certo primeiro (uma sopa aparece
// antes num lugar de sopa), e mostra alergénios e textura na própria linha —
// que é o que faz alguém trocar de prato à última hora.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from 'react'

export interface PratoEscolhivel {
  id: string
  name: string
  course?: string | null
  allergens?: string[] | null
  texture?: string | null
  diet_tags?: string[] | null
  category?: string | null
}

const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 500,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-5)',
}

/** Sem acentos e em minúsculas, para "acorda" encontrar "Açorda". */
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function EscolherPrato({ pratos, valor, momento, aoEscolher, destaque, compacto }: {
  pratos: PratoEscolhivel[]
  valor: string
  /** o momento deste lugar: sopa, prato ou sobremesa */
  momento: string
  aoEscolher: (id: string) => void
  destaque?: boolean
  compacto?: boolean
}) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  const escolhido = pratos.find(p => p.id === valor) || null

  const lista = useMemo(() => {
    const t = norm(q.trim())
    const filtrados = t
      ? pratos.filter(p => norm(p.name).includes(t) || norm(p.category || '').includes(t) || (p.diet_tags || []).some(d => norm(d).includes(t)))
      : pratos
    // Do momento certo primeiro; dentro disso, por nome.
    return [...filtrados].sort((a, b) => {
      const ca = (a.course || 'prato') === momento ? 0 : 1
      const cb = (b.course || 'prato') === momento ? 0 : 1
      return ca - cb || a.name.localeCompare(b.name)
    }).slice(0, 60)
  }, [pratos, q, momento])

  useEffect(() => { setI(0) }, [q])
  useEffect(() => { if (aberto) setTimeout(() => campo.current?.focus(), 10) }, [aberto])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => { if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  function escolher(id: string) { aoEscolher(id); setAberto(false); setQ('') }

  return (
    <div ref={caixa} style={{ position: 'relative' }}>
      <button
        onClick={() => setAberto(a => !a)}
        title={escolhido?.name || 'Escolher prato'}
        style={{
          width: '100%', minHeight: compacto ? 32 : 36, textAlign: 'left',
          border: `1px solid ${destaque ? '#ddd6fe' : 'var(--border)'}`,
          borderRadius: 7, padding: '5px 8px', background: 'var(--bg)',
          fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
          color: escolhido ? (destaque ? '#7c3aed' : 'var(--ink)') : 'var(--ink-5)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
        {escolhido ? escolhido.name : '—'}
      </button>

      {aberto && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 40, marginTop: 4,
          width: 'max(260px, 100%)', background: 'var(--bg)',
          border: '1px solid var(--border-2)', borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.14)', overflow: 'hidden',
        }}>
          <input
            ref={campo} value={q} onChange={e => setQ(e.target.value)}
            placeholder={`Escrever para procurar entre ${pratos.length}…`}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI(v => Math.min(v + 1, lista.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setI(v => Math.max(v - 1, 0)) }
              else if (e.key === 'Enter') { e.preventDefault(); if (lista[i]) escolher(lista[i].id) }
              else if (e.key === 'Escape') { e.preventDefault(); setAberto(false) }
            }}
            style={{
              width: '100%', boxSizing: 'border-box', border: 'none',
              borderBottom: '1px solid var(--border)', padding: '10px 12px',
              fontSize: 13, fontFamily: 'inherit', outline: 'none', background: 'var(--bg)', color: 'var(--ink)',
            }} />

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {valor && (
              <Linha onClick={() => escolher('')} activo={false}>
                <span style={{ color: 'var(--ink-5)', fontStyle: 'italic' }}>Deixar vazio</span>
              </Linha>
            )}
            {!lista.length && (
              <div style={{ padding: '14px 12px', fontSize: 12.5, color: 'var(--ink-4)' }}>
                Nada com “{q}”. Podes escrever o prato à mão na biblioteca.
              </div>
            )}
            {lista.map((p, k) => {
              const doMomento = (p.course || 'prato') === momento
              return (
                <Linha key={p.id} onClick={() => escolher(p.id)} activo={k === i} onHover={() => setI(k)}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{
                      display: 'block', fontSize: 13, color: 'var(--ink)',
                      fontWeight: p.id === valor ? 700 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{p.name}</span>
                    <span style={{ ...MONO, display: 'block', marginTop: 2 }}>
                      {!doMomento && <span style={{ color: '#b45309' }}>{p.course || 'prato'} · </span>}
                      {p.category || ''}
                      {p.texture && p.texture !== 'Normal' ? `${p.category ? ' · ' : ''}${p.texture}` : ''}
                      {(p.allergens || []).length ? ` · alergénios: ${(p.allergens || []).join(', ')}` : ''}
                    </span>
                  </span>
                </Linha>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Linha({ children, onClick, activo, onHover }: {
  children: React.ReactNode; onClick: () => void; activo: boolean; onHover?: () => void
}) {
  return (
    <button onClick={onClick} onMouseEnter={onHover} style={{
      display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center',
      padding: '8px 12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      background: activo ? 'var(--bg-2)' : 'transparent', minWidth: 0,
    }}>{children}</button>
  )
}
