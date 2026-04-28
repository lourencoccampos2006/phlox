'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

const AI_SUGGESTIONS = [
  { text: 'Posso tomar brufen com o meu anticoagulante?' },
  { text: 'O que significam estes resultados das análises?' },
  { text: 'Qual a dose de paracetamol para uma criança de 12kg?' },
  { text: 'Há genérico mais barato para o Xarelto?' },
  { text: 'Que medicamentos se usam para insuficiência cardíaca?' },
]

const FREE_TOOLS = [
  {
    href: '/interactions',
    badge: 'Grátis · Sem conta',
    title: 'Verificar Interações',
    description: 'Escreve o nome de dois ou mais medicamentos. Analisamos o risco, explicamos o mecanismo e dizemos o que fazer.',
    exampleInput: 'Brufen 400mg + Xarelto 20mg',
    exampleOutput: 'Risco hemorrágico aumentado. IBP recomendado.',
    severity: 'high',
    accentColor: '#0d6e42',
    accentBg: '#d1fae5',
    accentBorder: '#a7f3d0',
  },
  {
    href: '/bula',
    badge: 'Grátis · Sem conta',
    title: 'Tradutor de Bula',
    description: 'Cola o texto técnico de qualquer bula ou escreve o nome do medicamento — traduzimos para linguagem simples.',
    exampleInput: '"inibidor da recaptação de serotonina-noradrenalina"',
    exampleOutput: 'Antidepressivo que aumenta dois mensageiros no cérebro',
    severity: 'info',
    accentColor: '#1d4ed8',
    accentBg: '#dbeafe',
    accentBorder: '#bfdbfe',
  },
  {
    href: '/dose-crianca',
    badge: 'Grátis · Sem conta',
    title: 'Dose Pediátrica',
    description: 'Peso da criança + medicamento = dose exacta com alertas de segurança. Para pais, cuidadores e profissionais.',
    exampleInput: 'Amoxicilina · criança de 15kg',
    exampleOutput: '250mg a cada 8h · máx 3000mg/dia · com alimentos',
    severity: 'ok',
    accentColor: '#d97706',
    accentBg: '#fffbeb',
    accentBorder: '#fde68a',
  },
]

const TOOLS_BY_USE = [
  {
    category: 'Uso diário',
    color: 'var(--green)',
    items: [
      { href: '/interactions', label: 'Verificar Interações', detail: 'Escreve os nomes das caixas', badge: 'Grátis' },
      { href: '/bula', label: 'Tradutor de Bula', detail: 'Cola o texto ou escreve o nome', badge: 'Grátis' },
      { href: '/dose-crianca', label: 'Dose Pediátrica', detail: 'Dose por kg com alertas', badge: 'Grátis' },
      { href: '/prescription', label: 'Perceber a Receita', detail: 'Foto ou texto → explicação' },
      { href: '/labs', label: 'Perceber as Análises', detail: 'PDF ou texto' },
      { href: '/otc', label: 'Automedicação', detail: 'Sintoma → o que comprar' },
      { href: '/generics', label: 'Genéricos', detail: 'Há alternativa mais barata?' },
      { href: '/vaccines', label: 'Vacinas', detail: 'Calendário PT · viagens' },
      { href: '/diary', label: 'Diário de Sintomas', detail: 'Tracker + análise' },
      { href: '/consult-prep', label: 'Preparar Consulta', detail: 'Perguntas certas para o médico' },
    ],
  },
  {
    category: 'Família',
    color: '#b45309',
    items: [
      { href: '/perfis', label: 'Perfis Familiares', detail: 'Medicação de cada familiar' },
      { href: '/ai', label: 'Phlox AI', detail: 'Consulta sobre qualquer perfil' },
      { href: '/quickcheck', label: 'Análise Rápida', detail: 'Lista completa → risco em segundos' },
      { href: '/drugs', label: 'Base de Dados', detail: '10.000+ medicamentos' },
      { href: '/monograph', label: 'Monografia', detail: 'Qualquer fármaco, completo' },
      { href: '/mymeds', label: 'A Minha Medicação', detail: 'Perfil pessoal e interações' },
    ],
  },
  {
    category: 'Estudantes',
    color: '#7c3aed',
    items: [
      { href: '/compare', label: 'Comparar Fármacos', detail: 'A vs B — linha a linha' },
      { href: '/disease', label: 'Fármacos por Doença', detail: '1ª e 2ª linha + exame' },
      { href: '/shift', label: 'Turno Virtual', detail: '3 doentes · score · feedback' },
      { href: '/study', label: 'Flashcards e Quizzes', detail: '24 classes farmacológicas' },
      { href: '/exam', label: 'Modo Exame', detail: 'Timer + análise de erros' },
      { href: '/cases', label: 'Casos Clínicos', detail: 'Raciocínio clínico guiado' },
    ],
  },
  {
    category: 'Clínico',
    color: '#1d4ed8',
    items: [
      { href: '/strategy', label: 'Estratégias Terapêuticas', detail: 'Evidência A/B/C' },
      { href: '/protocol', label: 'Protocolo Terapêutico', detail: 'ESC · ADA · NICE · DGS' },
      { href: '/med-review', label: 'Revisão de Medicação', detail: 'Análise + PDF' },
      { href: '/nursing', label: 'IV · SC · IM', detail: 'Compatibilidades e prep.' },
      { href: '/calculators', label: 'Calculadoras Clínicas', detail: 'CKD-EPI · SCORE2' },
      { href: '/compatibility', label: 'Compatibilidade IV', detail: "Trissel's" },
    ],
  },
]

const WHO_CARDS = [
  {
    mode: 'professional', icon: '🏥', title: 'Profissional de Saúde',
    desc: 'Co-piloto clínico com contexto do doente, protocolos ESC/ADA/DGS e ajuste de dose em tempo real.',
    color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe',
    tags: ['Protocolos ESC/ADA', 'Perfil de doente', 'Ajuste de dose'],
  },
  {
    mode: 'caregiver', icon: '👨‍👩‍👧', title: 'Cuidador Familiar',
    desc: 'Cuidas de um filho, pai ou familiar. Doses pediátricas, bulas em português e perfis para cada pessoa.',
    color: '#d97706', bg: '#fffbeb', border: '#fde68a',
    tags: ['Dose pediátrica', 'Perfis familiares', 'Tradutor de bula'],
  },
  {
    mode: 'personal', icon: '👤', title: 'Uso Pessoal',
    desc: 'Percebe a tua medicação, verifica interações e prepara consultas com as perguntas certas.',
    color: 'var(--green-2)', bg: 'var(--green-light)', border: 'var(--green-mid)',
    tags: ['Verificar interações', 'Preparar consulta', 'Perceber análises'],
  },
  {
    mode: 'student', icon: '📚', title: 'Estudante',
    desc: 'Medicina, farmácia ou enfermagem. Tutor socrático, casos clínicos e modo exame com feedback.',
    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe',
    tags: ['Tutor socrático', 'Casos clínicos', 'Modo exame'],
  },
]

export default function HomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [aiQuery, setAiQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('Uso diário')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleAiSubmit = () => {
    if (!aiQuery.trim()) return
    router.push(`/ai?q=${encodeURIComponent(aiQuery.trim())}`)
  }

  const activeGroup = TOOLS_BY_USE.find(g => g.category === activeCategory) || TOOLS_BY_USE[0]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '72px 0 64px' }}>
        <div className="page-container">
          <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 28, padding: '5px 14px 5px 10px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 500 }}>
                Phlox Clinical · Farmacologia em português
              </span>
            </div>
            <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 22, fontWeight: 400, letterSpacing: '-0.02em' }}>
              A tua dúvida sobre<br />
              <em style={{ color: 'var(--green)' }}>medicamentos, respondida.</em>
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
              Para doentes, cuidadores, estudantes e profissionais. Em português, com evidência científica.
            </p>
            <div style={{ background: 'white', border: '2px solid var(--ink)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.1)', maxWidth: 640, margin: '0 auto 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ padding: '0 16px', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <input ref={inputRef} value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSubmit()}
                  placeholder="Faz uma pergunta sobre medicamentos..."
                  style={{ flex: 1, padding: '20px 0', fontSize: 15, border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', background: 'transparent', color: 'var(--ink)' }}
                />
                <button onClick={handleAiSubmit}
                  style={{ margin: '7px', padding: '11px 22px', background: aiQuery.trim() ? 'var(--ink)' : 'var(--bg-3)', color: aiQuery.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: aiQuery.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.15s', flexShrink: 0 }}>
                  Perguntar
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {AI_SUGGESTIONS.map(s => (
                <button key={s.text}
                  onClick={() => { setAiQuery(s.text); router.push(`/ai?q=${encodeURIComponent(s.text)}`) }}
                  style={{ padding: '7px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', textAlign: 'left' }}
                  className="suggestion-pill">
                  {s.text}
                </button>
              ))}
            </div>
          </div>

          <div className="card-grid-3" style={{ gap: 10, maxWidth: 820, margin: '0 auto' }}>
            {[
              { icon: '👤', title: 'Para mim e a minha família', sub: 'Percebe medicação, verifica interações, perfis familiares', href: '/interactions', color: 'var(--green)' },
              { icon: '📚', title: 'Para estudar', sub: 'Medicina, farmácia, enfermagem — tutor + exames', href: '/study', color: '#7c3aed' },
              { icon: '🏥', title: 'Para profissionais', sub: 'Co-piloto clínico com contexto real de doente', href: '/dashboard', color: '#1d4ed8' },
            ].map(({ icon, title, sub, href, color }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                className="path-card">
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, marginBottom: 10 }}>{sub}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Entrar <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FREE TOOLS ════════════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '5px 14px', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 24 }}>
              <span style={{ fontSize: 10, color: '#065f46', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' }}>Sem conta · Sem subscrição</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 38px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 14 }}>
              Três ferramentas que podes usar<br />
              <em style={{ color: 'var(--green)' }}>agora mesmo, de graça</em>
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-3)', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
              Sem criar conta, sem cartão. Só abres, usas e tens a resposta.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 }}>
            {FREE_TOOLS.map(({ href, badge, title, description, exampleInput, exampleOutput, severity, accentColor, accentBg, accentBorder }) => (
              <div key={href}
                style={{ background: 'white', border: '1.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                className="free-tool-card">
                <div style={{ height: 4, background: accentColor }} />
                <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ display: 'inline-block', marginBottom: 14, fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: accentColor, background: accentBg, border: `1px solid ${accentBorder}`, borderRadius: 4, padding: '3px 9px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {badge}
                  </span>
                  <h3 style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 10, lineHeight: 1.2 }}>{title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 20, flex: 1 }}>{description}</p>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px', marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontSize: 9, color: 'var(--ink-4)', marginBottom: 8, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Exemplo</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>{exampleInput}</div>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, flexShrink: 0, borderRadius: 3, padding: '2px 6px', letterSpacing: '0.04em', textTransform: 'uppercase',
                        color: severity === 'high' ? '#dc2626' : severity === 'ok' ? '#0d6e42' : '#1d4ed8',
                        background: severity === 'high' ? '#fee2e2' : severity === 'ok' ? '#d1fae5' : '#dbeafe',
                        border: `1px solid ${severity === 'high' ? '#fca5a5' : severity === 'ok' ? '#a7f3d0' : '#bfdbfe'}`,
                      }}>
                        {severity === 'high' ? 'Risco' : severity === 'ok' ? 'Seguro' : 'Info'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>{exampleOutput}</span>
                    </div>
                  </div>
                  <Link href={href}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px', background: accentColor, color: 'white', textDecoration: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'opacity 0.15s' }}
                    className="tool-cta">
                    Abrir ferramenta
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PROFILES TEASER ═══════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="two-col">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 24, padding: '4px 14px', marginBottom: 20 }}>
                <span style={{ fontSize: 10, color: '#92400e', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', fontWeight: 700, textTransform: 'uppercase' }}>Perfis & Família</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3.5vw, 34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 18 }}>
                Uma conta para<br />
                <em style={{ color: '#b45309' }}>gerir toda a família</em>
              </h2>
              <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 32, maxWidth: 420 }}>
                Cria um perfil para cada familiar com a sua medicação, alergias e histórico clínico.
                Em qualquer ferramenta, seleciona a pessoa — a IA responde sobre esse doente específico.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
                {[
                  { step: '01', title: 'Cria os perfis', desc: 'Nome, medicação, alergias, condições. Leva 2 minutos.' },
                  { step: '02', title: 'Seleciona em qualquer ferramenta', desc: 'Barra de perfil aparece em todas as ferramentas Phlox.' },
                  { step: '03', title: 'Respostas personalizadas', desc: 'O Phlox AI responde com o contexto clínico completo daquele doente.' },
                ].map(({ step, title, desc }) => (
                  <div key={step} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#d97706', flexShrink: 0 }}>{step}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={user ? '/perfis' : '/login'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#d97706', color: 'white', padding: '13px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {user ? 'Ver os meus perfis' : 'Criar perfis grátis'}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/ai"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'var(--ink-3)', padding: '13px 24px', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1.5px solid var(--border-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Ver o Phlox AI
                </Link>
              </div>
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }} className="profile-preview">
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Perfis da família · 3 pessoas</span>
              </div>
              <div style={{ padding: '16px' }}>
                {[
                  { name: 'Maria (mãe)', age: '67 anos', meds: 4, conditions: 'HTA, Diabetes', active: false, color: '#1d4ed8', bg: '#dbeafe' },
                  { name: 'João (pai)', age: '70 anos', meds: 6, conditions: 'ICC, FA', active: true, color: '#d97706', bg: '#fffbeb' },
                  { name: 'Sofia (filha)', age: '8 anos', meds: 0, conditions: 'Asma leve', active: false, color: '#7c3aed', bg: '#ede9fe' },
                ].map(({ name, age, meds, conditions, active, color, bg }) => (
                  <div key={name} style={{ padding: '14px', marginBottom: 10, background: active ? bg : 'white', border: `1.5px solid ${active ? color : 'var(--border)'}`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color, flexShrink: 0 }}>
                      {name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{name}</span>
                        {active && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color, background: 'white', border: `1px solid ${color}66`, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ativo</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{age} · {conditions}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: meds > 0 ? color : 'var(--ink-4)' }}>{meds}</div>
                      <div style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>meds</div>
                    </div>
                  </div>
                ))}
                <Link href="/ai"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 16px', background: '#d97706', color: 'white', borderRadius: 9, textDecoration: 'none', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', justifyContent: 'center', marginTop: 4 }}>
                  Consultar Phlox AI sobre o João →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ PHLOX AI ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'var(--ink)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }} className="two-col">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '4px 14px', marginBottom: 22 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>Phlox AI · Online</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 40px)', color: 'white', fontWeight: 400, letterSpacing: '-0.025em', lineHeight: 1.2, marginBottom: 18 }}>
                O farmacologista clínico<br />
                <em style={{ color: '#86efac' }}>que nunca fecha o consultório.</em>
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.85, marginBottom: 32, maxWidth: 460 }}>
                Não é um chatbot. É um co-piloto com contexto clínico real —
                sabe a medicação do teu doente, os diagnósticos, e responde com evidência, não com opiniões.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 36 }}>
                {[
                  { label: 'Uso pessoal', desc: 'Percebe a tua medicação, prepara consultas, verifica análises' },
                  { label: 'Cuidadores', desc: 'Respostas adaptadas ao perfil clínico de cada familiar' },
                  { label: 'Estudantes', desc: 'Tutor socrático — constrói o raciocínio, não dá só respostas' },
                  { label: 'Profissionais', desc: 'Co-piloto com protocolos internacionais e contexto do doente' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M20 6L9 17l-5-5"/></svg>
                    <div>
                      <span style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginLeft: 8 }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/ai" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'white', color: 'var(--ink)', padding: '13px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Abrir Phlox AI
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'rgba(255,255,255,0.55)', padding: '13px 24px', borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Ver planos
                </Link>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>Phlox AI</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, background: '#fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#92400e' }}>J</div>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#92400e' }}>João (pai)</span>
                </div>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: 'white', color: 'var(--ink)', padding: '10px 14px', borderRadius: '12px 12px 3px 12px', maxWidth: '85%', fontSize: 13, lineHeight: 1.6 }}>
                    O médico receitou-lhe Entresto. É seguro com o bisoprolol?
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 28 28" fill="none"><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 14px', borderRadius: '3px 12px 12px 12px', flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9, padding: '4px 8px', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 5, width: 'fit-content' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0d6e42" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#065f46', letterSpacing: '0.04em' }}>COMPATÍVEL · COMBINAÇÃO RECOMENDADA ESC 2023</span>
                    </div>
                    Sim, Entresto + bisoprolol é a base da terapêutica actual para ICC com FE reduzida — as guidelines ESC 2023 e AHA recomendam esta combinação.
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font-mono)' }}>
                      ⚠ Com a FA do João: monitorizar FC e PA na 1.ª semana
                    </div>
                  </div>
                </div>
                <Link href="/ai"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', textDecoration: 'none', borderRadius: 9, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  className="ai-cta">
                  Continuar esta conversa no Phlox AI →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ ALL TOOLS ════════════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Todas as ferramentas</div>
              <h2 className="section-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', fontWeight: 400 }}>O que precisas?</h2>
            </div>
            <div style={{ display: 'flex', gap: 0, background: 'var(--border)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
              {TOOLS_BY_USE.map(group => (
                <button key={group.category} onClick={() => setActiveCategory(group.category)}
                  style={{ padding: '8px 16px', background: activeCategory === group.category ? 'white' : 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: activeCategory === group.category ? 'var(--ink)' : 'var(--ink-4)', fontFamily: 'var(--font-sans)', letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
                  {group.category}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {activeGroup.items.map(({ href, label, detail, badge }: { href: string; label: string; detail: string; badge?: string }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', flexDirection: 'column', padding: '16px 18px', background: 'white', textDecoration: 'none' }}
                className="tool-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  {badge && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{badge}</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flex: 1, marginBottom: 10 }}>{detail}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: activeGroup.color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Abrir <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PARA QUEM (visitors only) ══════════════════════════════════════════ */}
      {!user && (
        <section style={{ padding: '72px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container">
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12 }}>Para quem é</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3.5vw, 32px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                Escolhe o teu ponto de entrada
              </h2>
            </div>
            <div className="card-grid-4" style={{ gap: 14 }}>
              {WHO_CARDS.map(({ mode, icon, title, desc, color, bg, border, tags }) => (
                <Link key={mode} href={`/onboarding?mode=${mode}`}
                  style={{ display: 'flex', flexDirection: 'column', padding: '22px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 14, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  className="profile-entry-card">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>{icon}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 7 }}>{title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.65, flex: 1, marginBottom: 16 }}>{desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, background: bg, border: `1px solid ${border}`, borderRadius: 3, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.02em' }}>{tag}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Começar <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ SOCIAL PROOF ══════════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 36, textAlign: 'center' }}>O que dizem os utilizadores</div>
          <div className="testimonials-grid">
            {[
              { text: 'Tomei sempre brufen com o meu anticoagulante sem saber o risco. O Phlox explicou-me em dois segundos o que o médico nunca teve tempo de me dizer.', role: 'Reformado com FA, 67 anos, Lisboa' },
              { text: 'O turno virtual é ao nível do que acontece no internato. Passei em Farmacologia com 17 depois de uma semana. O comparador de fármacos é o que mais uso.', role: 'Estudante de Medicina, 3.º ano, Coimbra' },
              { text: 'Verifico as compatibilidades IV todos os dias. Antes ligava à farmácia para tudo. Agora resolvo em 10 segundos — e com mais confiança clínica.', role: 'Enfermeira, UCI de Oncologia, Hospital de Santa Maria' },
            ].map(({ text, role }) => (
              <div key={role} style={{ padding: '26px', border: '1px solid var(--border)', borderRadius: 14, background: 'white', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(i => <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.85, margin: 0, flex: 1 }}>&ldquo;{text}&rdquo;</p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 14, borderTop: '1px solid var(--border)' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '88px 0', background: 'var(--ink)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '4px 14px', marginBottom: 24 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>Phlox Clinical · Online</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 5vw, 44px)', color: 'white', marginBottom: 16, letterSpacing: '-0.025em', lineHeight: 1.15, fontWeight: 400 }}>
            Começa por fazer<br />
            <em style={{ color: '#86efac' }}>uma pergunta.</em>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 40, lineHeight: 1.7, maxWidth: 380, margin: '0 auto 40px' }}>
            Grátis, em português, sem registo.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/ai"
              style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '15px 32px', borderRadius: 9, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}
              className="cta-primary">
              Perguntar ao Phlox AI
            </Link>
            <Link href="/interactions"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', padding: '15px 32px', borderRadius: 9, fontSize: 13, fontWeight: 600, border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}
              className="cta-secondary">
              Verificar interações grátis
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '52px 0 36px' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ marginBottom: 14 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 8 }}>PHLOX CLINICAL</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.85, maxWidth: 200 }}>Farmacologia clínica em português. Dados FDA, RxNorm e NIH.</p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Ferramentas</div>
              {[['/ai','Phlox AI'],['/interactions','Verificar Interações'],['/bula','Tradutor de Bula'],['/dose-crianca','Dose Pediátrica'],['/labs','Análises'],['/perfis','Perfis Familiares']].map(([h,l]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Empresa</div>
              {[['/about','Sobre'],['/pricing','Preços'],['/blog','Blog'],['/api-docs','API'],['/privacy','Privacidade'],['/terms','Termos']].map(([h,l]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 9 }}>hello@phlox-clinical.com</a>
              <div style={{ marginTop: 22, fontSize: 11, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono)', lineHeight: 2 }}>OpenFDA · RxNorm · NIH<br />RGPD Compliant · PT-PT</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento médico.</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        .suggestion-pill:hover { border-color: var(--ink) !important; color: var(--ink) !important; background: white !important; }
        .path-card:hover { border-color: var(--green) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important; }
        .tool-item:hover { background: var(--bg-2) !important; }
        .ai-cta:hover { background: rgba(255,255,255,0.14) !important; }
        .profile-entry-card:hover { border-color: var(--ink) !important; box-shadow: 0 6px 20px rgba(0,0,0,0.08) !important; }
        .free-tool-card:hover { border-color: var(--ink-4) !important; box-shadow: 0 8px 28px rgba(0,0,0,0.1) !important; }
        .tool-cta:hover { opacity: 0.88 !important; }
        .cta-primary:hover { opacity: 0.9 !important; }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.4) !important; color: rgba(255,255,255,0.8) !important; }
        @media (max-width: 768px) {
          .two-col { grid-template-columns: 1fr !important; gap: 36px !important; }
          .profile-preview { display: none !important; }
        }
      `}</style>
    </div>
  )
}
