'use client'

// components/FusionTabs.tsx
// ─────────────────────────────────────────────────────────────────────────────
// A MOLDURA DAS FERRAMENTAS FUNDIDAS — refeita (2026-10-07).
//
// ── O QUE ESTAVA ERRADO ────────────────────────────────────────────────────
// Tinha 160px de cabeçalho antes de aparecer trabalho: uma migalha em mono,
// um título em serifa de 32px, uma frase de explicação, e só depois os
// separadores — cada um com um emoji à frente (📐 📋 📅 🧪).
//
// Quem abre a /agenda cinquenta vezes por dia não precisa de ler «As marcações
// do dia e o plano de rastreios e vacinas, num só sítio» cinquenta vezes.
// Precisa dos separadores e da agenda. O nome da página já está na barra
// lateral, destacado, enquanto se está nela.
//
// É exactamente a mesma correcção que o `RegistoDoDia` levou: uma tira fina,
// da altura de um separador, e nada mais. Com uma aba só, nem isso.
//
// ── E O FUNDO DEIXOU DE SER DECIDIDO AQUI ──────────────────────────────────
// Pintava `var(--bg-2)` ou `var(--bg-2)` conforme o tom do blueprint — duas cores
// escritas à mão que não existem nos tokens, por baixo de páginas que já
// pintam o seu próprio `--chao`. Duas camadas de fundo quase iguais, com a
// de cima a ganhar: o valor nunca se via, e mesmo assim tinha de ser mantido.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Icon from '@/components/Icon'

export interface FusionTab {
  id: string
  label: string
  /** O nome de um ícone do `components/Icon`, não um emoji. */
  icon: string
  render: () => React.ReactNode
}

export default function FusionTabs({ tabs }: {
  /** Mantidos na assinatura porque as páginas os passam, e são o que um
   *  leitor de ecrã anuncia ao chegar — ver o `aria-label` em baixo. */
  eyebrow?: string
  title?: string
  subtitle?: string
  tabs: FusionTab[]
}) {
  const sp = useSearchParams()
  const requested = sp?.get('tab')
  const [tab, setTab] = useState<string>(
    requested && tabs.some(t => t.id === requested) ? requested : tabs[0]?.id)
  const active = tabs.find(t => t.id === tab) || tabs[0]

  return (
    <div style={{ background: 'var(--chao)', minHeight: '100vh', overflowX: 'hidden' }}>
      {/* Com uma aba só não há escolha a fazer — e uma tira de separadores com
          um separador é uma linha de nada a ocupar espaço. */}
      {tabs.length > 1 && (
        <div role="tablist" style={{
          display: 'flex', gap: 2, alignItems: 'stretch', flexWrap: 'wrap',
          background: 'var(--bg)', borderBottom: '1px solid var(--border)',
          padding: '0 clamp(10px, 1.2vw, 16px)',
        }}>
          {tabs.map(t => {
            const on = tab === t.id
            return (
              <button key={t.id} role="tab" aria-selected={on} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, height: 38, padding: '0 14px',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${on ? 'var(--green)' : 'transparent'}`, marginBottom: -1,
                fontFamily: 'var(--font-mono)', fontSize: 'var(--t-meta)', letterSpacing: '.08em',
                textTransform: 'uppercase',
                fontWeight: (on ? 'var(--peso-forte)' : 'var(--peso-corpo)') as any,
                color: on ? 'var(--green)' : 'var(--ink-4)',
              }}>
                <Icon name={t.icon} size={14} color={on ? 'var(--green)' : 'var(--ink-4)'} />
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      <div>{active?.render()}</div>
    </div>
  )
}
