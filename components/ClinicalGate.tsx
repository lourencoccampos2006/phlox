'use client'

// ClinicalGate — o que se mostra a quem AINDA não tem acesso a uma ferramenta
// institucional.
//
// A distinção que importa: uma instituição NOVA (modo clínico, ainda sem
// organização criada) não deve levar com um argumentário de vendas — deve ser
// levada a criar a instituição, que é o que lhe desbloqueia tudo. Só a quem não
// é institucional é que faz sentido mostrar os planos.
//
// (O acesso institucional vem da PERTENÇA à organização: ver effectivePlan em
//  components/AuthContext.tsx e getUserPlan em lib/planGate.ts.)
//
// ── O EMOJI DE 40px SAIU (2026-10-13) ──────────────────────────────────────
// Cada chamador passava um emoji (💊, 📊, 🗓️, 🧑‍🤝‍🧑) e isto desenhava-o a 40px
// no topo. Três problemas de uma vez, e o terceiro é o que decidiu:
//
//   · o produto já tirou o emoji de toda a interface a favor do conjunto de
//     linha do `components/Icon.tsx` — este era dos últimos sítios;
//   · a 40px, um emoji é desenhado pelo sistema operativo, por isso este ecrã
//     tinha um aspeto diferente no Windows, no Android e no iPhone;
//   · o `🧑‍🤝‍🧑` é três pontos de código colados por ZWJ. Onde a fonte não tem
//     o grupo, sai como duas pessoas e um aperto de mão separados — e esta é
//     a primeira coisa que alguém vê da aplicação.
//
// Quem já passava um emoji continua a poder passá-lo e nada se parte; é
// ignorado. O `nome` é o ícone de linha, e sem ele não se desenha nada —
// um ecrã com três linhas de texto fica bem sem decoração nenhuma.

import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'

export default function ClinicalGate({
  icone, title, description, accent = 'var(--green)',
}: {
  /** O ícone de linha (components/Icon.tsx). Sem ele, não se desenha nada. */
  icone?: string
  /** Nome da ferramenta, para quem não é institucional. Ex.: "Medicação a dar". */
  title: string
  /** O que a ferramenta faz, para quem não é institucional. */
  description: string
  accent?: string
  /** @deprecated Era o emoji de 40px. Ignorado — ver a nota no topo. */
  emoji?: string
}) {
  const { user } = useAuth() as any
  const needsOrg = user?.experience_mode === 'clinical'
  const nome = needsOrg ? 'building' : icone

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '44px 26px', textAlign: 'center', maxWidth: 480, margin: '0 20px' }}>
        {nome && (
          <div style={{ marginBottom: 16, color: accent, display: 'flex', justifyContent: 'center' }}>
            <Icon name={nome} size={30} />
          </div>
        )}
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--t-destaque)', color: 'var(--ink)', marginBottom: 12 }}>
          {needsOrg ? 'Falta criar a sua instituição' : title}
        </div>
        <p style={{ fontSize: 'var(--t-corpo)', color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
          {needsOrg
            ? 'Crie a instituição — leva dois minutos e monta o painel, a equipa e as ferramentas do seu tipo de instituição.'
            : description}
        </p>
        <Link href={needsOrg ? '/comecar-instituicao' : '/pricing'}
          className="mesa-botao"
          style={{ display: 'inline-flex', alignItems: 'center', background: accent, color: 'white', textDecoration: 'none', padding: '0 28px', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any }}>
          {needsOrg ? 'Criar a minha instituição →' : 'Ver planos →'}
        </Link>
      </div>
    </div>
  )
}
