'use client'

// components/EscolherFerramentas.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Escolher o que aparece no /inicio.
//
// Substitui o antigo "liga/desliga de secções", que mudava a FORMA da página.
// Aqui a forma é fixa — uma ação e uma lista — e só se escolhe o que está na
// lista. Configurar não pode transformar a página noutra coisa.
//
// A lista de escolha vem do catálogo real (lib/toolRegistry), agrupada por
// assunto. Era essa a queixa: o /inicio mostrava quatro e o catálogo tem onze.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { escolhiveis, getEscolha, alternar, MAXIMO, MINIMO } from '@/lib/inicioEscolha'
import { TOOL_CATEGORIES, PLAN_BADGE } from '@/lib/toolRegistry'

export default function EscolherFerramentas({ modo, principal }: { modo: string; principal: string }) {
  const [escolhidas, setEscolhidas] = useState<string[] | null>(null)
  useEffect(() => { setEscolhidas(getEscolha(modo)) }, [modo])

  if (escolhidas === null) return <div className="skeleton" style={{ height: 160, borderRadius: 10 }} />

  const opcoes = escolhiveis(modo, principal)
  const porCategoria = new Map<string, typeof opcoes>()
  for (const o of opcoes) {
    if (!porCategoria.has(o.category)) porCategoria.set(o.category, [])
    porCategoria.get(o.category)!.push(o)
  }

  const noMinimo = escolhidas.length <= MINIMO
  const noMaximo = escolhidas.length >= MAXIMO

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.6, marginBottom: 14, maxWidth: '60ch' }}>
        Estas aparecem no início, por baixo da ação principal, pela ordem em que
        as escolher. <strong style={{ color: 'var(--ink-3)' }}>{escolhidas.length} de {MAXIMO}</strong>.
        {noMaximo && ' Para juntar outra, tire uma primeiro.'}
        {noMinimo && ` O mínimo é ${MINIMO} — o início não pode ficar vazio.`}
      </div>

      {[...porCategoria.entries()].map(([cat, lista]) => {
        const meta = TOOL_CATEGORIES[cat]
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: 'var(--ink-5)', marginBottom: 8,
            }}>{meta?.label || cat}</div>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 1,
              background: 'var(--border)', border: '1px solid var(--border)',
              borderRadius: 9, overflow: 'hidden',
            }}>
              {lista.map(o => {
                const on = escolhidas.includes(o.id)
                const bloqueado = (!on && noMaximo) || (on && noMinimo)
                const selo = PLAN_BADGE[o.plan]
                return (
                  <label key={o.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    background: 'white', cursor: bloqueado ? 'default' : 'pointer',
                    opacity: bloqueado ? 0.5 : 1,
                  }}>
                    <input
                      type="checkbox" checked={on} disabled={bloqueado}
                      onChange={() => setEscolhidas(alternar(modo, o.id))}
                      style={{ width: 17, height: 17, marginTop: 2, flexShrink: 0, cursor: bloqueado ? 'default' : 'pointer' }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--ink)' }}>{o.label}</span>
                        {selo && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 700, color: selo.color, background: selo.bg,
                            padding: '1.5px 6px', borderRadius: 4, textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}>{selo.label}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 2 }}>{o.desc}</div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
