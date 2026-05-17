'use client'

import { useState } from 'react'
import Link from 'next/link'
import Header from '@/components/Header'

// ─── Tool data ────────────────────────────────────────────────────────────────

interface Tool {
  href: string
  label: string
  desc: string
  icon: string
  plan: 'free' | 'student' | 'pro' | 'clinic'
  badge?: string
  category: string
}

interface Category {
  id: string
  heading: string
  color: string
  tools: Tool[]
}

const CATEGORIES: Category[] = [
  {
    id: 'seguranca',
    heading: 'Segurança',
    color: '#dc2626',
    tools: [
      { href: '/interactions', label: 'Verificar Interações', desc: 'Analisa qualquer combinação de medicamentos', icon: '🔍', plan: 'free', badge: 'Grátis', category: 'Segurança' },
      { href: '/food-drug', label: 'Fármaco-Alimento', desc: 'Toranja, álcool, laticínios, vitamina K', icon: '🍊', plan: 'free', badge: 'Grátis', category: 'Segurança' },
      { href: '/dose-crianca', label: 'Dose Pediátrica', desc: 'Calcula a dose correta por peso e medicamento', icon: '👶', plan: 'free', badge: 'Grátis', category: 'Segurança' },
      { href: '/adr-report', label: 'Notificar RAM', desc: 'WHO-UMC · MedDRA · INFARMED', icon: '⚠️', plan: 'student', badge: 'Novo', category: 'Segurança' },
    ],
  },
  {
    id: 'minha-saude',
    heading: 'A Minha Saúde',
    color: '#0d6e42',
    tools: [
      { href: '/mymeds', label: 'Medicamentos', desc: 'Lista completa com lembretes e verificação automática', icon: '💊', plan: 'free', category: 'A Minha Saúde' },
      { href: '/vitals', label: 'Sinais Vitais', desc: 'TA · FC · SpO₂ · peso · tendências', icon: '📊', plan: 'free', badge: 'Novo', category: 'A Minha Saúde' },
      { href: '/objetivos', label: 'Objetivos de Saúde', desc: 'Define metas e acompanha o progresso', icon: '🎯', plan: 'free', badge: 'Novo', category: 'A Minha Saúde' },
      { href: '/relatorio', label: 'Relatório Semanal', desc: 'IA analisa a tua semana e dá recomendações', icon: '📋', plan: 'student', badge: 'Novo', category: 'A Minha Saúde' },
      { href: '/diary', label: 'Diário de Saúde', desc: 'Registo de sintomas e bem-estar diário', icon: '📝', plan: 'student', category: 'A Minha Saúde' },
      { href: '/adherencia', label: 'Adesão à Medicação', desc: 'Padrões de toma e insights pessoais', icon: '✅', plan: 'student', category: 'A Minha Saúde' },
    ],
  },
  {
    id: 'ia-analise',
    heading: 'IA & Análise',
    color: '#7c3aed',
    tools: [
      { href: '/ai', label: 'Phlox AI', desc: 'Co-piloto farmacológico com contexto clínico', icon: '🤖', plan: 'free', category: 'IA & Análise' },
      { href: '/oracle', label: 'Oracle — Farmacêutico AI', desc: 'Consulta estruturada com plano de intervenção', icon: '🔮', plan: 'student', badge: 'Novo', category: 'IA & Análise' },
      { href: '/schedule', label: 'Horário Inteligente', desc: 'IA cria o horário perfeito para a tua medicação', icon: '⏰', plan: 'student', badge: 'Novo', category: 'IA & Análise' },
      { href: '/optimizer', label: 'Otimizar Prescrição', desc: 'Genéricos mais baratos · STOPP/START · segurança', icon: '⚡', plan: 'student', badge: 'Novo', category: 'IA & Análise' },
      { href: '/bula', label: 'Tradutor de Bula', desc: 'Texto técnico em linguagem simples e clara', icon: '📖', plan: 'free', badge: 'Grátis', category: 'IA & Análise' },
      { href: '/labs', label: 'Perceber as Análises', desc: 'O que está fora do normal e o que fazer', icon: '🧬', plan: 'student', category: 'IA & Análise' },
    ],
  },
  {
    id: 'documentos',
    heading: 'Documentos',
    color: '#374151',
    tools: [
      { href: '/passport', label: 'Passaporte de Saúde', desc: 'Cartão de emergência com QR code e PDF', icon: '🪪', plan: 'free', badge: 'Novo', category: 'Documentos' },
      { href: '/link', label: 'Phlox Link', desc: 'Partilha dados com médico ou farmacêutico', icon: '🔗', plan: 'free', badge: 'Novo', category: 'Documentos' },
      { href: '/prescription', label: 'Perceber a Receita', desc: 'Foto ou texto → explicação clara', icon: '📄', plan: 'student', category: 'Documentos' },
      { href: '/vaccines', label: 'Vacinas em Dia?', desc: 'Calendário PT · viagens · recomendações', icon: '💉', plan: 'student', category: 'Documentos' },
      { href: '/integracoes', label: 'Importar Dados', desc: 'Apple Saúde · Garmin · Fitbit · MySNS', icon: '📥', plan: 'student', badge: 'Novo', category: 'Documentos' },
    ],
  },
  {
    id: 'profissionais',
    heading: 'Para Profissionais',
    color: '#1d4ed8',
    tools: [
      { href: '/turno', label: 'Turno', desc: 'Todos os doentes, doses e alertas num ecrã', icon: '🏥', plan: 'clinic', category: 'Para Profissionais' },
      { href: '/rounds', label: 'Ronda Farmacêutica', desc: 'Intervenções PCNE · pendentes · métricas', icon: '👨‍⚕️', plan: 'clinic', category: 'Para Profissionais' },
      { href: '/mar', label: 'Administração (MAR)', desc: 'Registo de tomas por turno · alertas de omissão', icon: '📋', plan: 'clinic', category: 'Para Profissionais' },
      { href: '/patients', label: 'Doentes & Utentes', desc: 'Fichas, medicação, alertas e notas clínicas', icon: '🗂️', plan: 'clinic', category: 'Para Profissionais' },
      { href: '/calculators', label: 'Calculadoras Clínicas', desc: 'SCORE2 · CKD-EPI · Vancomicina · 15+', icon: '🧮', plan: 'pro', category: 'Para Profissionais' },
      { href: '/protocol', label: 'Protocolos', desc: 'ESC · ADA · NICE · DGS — guias terapêuticos', icon: '📚', plan: 'pro', category: 'Para Profissionais' },
      { href: '/med-review', label: 'Revisão de Medicação', desc: 'Análise clínica completa do esquema terapêutico', icon: '🔬', plan: 'pro', category: 'Para Profissionais' },
    ],
  },
  {
    id: 'estudantes',
    heading: 'Para Estudantes',
    color: '#7c3aed',
    tools: [
      { href: '/arena', label: 'Arena', desc: 'Ligas competitivas com casos clínicos IA', icon: '🏆', plan: 'student', category: 'Para Estudantes' },
      { href: '/simulador', label: 'Simulador Clínico', desc: 'Caso · Turno · Evolutivo — 3 modos de jogo', icon: '🎮', plan: 'student', badge: 'Novo', category: 'Para Estudantes' },
      { href: '/study', label: 'Flashcards & Quizzes', desc: '200+ tópicos · repetição espaçada', icon: '📚', plan: 'student', category: 'Para Estudantes' },
      { href: '/osce', label: 'Simulação OSCE', desc: 'AI como doente · feedback OSCE real', icon: '🎭', plan: 'student', category: 'Para Estudantes' },
      { href: '/tutor', label: 'AI Tutor', desc: 'Tutoria socrática · explica passo a passo', icon: '👨‍🏫', plan: 'student', category: 'Para Estudantes' },
      { href: '/cases', label: 'Casos Clínicos', desc: 'Arquivo resolvido por área e dificuldade', icon: '📁', plan: 'student', category: 'Para Estudantes' },
    ],
  },
]

const TOTAL_TOOLS = CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0)

// ─── Plan badge config ────────────────────────────────────────────────────────

const PLAN_BADGE: Record<string, { bg: string; color: string; text: string }> = {
  free:    { bg: '#d1fae5', color: '#065f46', text: 'Grátis' },
  student: { bg: '#ede9fe', color: '#6d28d9', text: 'Student' },
  pro:     { bg: '#dbeafe', color: '#1d4ed8', text: 'Pro' },
  clinic:  { bg: '#d1fae5', color: '#065f46', text: 'Clinic' },
}

// ─── Tool Card ────────────────────────────────────────────────────────────────

function ToolCard({ tool, categoryColor }: { tool: Tool; categoryColor: string }) {
  const plan = PLAN_BADGE[tool.plan] ?? PLAN_BADGE.free

  return (
    <Link
      href={tool.href}
      className="tool-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '18px 20px',
        textDecoration: 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'pointer',
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r)',
          background: categoryColor + '26',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {tool.icon}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--ink)',
          marginTop: 10,
          lineHeight: 1.3,
          fontFamily: 'var(--font-sans)',
        }}
      >
        {tool.label}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--ink-4)',
          fontFamily: 'var(--font-mono)',
          marginTop: 4,
          lineHeight: 1.5,
          flexGrow: 1,
        }}
      >
        {tool.desc}
      </div>

      {/* Footer badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            background: plan.bg,
            color: plan.color,
            borderRadius: 'var(--r-sm)',
            padding: '2px 7px',
          }}
        >
          {plan.text}
        </span>

        {tool.badge && tool.badge !== 'Grátis' && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              background: '#fef3c7',
              color: '#92400e',
              borderRadius: 'var(--r-sm)',
              padding: '2px 7px',
            }}
          >
            {tool.badge}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FerramentasPage() {
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()

  const allTools: (Tool & { categoryColor: string })[] = CATEGORIES.flatMap(cat =>
    cat.tools.map(t => ({ ...t, categoryColor: cat.color }))
  )

  const filteredTools = q
    ? allTools.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    : []

  return (
    <>
      <style>{`
        .tool-card:hover {
          border-color: var(--border-2) !important;
          box-shadow: var(--shadow) !important;
        }
        .search-input:focus {
          outline: none;
          border-color: var(--ink-3) !important;
          box-shadow: 0 0 0 3px rgba(0,0,0,0.06) !important;
        }
      `}</style>

      <Header />

      {/* Hero */}
      <div
        style={{
          background: '#0f172a',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'rgba(255,255,255,0.4)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Phlox · Todas as ferramentas
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 36,
            color: 'white',
            fontWeight: 400,
            marginBottom: 8,
            margin: '0 0 8px 0',
          }}
        >
          O que precisas hoje?
        </h1>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.5)',
            maxWidth: 480,
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          {TOTAL_TOOLS} ferramentas organizadas por categoria. Todas desenhadas para tornar a
          medicação mais segura e simples.
        </p>
      </div>

      {/* Sticky search bar */}
      <div
        style={{
          position: 'sticky',
          top: 60,
          zIndex: 90,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 16,
              color: 'var(--ink-4)',
              pointerEvents: 'none',
            }}
          >
            🔍
          </span>
          <input
            className="search-input"
            type="text"
            placeholder="Pesquisar ferramentas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '10px 14px 10px 40px',
              fontSize: 14,
              fontFamily: 'var(--font-sans)',
              color: 'var(--ink)',
              background: 'white',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                left: 'calc(min(520px, 100%) - 8px)',
                top: '50%',
                transform: 'translate(-100%, -50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                color: 'var(--ink-4)',
                lineHeight: 1,
                padding: '0 4px',
              }}
              aria-label="Limpar pesquisa"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '32px 24px 64px',
        }}
      >
        {/* Search results */}
        {q ? (
          filteredTools.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '80px 24px',
                color: 'var(--ink-4)',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
              <div
                style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 600,
                  color: 'var(--ink-2)',
                  marginBottom: 8,
                }}
              >
                Nenhuma ferramenta encontrada para &ldquo;{search}&rdquo;
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)' }}>
                Tenta outro termo ou navega pelas categorias abaixo.
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-4)',
                  marginBottom: 20,
                }}
              >
                {filteredTools.length} resultado{filteredTools.length !== 1 ? 's' : ''} para &ldquo;{search}&rdquo;
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: 16,
                }}
              >
                {filteredTools.map(tool => (
                  <ToolCard key={tool.href} tool={tool} categoryColor={tool.categoryColor} />
                ))}
              </div>
            </>
          )
        ) : (
          /* Category sections */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            {CATEGORIES.map(cat => (
              <section key={cat.id}>
                {/* Category header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: cat.color,
                      flexShrink: 0,
                    }}
                  />
                  <h2
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--ink)',
                      margin: 0,
                    }}
                  >
                    {cat.heading}
                  </h2>
                  <span
                    style={{
                      fontSize: 12,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--ink-4)',
                      background: 'var(--bg-2)',
                      borderRadius: 'var(--r-sm)',
                      padding: '2px 7px',
                      marginLeft: 2,
                    }}
                  >
                    {cat.tools.length}
                  </span>
                  <div
                    style={{
                      flexGrow: 1,
                      height: 1,
                      background: 'var(--border)',
                      marginLeft: 4,
                    }}
                  />
                </div>

                {/* Tool grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: 16,
                  }}
                >
                  {cat.tools.map(tool => (
                    <ToolCard key={tool.href} tool={tool} categoryColor={cat.color} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
