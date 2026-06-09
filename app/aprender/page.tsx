'use client'

// /aprender — Hub central de todas as ferramentas de estudo.

import Link from 'next/link'

const ACCENT = '#0d6e42'

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
      { href: '/decisao',               title: 'Casos clínicos',       desc: '54 casos dinâmicos com IA',         icon: '🩺', badge: 'IA' },
      { href: '/study/ecg',             title: 'ECG library',          desc: 'Treina interpretação com IA',       icon: '💓', badge: 'novo' },
      { href: '/arena',                 title: 'Arena',                desc: 'Liga competitiva por especialidade', icon: '🏆' },
    ],
  },
  {
    label: 'Aprender',
    color: '#1d4ed8',
    tools: [
      { href: '/tutor',              title: 'Tutor IA socrático',   desc: 'Sessão dialógica em qualquer tema', icon: '🧠', badge: 'IA' },
      { href: '/study/professor',    title: 'Modo Professor',       desc: 'Ensina o Phlox → descobre as tuas lacunas', icon: '🎓', badge: 'novo' },
      { href: '/study/notas',        title: 'Notas que te fazem rever', desc: 'Flashcards automáticos + revisão espaçada · foto/voz', icon: '📝', badge: 'novo' },
      { href: '/study/documentos',   title: 'Os meus documentos',   desc: 'Pergunta às tuas sebentas e slides (IA)', icon: '📚', badge: 'Pro' },
      { href: '/study/resumos',      title: 'Resumos IA',           desc: 'Em 6 formatos · adaptado ao nível',  icon: '📑' },
      { href: '/study/biblioteca',   title: 'Biblioteca médica',    desc: 'Guidelines, protocolos, summaries',   icon: '📚' },
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
      { href: '/calculators/renal-dose', title: 'Calculadoras',     desc: 'Doses, GFR, scores',                 icon: '🧮' },
      { href: '/bula',                title: 'Bulas',                desc: 'Pesquisa rápida INFARMED',           icon: '💊' },
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
      { href: '/modo-exame',      title: 'Modo Exame',          desc: 'Plano de contagem decrescente até ao exame', icon: '🎯', badge: 'novo' },
      { href: '/study/exame',     title: 'Gerador de exame',    desc: 'Prevê o exame das tuas sebentas · perguntas de escrever', icon: '📝', badge: 'novo' },
      { href: '/study/plano',     title: 'Plano de estudo IA',  desc: 'Schedule semanal gerado por IA',     icon: '📅' },
      { href: '/study360',        title: 'SRS + Pomodoro',      desc: 'Revisão espaçada + timer',           icon: '⏱️' },
      { href: '/calendario',      title: 'Calendário',          desc: 'Eventos e prazos',                    icon: '🗓️' },
      { href: '/guardados',       title: 'Guardados',           desc: 'Os teus favoritos',                  icon: '★' },
    ],
  },
  {
    label: 'Comunidade',
    color: '#0891b2',
    tools: [
      { href: '/connect',  title: 'Phlox Connect', desc: 'Rede de profissionais e estudantes', icon: '🤝' },
      { href: '/cases',    title: 'Casos partilhados', desc: 'Banco de casos da comunidade',     icon: '👥' },
    ],
  },
]

export default function AprenderHub() {
  return (
    <main style={{ padding: '24px clamp(16px, 4vw, 32px)', maxWidth: 1300, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Aprender</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 15 }}>
          Ferramentas integradas de estudo, treino clínico e progressão profissional. Tudo num só sítio, suportado por IA.
        </p>
      </header>

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
              <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
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
