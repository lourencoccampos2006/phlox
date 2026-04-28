'use client'

import Link from 'next/link'
import Header from '@/components/Header'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

// ─── Data ─────────────────────────────────────────────────────────────────────

const AI_SUGGESTIONS = [
  { text: 'Posso tomar brufen com o meu anticoagulante?', category: 'Interações' },
  { text: 'O que significam estes resultados das análises?', category: 'Análises' },
  { text: 'Qual a diferença entre metoprolol e bisoprolol?', category: 'Estudantes' },
  { text: 'Há genérico mais barato para o meu Xarelto?', category: 'Genéricos' },
  { text: 'Que medicamentos se usam para insuficiência cardíaca?', category: 'Estudantes' },
  { text: 'As vacinas da minha filha estão em dia?', category: 'Vacinas' },
]

const TOOLS_BY_USE = [
  {
    category: 'Uso diário',
    color: 'var(--green)',
    items: [
      { href: '/interactions', label: 'Verificar Interações', detail: 'Escreve o nome da caixa' },
      { href: '/labs', label: 'Perceber Análises', detail: 'PDF ou texto' },
      { href: '/prescription', label: 'Explicar Receita', detail: 'Foto ou texto' },
      { href: '/otc', label: 'O que comprar sem receita', detail: 'Para qualquer sintoma' },
      { href: '/generics', label: 'Há genérico mais barato?', detail: 'Verificador de genéricos' },
      { href: '/vaccines', label: 'Vacinas em dia?', detail: 'Calendário e viagens' },
      { href: '/diary', label: 'Diário de sintomas', detail: 'Tracker + análise farmacológica' },
      { href: '/consult-prep', label: 'Preparar consulta', detail: 'Perguntas certas para o médico' },
    ],
  },
  {
    category: 'Estudantes',
    color: '#7c3aed',
    items: [
      { href: '/compare', label: 'Comparar fármacos', detail: 'A vs B — linha a linha' },
      { href: '/disease', label: 'Fármacos por doença', detail: '1ª e 2ª linha + exame' },
      { href: '/shift', label: 'Turno virtual', detail: '3 doentes · score · feedback' },
      { href: '/study', label: 'Flashcards e quizzes', detail: '24 classes farmacológicas' },
      { href: '/exam', label: 'Modo exame', detail: 'Timer + análise de erros' },
      { href: '/cases', label: 'Casos clínicos', detail: 'Raciocínio clínico guiado' },
    ],
  },
  {
    category: 'Profissionais',
    color: '#1d4ed8',
    items: [
      { href: '/nursing', label: 'IV · SC · IM', detail: 'Compatibilidades e prep.' },
      { href: '/strategy', label: 'Estratégias terapêuticas', detail: 'Evidência A/B/C' },
      { href: '/protocol', label: 'Protocolo terapêutico', detail: 'ESC · ADA · NICE · DGS' },
      { href: '/med-review', label: 'Revisão de medicação', detail: 'Análise + PDF' },
      { href: '/calculators', label: 'Calculadoras clínicas', detail: 'CKD-EPI · SCORE2' },
      { href: '/compatibility', label: 'Compatibilidade IV', detail: "Trissel's" },
    ],
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────

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

      {/* ══ HERO — Phlox AI como entrada principal ════════════════════════════ */}
      <section style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '64px 0 56px' }}>
        <div className="page-container">
          <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', marginBottom: 48 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 24, padding: '5px 14px 5px 10px', background: 'var(--green-light)', border: '1px solid var(--green-mid)', borderRadius: 24 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, color: 'var(--green-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', fontWeight: 500 }}>
                Phlox Clinical · Farmacologia em português
              </span>
            </div>

            <h1 className="hero-title" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 20, fontWeight: 400 }}>
              A tua dúvida sobre<br />
              <em style={{ color: 'var(--green)' }}>medicamentos, respondida.</em>
            </h1>

            <p style={{ fontSize: 17, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 36, maxWidth: 520, margin: '0 auto 36px' }}>
              Escreve o que tens em mente. O Phlox AI responde, e encaminha para a ferramenta certa.
            </p>

            {/* AI Search bar — o centro da experiência */}
            <div style={{ background: 'white', border: '2px solid var(--ink)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', maxWidth: 620, margin: '0 auto 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                <div style={{ padding: '0 16px', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                </div>
                <input
                  ref={inputRef}
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAiSubmit()}
                  placeholder="Pergunta qualquer coisa sobre medicamentos..."
                  style={{ flex: 1, padding: '18px 0', fontSize: 15, border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', background: 'transparent', color: 'var(--ink)' }}
                />
                <button onClick={handleAiSubmit}
                  style={{ margin: '6px', padding: '10px 20px', background: aiQuery.trim() ? 'var(--ink)' : 'var(--bg-3)', color: aiQuery.trim() ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: aiQuery.trim() ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', transition: 'all 0.15s', flexShrink: 0 }}>
                  Perguntar
                </button>
              </div>
            </div>

            {/* Suggestion pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
              {AI_SUGGESTIONS.map(s => (
                <button key={s.text}
                  onClick={() => { setAiQuery(s.text); router.push(`/ai?q=${encodeURIComponent(s.text)}`) }}
                  style={{ padding: '6px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', transition: 'all 0.15s', textAlign: 'left' }}
                  className="suggestion-pill">
                  {s.text}
                </button>
              ))}
            </div>
          </div>

          {/* Three paths — below the search */}
          <div className="card-grid-3" style={{ gap: 10, maxWidth: 800, margin: '0 auto' }}>
            {[
              { icon: '👤', title: 'Uso pessoal', sub: 'Percebe a tua medicação ou a de um familiar', href: '/interactions', color: 'var(--green)' },
              { icon: '📚', title: 'Estudo', sub: 'Medicina, farmácia, enfermagem', href: '/compare', color: '#7c3aed' },
              { icon: '🏥', title: 'Clínico', sub: 'Decisão clínica com co-piloto IA', href: '/dashboard?mode=pro', color: '#1d4ed8' },
            ].map(({ title, sub, href, color }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', flexDirection: 'column', padding: '18px 20px', background: 'white', border: '1.5px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s' }}
                className="path-card">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.5, flex: 1, marginBottom: 12 }}>{sub}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Entrar
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PARA QUEM É — section for unauthenticated visitors ═══════════════ */}
      {!user && (
        <section style={{ padding: '52px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
          <div className="page-container">
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 10 }}>Para quem é</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3.5vw, 30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em' }}>
                Escolhe o teu ponto de entrada
              </h2>
            </div>
            <div className="card-grid-4" style={{ gap: 12 }}>
              {[
                {
                  mode: 'professional',
                  icon: '🏥',
                  title: 'Profissional de Saúde',
                  desc: 'Médico, farmacêutico ou enfermeiro. Co-piloto clínico com contexto do doente, protocolos e evidência.',
                  color: '#1d4ed8',
                  bg: '#eff6ff',
                  border: '#bfdbfe',
                  tags: ['Protocolos ESC/ADA', 'Perfil de doente', 'Ajuste de dose'],
                },
                {
                  mode: 'caregiver',
                  icon: '👨‍👩‍👧',
                  title: 'Cuidador',
                  desc: 'Cuidas de um filho, pai ou familiar. Doses pediátricas, tradução de bulas e perfis para cada pessoa.',
                  color: '#d97706',
                  bg: '#fffbeb',
                  border: '#fde68a',
                  tags: ['Dose pediátrica', 'Perfis familiares', 'Tradutor de bula'],
                },
                {
                  mode: 'personal',
                  icon: '👤',
                  title: 'Uso Pessoal',
                  desc: 'Queres perceber a tua medicação, verificar interações ou preparar uma consulta.',
                  color: 'var(--green-2)',
                  bg: 'var(--green-light)',
                  border: 'var(--green-mid)',
                  tags: ['Verificar interações', 'Preparar consulta', 'Perceber análises'],
                },
                {
                  mode: 'student',
                  icon: '📚',
                  title: 'Estudante',
                  desc: 'Medicina, farmácia ou enfermagem. Tutor socrático, casos clínicos e modo exame com feedback.',
                  color: '#7c3aed',
                  bg: '#f5f3ff',
                  border: '#ddd6fe',
                  tags: ['Tutor socrático', 'Casos clínicos', 'Modo exame'],
                },
              ].map(({ mode, icon, title, desc, color, bg, border, tags }) => (
                <Link key={mode} href={`/onboarding?mode=${mode}`}
                  style={{ display: 'flex', flexDirection: 'column', padding: '20px', background: 'white', border: `1.5px solid var(--border)`, borderRadius: 12, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  className="profile-entry-card">
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 14 }}>
                    {icon}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.6, flex: 1, marginBottom: 14 }}>{desc}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color, background: bg, border: `1px solid ${border}`, borderRadius: 3, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.02em' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Começar
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ PHLOX AI — featured section ═════════════════════════════════════ */}
      <section style={{ padding: '56px 0', background: 'var(--ink)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="page-container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 40 }} className="hero-grid">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, padding: '4px 14px', marginBottom: 20 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>Phlox AI</span>
              </div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 4vw, 38px)', color: 'white', fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 18 }}>
                O farmacologista clínico<br />
                <em style={{ color: '#86efac' }}>que nunca fecha o consultório.</em>
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.8, marginBottom: 28, maxWidth: 480 }}>
                Não é um chatbot. É um co-piloto com contexto clínico real — sabe os teus medicamentos, os diagnósticos dos teus doentes, e responde com evidência, não com opiniões.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 36 }}>
                <Link href="/ai" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'white', color: 'var(--ink)', padding: '12px 22px', borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Abrir Phlox AI
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'transparent', color: 'rgba(255,255,255,0.55)', padding: '12px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Ver planos
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Para uso pessoal', desc: 'Percebe a tua medicação, prepara consultas, verifica análises' },
                  { label: 'Para estudantes', desc: 'Tutor socrático — constrói o raciocínio, não dá só respostas' },
                  { label: 'Para profissionais', desc: 'Co-piloto com contexto do doente — responde em função do perfil clínico' },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 3 }}><path d="M20 6L9 17l-5-5"/></svg>
                    <div>
                      <span style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{label}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI demo chat */}
            <div className="hero-card" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>Phlox AI · Online</span>
              </div>
              <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* User message */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: 'white', color: 'var(--ink)', padding: '10px 14px', borderRadius: '12px 12px 3px 12px', maxWidth: '85%', fontSize: 13, lineHeight: 1.5 }}>
                    Posso trocar o meu omeprazol pelo esomeprazol genérico?
                  </div>
                </div>
                {/* AI response */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="12" height="12" viewBox="0 0 28 28" fill="none"><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 14px', borderRadius: '3px 12px 12px 12px', flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
                    Sim, são clinicamente equivalentes para a maioria das indicações — ambos são inibidores da bomba de protões. O esomeprazol é o enantiómero S do omeprazol, com biodisponibilidade ligeiramente superior.
                    <br /><br />
                    O genérico tem de demonstrar bioequivalência para ser aprovado pelo INFARMED. Para DRGE e úlcera péptica, a troca é segura.
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                      → Confirma com o farmacêutico — pode poupar 60-70% no preço
                    </div>
                  </div>
                </div>
                {/* User follow-up */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: 'white', color: 'var(--ink)', padding: '10px 14px', borderRadius: '12px 12px 3px 12px', maxWidth: '85%', fontSize: 13, lineHeight: 1.5 }}>
                    E se tiver Helicobacter pylori?
                  </div>
                </div>
                {/* Try it CTA */}
                <Link href="/ai" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', textDecoration: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'background 0.15s' }}
                  className="ai-cta">
                  Continuar esta conversa →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TODAS AS FERRAMENTAS ══════════════════════════════════════════════ */}
      <section style={{ padding: '56px 0', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)' }}>
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
            {activeGroup.items.map(({ href, label, detail }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', flexDirection: 'column', padding: '16px 18px', background: 'white', textDecoration: 'none' }}
                className="tool-item">
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flex: 1, marginBottom: 10 }}>{detail}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: activeGroup.color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Abrir
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SOCIAL PROOF ══════════════════════════════════════════════════════ */}
      <section style={{ padding: '56px 0', background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="page-container">
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 28, textAlign: 'center' }}>Utilizado por</div>
          <div className="testimonials-grid">
            {[
              { text: 'Tomei sempre brufen com o meu anticoagulante sem saber o risco. O Phlox explicou-me em dois segundos o que o médico nunca teve tempo de me dizer.', role: 'Reformado com FA, 67 anos, Lisboa' },
              { text: 'O turno virtual é ao nível do que acontece no internato. Passei em Farmacologia com 17 depois de uma semana. O comparador de fármacos é o que mais uso.', role: 'Estudante de Medicina, 3.º ano, Coimbra' },
              { text: 'Verifico as compatibilidades IV todos os dias. Antes ligava à farmácia para tudo. Agora resolvo em 10 segundos — e com mais confiança clínica.', role: 'Enfermeira, UCI de Oncologia, Hospital de Santa Maria' },
            ].map(({ text, role }) => (
              <div key={role} style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1,2,3,4,5].map(i => <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>)}</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0, flex: 1 }}>&ldquo;{text}&rdquo;</p>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL ══════════════════════════════════════════════════════════ */}
      <section style={{ padding: '72px 0', background: 'var(--bg-2)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px, 5vw, 40px)', color: 'var(--ink)', marginBottom: 14, letterSpacing: '-0.025em', lineHeight: 1.2, fontWeight: 400 }}>
            Começa por fazer uma pergunta.
          </h2>
          <p style={{ fontSize: 16, color: 'var(--ink-3)', marginBottom: 32, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 32px' }}>
            Grátis, sem registo, em português.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/ai" style={{ background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Perguntar ao Phlox AI
            </Link>
            <Link href="/interactions" style={{ background: 'transparent', color: 'var(--ink)', textDecoration: 'none', padding: '13px 28px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1.5px solid var(--border-2)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Verificar interações
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 0 32px' }}>
        <div className="page-container">
          <div className="footer-grid">
            <div>
              <div style={{ marginBottom: 12 }}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="var(--green)"/><path d="M14 6v16M7 14h14" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: 6 }}>PHLOX CLINICAL</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8, maxWidth: 200 }}>Farmacologia clínica em português. Dados FDA, RxNorm e NIH.</p>
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas</div>
              {[['/ai','Phlox AI'],['/interactions','Interações'],['/labs','Análises'],['/otc','Automedicação'],['/generics','Genéricos'],['/vaccines','Vacinas']].map(([h,l]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 8 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Empresa</div>
              {[['/about','Sobre'],['/pricing','Preços'],['/blog','Blog'],['/api-docs','API'],['/privacy','Privacidade'],['/terms','Termos']].map(([h,l]) => (
                <Link key={h} href={h} style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 8 }}>{l}</Link>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>Contacto</div>
              <a href="mailto:hello@phlox-clinical.com" style={{ display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none', marginBottom: 8 }}>hello@phlox-clinical.com</a>
              <div style={{ marginTop: 20, fontSize: 11, color: 'rgba(255,255,255,0.18)', fontFamily: 'var(--font-mono)', lineHeight: 1.9 }}>OpenFDA · RxNorm · NIH<br />RGPD Compliant · PT-PT</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 22, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.16)', fontFamily: 'var(--font-mono)' }}>© 2026 Phlox Clinical. Informação educacional — não substitui aconselhamento médico.</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        .suggestion-pill:hover { border-color: var(--ink) !important; color: var(--ink) !important; background: white !important; }
        .path-card:hover { border-color: var(--green) !important; }
        .tool-item:hover { background: var(--bg-2) !important; }
        .ai-cta:hover { background: rgba(255,255,255,0.14) !important; }
        .profile-entry-card:hover { border-color: var(--ink) !important; box-shadow: 0 4px 16px rgba(0,0,0,0.06) !important; }
      `}</style>
    </div>
  )
}