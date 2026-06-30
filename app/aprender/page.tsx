'use client'

// /aprender — Hub central de todas as ferramentas de estudo.
// Agora VIVO: barra de progresso partilhada (streak/XP/meta), "continuar onde
// ficaste" e sugestão das áreas mais fracas. Cada clique regista a ferramenta.

import Link from 'next/link'
import StudyProgressBar from '@/components/StudyProgressBar'
import { summarize, setLastTool } from '@/lib/studyProgress'
import { useEffect, useState } from 'react'

interface Tool {
  href: string
  title: string
  desc: string
  icon: string
  badge?: string
}

interface Section {
  label: string
  color: string
  tools: Tool[]
}

const SECTIONS: Section[] = [
  {
    label: 'Praticar',
    color: '#7c3aed',
    tools: [
      { href: '/study?mode=quiz',       title: 'Quiz',                 desc: 'Banco de questões IA por domínio', icon: '❓', badge: 'IA' },
      { href: '/study?mode=flashcards', title: 'Flashcards',           desc: 'SRS com geração automática',       icon: '🃏', badge: 'IA' },
      { href: '/simulador',             title: 'Casos clínicos',       desc: 'Caso · turno · evolutivo — 3 modos', icon: '🩺', badge: 'IA' },
      { href: '/osce',                  title: 'Treinar OSCE',         desc: 'IA como doente, com feedback real',  icon: '🎯' },
      { href: '/exam',                  title: 'Simulação de exame',   desc: 'Exame cronometrado, formato real',   icon: '📝' },
      { href: '/study/ecg',             title: 'ECG library',          desc: 'Treina interpretação com IA',       icon: '💓', badge: 'novo' },
      { href: '/arena',                 title: 'Arena',                desc: 'Liga competitiva por especialidade', icon: '🏆' },
    ],
  },
  {
    label: 'Aprender',
    color: '#1d4ed8',
    tools: [
      { href: '/tutor',              title: 'Tutor IA',             desc: 'Explica conceitos · mnemónicas · passo a passo', icon: '🧠', badge: 'IA' },
      { href: '/study/professor',    title: 'Modo Professor',       desc: 'Ensina o Phlox → descobre as tuas lacunas', icon: '🎓', badge: 'novo' },
      { href: '/study/notas',        title: 'Notas que te fazem rever', desc: 'Flashcards + resumos + revisão espaçada · foto/voz', icon: '📝' },
      { href: '/study/documentos',   title: 'Os meus documentos',   desc: 'Carrega sebentas → pergunta e gera estudo', icon: '📚' },
      { href: '/anatomia-3d',        title: 'Anatomia 3D',          desc: 'Modelos interativos',                 icon: '🦴' },
    ],
  },
  {
    label: 'Ferramentas clínicas',
    color: '#dc2626',
    tools: [
      { href: '/study/lab',           title: 'Lab interpreter',     desc: 'Valores ref. + interpretação IA',  icon: '🧪', badge: 'novo' },
      { href: '/study/procedimentos', title: 'Procedimentos',       desc: 'Guias passo-a-passo com checklist', icon: '✅', badge: 'novo' },
      { href: '/interactions',        title: 'Verificar interações', desc: 'Drug-drug + foto OCR',             icon: '💊' },
      { href: '/calculos',            title: 'Calculadoras clínicas', desc: 'Doses, eGFR/CrCl, scores, pediatria', icon: '🧮' },
      { href: '/medicamento',         title: 'O que é este medicamento?', desc: 'Para que serve, receita e cuidados', icon: '💡' },
    ],
  },
  {
    label: 'Estágio',
    color: '#b45309',
    tools: [
      { href: '/estagio', title: 'Gestão de estágio', desc: 'Doentes, diário, objectivos, casos, IA', icon: '🎓', badge: 'novo' },
    ],
  },
  {
    label: 'Planear',
    color: '#0d6e42',
    tools: [
      { href: '/modo-exame',      title: 'Plano de exame',      desc: 'Plano de estudo com contagem até ao exame', icon: '🗂️', badge: 'novo' },
      { href: '/study360',        title: 'Estudo 360°',         desc: 'Revisão espaçada · progresso · Pomodoro', icon: '⏱️' },
      { href: '/calendario',      title: 'Calendário',          desc: 'Eventos e prazos',                    icon: '🗓️' },
      { href: '/guardados',       title: 'Guardados',           desc: 'Os teus favoritos',                  icon: '★' },
    ],
  },
  {
    label: 'Comunidade',
    color: '#0891b2',
    tools: [
      { href: '/connect',     title: 'Phlox Connect', desc: 'Rede de profissionais e estudantes', icon: '🤝' },
      { href: '/grand-round', title: 'Grand Round',   desc: 'Casos reais em debate com a comunidade', icon: '👥' },
    ],
  },
]

// Mapa área-fraca → ferramenta de prática para a melhorar.
const PRACTICE_FOR_AREA = '/study?mode=quiz'

export default function AprenderHub() {
  const [weak, setWeak] = useState<{ area: string; accuracy: number }[]>([])
  useEffect(() => { setWeak(summarize().weakAreas) }, [])

  return (
    <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 1300, margin: '0 auto' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Aprender</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 15 }}>
          Todas as ferramentas de estudo e treino clínico, com o teu progresso. Para a sessão diária de revisão, vai a <Link href="/study360" style={{ color: '#7c3aed', fontWeight: 700 }}>Estudar</Link>.
        </p>
      </header>

      {/* Progresso partilhado: streak, XP, meta diária, continuar */}
      <StudyProgressBar />

      {/* Casa do estudo — a sessão de revisão espaçada (study360) */}
      <Link href="/study360" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
        <div style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', borderRadius: 14, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🧠</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: 'white' }}>Estudar — a tua sessão de hoje</span>
            <span style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>Revisão espaçada, plano, foco e estatísticas — tudo num só sítio.</span>
          </span>
          <span style={{ color: 'white', fontWeight: 800, flexShrink: 0 }}>→</span>
        </div>
      </Link>

      {/* Áreas a reforçar (vindas do desempenho real em quiz/casos/flashcards) */}
      {weak.length > 0 && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: '14px 16px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#9a3412', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            🎯 Onde reforçar
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {weak.map(w => (
              <Link key={w.area} href={`${PRACTICE_FOR_AREA}&area=${encodeURIComponent(w.area)}`}
                onClick={() => setLastTool(PRACTICE_FOR_AREA, `Praticar ${w.area}`)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'white', border: '1px solid #fed7aa', borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#9a3412', textDecoration: 'none' }}>
                {w.area} <span style={{ fontSize: 11, color: '#c2410c', fontWeight: 800 }}>{w.accuracy}%</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {SECTIONS.map(section => (
        <section key={section.label} style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 4, height: 20, background: section.color, borderRadius: 2 }} />
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section.label}
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {section.tools.map(t => (
              <Link key={t.href} href={t.href} onClick={() => setLastTool(t.href, t.title)} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: 12,
                  padding: 14, transition: 'border-color 0.12s, transform 0.12s',
                  height: '100%', cursor: 'pointer', position: 'relative',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = section.color; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'none' }}
                >
                  {t.badge && (
                    <span style={{
                      position: 'absolute', top: 10, right: 10,
                      padding: '2px 8px', borderRadius: 999,
                      background: t.badge === 'novo' ? '#dcfce7' : '#ede9fe',
                      color: t.badge === 'novo' ? '#065f46' : '#6d28d9',
                      fontSize: 10, fontWeight: 700,
                    }}>{t.badge}</span>
                  )}
                  <div style={{ fontSize: 26, marginBottom: 10 }}>{t.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{t.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
