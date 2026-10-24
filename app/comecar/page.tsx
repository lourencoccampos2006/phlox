'use client'

// /comecar — Ajuda para um momento. Não é a cara do Phlox: é uma porta de
// entrada calma para quem chega num momento difícil (alta do hospital, novo
// diagnóstico, cuidar de alguém que adoeceu). Monta os primeiros passos com
// ferramentas que já existem. Quem só quer usar o Phlox no dia-a-dia ignora isto.

import { useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'

const ACCENT = 'var(--green)'

interface Step { label: string; desc: string; href: string }
interface Situation {
  id: string
  emoji: string
  title: string
  intro: string
  steps: Step[]
}

const SITUATIONS: Situation[] = [
  {
    id: 'alta',
    emoji: 'building',
    title: 'Tive (ou alguém teve) alta do hospital',
    intro: 'A alta vem com papéis, medicação nova e muita coisa para reter de uma vez. Vamos por partes — não tens de fazer tudo agora.',
    steps: [
      { label: 'Organizar a medicação nova', desc: 'Cria a lista, com horários e lembretes.', href: '/mymeds' },
      { label: 'Ver o histórico', desc: 'Junta tudo para não te esqueceres na consulta de seguimento.', href: '/timeline' },
    ],
  },
  {
    id: 'diagnostico',
    emoji: 'stethoscope',
    title: 'Recebi um diagnóstico novo',
    intro: 'Um diagnóstico novo traz perguntas e termos que ninguém explicou bem. O Phlox ajuda-te a perceber e a acompanhar, ao teu ritmo.',
    steps: [
      { label: 'Perceber a medicação que começaste', desc: 'O que é, para que serve, em português simples.', href: '/scan' },
      { label: 'Começar a tua história de saúde', desc: 'Tudo num sítio, pronto a mostrar ao médico.', href: '/timeline' },
      { label: 'Tirar dúvidas quando surgirem', desc: 'Pergunta o que quiseres, quando quiseres.', href: '/relatorio?tab=bolso' },
    ],
  },
  {
    id: 'cuidar',
    emoji: 'user',
    title: 'Estou a cuidar de alguém que adoeceu',
    intro: 'Cuidar de um pai, mãe ou familiar é muita responsabilidade e pouca informação organizada. Vamos pôr tudo num sítio que não se perde.',
    steps: [
      { label: 'Criar o perfil da pessoa', desc: 'Um espaço só para a saúde de quem cuidas.', href: '/familia' },
      { label: 'Foto da receita ou das caixas', desc: 'O Phlox organiza a medicação dela toda.', href: '/scan' },
      { label: 'Saber quando agir', desc: 'O Phlox avisa o que merece atenção.', href: '/relatorio?tab=bolso' },
    ],
  },
]

export default function ComecarPage() {
  const [open, setOpen] = useState<string | null>(null)
  const sit = SITUATIONS.find(s => s.id === open) || null

  return (
    <main style={{ padding: '24px clamp(14px,4vw,32px) 60px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontFamily: 'var(--font-mono,monospace)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-5)' }}>Ajuda para um momento</div>
      <h1 style={{ margin: '4px 0 8px', fontSize: 'clamp(24px,4.5vw,34px)', fontFamily: 'var(--font-serif,serif)', fontWeight: 500, lineHeight: 1.1 }}>O que te traz aqui?</h1>
      <p style={{ color: 'var(--ink-4)', fontSize: 15, lineHeight: 1.6, marginBottom: 24, maxWidth: '52ch' }}>
        Se estás a passar por um momento difícil, escolhe-o em baixo e o Phlox monta-te os primeiros passos. Sem pressa — podes parar e voltar quando quiseres.
      </p>

      {!sit && (
        <div style={{ display: 'grid', gap: 12 }}>
          {SITUATIONS.map(s => (
            <button key={s.id} onClick={() => setOpen(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)',
              padding: '18px 18px', cursor: 'pointer', width: '100%',
            }}>
              <Icon name={s.emoji} size={28} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 16.5, fontWeight: 700, color: 'var(--ink-2)' }}>{s.title}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
            </button>
          ))}
          <p style={{ fontSize: 13, color: 'var(--ink-5)', textAlign: 'center', marginTop: 8 }}>
            Não é nenhum destes? <Link href="/inicio" style={{ color: ACCENT, fontWeight: 600 }}>Ir para o início →</Link>
          </p>
        </div>
      )}

      {sit && (
        <div>
          <button onClick={() => setOpen(null)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', fontSize: 13, cursor: 'pointer', marginBottom: 14, padding: 0 }}>← Outra situação</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Icon name={sit.emoji} size={28} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-2)', margin: 0 }}>{sit.title}</h2>
          </div>
          <p style={{ color: 'var(--ink-4)', fontSize: 14.5, lineHeight: 1.6, marginBottom: 20 }}>{sit.intro}</p>

          <div style={{ display: 'grid', gap: 10 }}>
            {sit.steps.map((step, i) => (
              <Link key={step.href} href={step.href} style={{
                display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
                background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '14px 16px',
              }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>{step.label}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-5)', marginTop: 2 }}>{step.desc}</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--border-2)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-5)', lineHeight: 1.55, marginTop: 20 }}>
            O Phlox ajuda a organizar e a perceber — não substitui o teu médico. Em emergência, liga 112.
          </p>
        </div>
      )}
    </main>
  )
}
