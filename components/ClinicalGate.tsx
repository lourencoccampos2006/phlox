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

import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

export default function ClinicalGate({
  emoji, title, description, accent = '#0d6e42',
}: {
  emoji: string
  /** Nome da ferramenta, para quem não é institucional. Ex.: "Medicação a dar". */
  title: string
  /** O que a ferramenta faz, para quem não é institucional. */
  description: string
  accent?: string
}) {
  const { user } = useAuth() as any
  const needsOrg = user?.experience_mode === 'clinical'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '44px 26px', textAlign: 'center', maxWidth: 480, margin: '0 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>{needsOrg ? '🏛️' : emoji}</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 12 }}>
          {needsOrg ? 'Falta criar a sua instituição' : title}
        </div>
        <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7, marginBottom: 24 }}>
          {needsOrg
            ? 'Crie a instituição — leva dois minutos e monta o painel, a equipa e as ferramentas do seu tipo de instituição.'
            : description}
        </p>
        <Link href={needsOrg ? '/comecar-instituicao' : '/pricing'}
          style={{ display: 'inline-block', background: accent, color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 9, fontSize: 14, fontWeight: 700 }}>
          {needsOrg ? 'Criar a minha instituição →' : 'Ver planos →'}
        </Link>
      </div>
    </div>
  )
}
