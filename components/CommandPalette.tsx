'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Tool {
  href: string
  label: string
  desc: string
  icon: string
  category: string
  badge?: string
}

const TOOLS: Tool[] = [
  // Segurança
  { href: '/interactions', label: 'Verificar Interações', desc: 'Analisa qualquer combinação de medicamentos', icon: '🔍', category: 'Segurança', badge: 'Grátis' },
  { href: '/food-drug', label: 'Fármaco-Alimento', desc: 'Toranja, álcool, laticínios, vitamina K', icon: '🍊', category: 'Segurança', badge: 'Grátis' },
  { href: '/dose-crianca', label: 'Dose Pediátrica', desc: 'Calcula a dose correta por peso e medicamento', icon: '👶', category: 'Segurança', badge: 'Grátis' },
  { href: '/adr-report', label: 'Notificar RAM', desc: 'WHO-UMC · MedDRA · INFARMED', icon: '⚠️', category: 'Segurança' },
  // A Minha Saúde
  { href: '/mymeds', label: 'Medicamentos', desc: 'Lista completa com lembretes e verificação automática', icon: '💊', category: 'Saúde' },
  { href: '/vitals', label: 'Sinais Vitais', desc: 'TA · FC · SpO₂ · peso · tendências', icon: '📊', category: 'Saúde' },
  { href: '/objetivos', label: 'Objetivos de Saúde', desc: 'Define metas e acompanha o progresso', icon: '🎯', category: 'Saúde' },
  { href: '/relatorio', label: 'Relatório Semanal', desc: 'IA analisa a tua semana e dá recomendações', icon: '📋', category: 'Saúde' },
  { href: '/diary', label: 'Diário de Saúde', desc: 'Registo de sintomas e bem-estar diário', icon: '📝', category: 'Saúde' },
  { href: '/adherencia', label: 'Adesão à Medicação', desc: 'Padrões de toma e insights pessoais', icon: '✅', category: 'Saúde' },
  // IA & Análise
  { href: '/ai', label: 'Phlox AI', desc: 'Co-piloto farmacológico com contexto clínico', icon: '🤖', category: 'IA & Análise' },
  { href: '/oracle', label: 'Oracle — Farmacêutico AI', desc: 'Consulta estruturada com plano de intervenção', icon: '🔮', category: 'IA & Análise' },
  { href: '/schedule', label: 'Horário Inteligente', desc: 'IA cria o horário perfeito para a tua medicação', icon: '⏰', category: 'IA & Análise' },
  { href: '/optimizer', label: 'Otimizar Prescrição', desc: 'Genéricos mais baratos · STOPP/START · segurança', icon: '⚡', category: 'IA & Análise' },
  { href: '/bula', label: 'Tradutor de Bula', desc: 'Texto técnico em linguagem simples', icon: '📖', category: 'IA & Análise', badge: 'Grátis' },
  { href: '/labs', label: 'Perceber as Análises', desc: 'O que está fora do normal e o que fazer', icon: '🧬', category: 'IA & Análise' },
  // Documentos
  { href: '/passport', label: 'Passaporte de Saúde', desc: 'Cartão de emergência com QR code e PDF', icon: '🪪', category: 'Documentos' },
  { href: '/link', label: 'Phlox Link', desc: 'Partilha dados com médico ou farmacêutico', icon: '🔗', category: 'Documentos' },
  { href: '/prescription', label: 'Perceber a Receita', desc: 'Foto ou texto → explicação clara', icon: '📄', category: 'Documentos' },
  { href: '/vaccines', label: 'Vacinas em Dia?', desc: 'Calendário PT · viagens · recomendações', icon: '💉', category: 'Documentos' },
  { href: '/integracoes', label: 'Importar Dados', desc: 'Apple Saúde · Garmin · Fitbit · MySNS', icon: '📥', category: 'Documentos' },
  // Clínico
  { href: '/turno', label: 'Turno', desc: 'Todos os doentes, doses e alertas num ecrã', icon: '🏥', category: 'Clínico' },
  { href: '/rounds', label: 'Ronda Farmacêutica', desc: 'Intervenções PCNE · pendentes · métricas', icon: '👨‍⚕️', category: 'Clínico' },
  { href: '/mar', label: 'Administração (MAR)', desc: 'Registo de tomas por turno · alertas', icon: '📋', category: 'Clínico' },
  { href: '/patients', label: 'Doentes & Utentes', desc: 'Fichas, medicação, alertas e notas clínicas', icon: '🗂️', category: 'Clínico' },
  { href: '/calculators', label: 'Calculadoras Clínicas', desc: 'SCORE2 · CKD-EPI · Vancomicina · 15+', icon: '🧮', category: 'Clínico' },
  { href: '/protocol', label: 'Protocolos', desc: 'ESC · ADA · NICE · DGS', icon: '📚', category: 'Clínico' },
  { href: '/med-review', label: 'Revisão de Medicação', desc: 'Análise clínica completa do esquema', icon: '🔬', category: 'Clínico' },
  // Estudantes
  { href: '/arena', label: 'Arena', desc: 'Ligas competitivas com casos clínicos IA', icon: '🏆', category: 'Estudantes' },
  { href: '/simulador', label: 'Simulador Clínico', desc: 'Caso · Turno · Evolutivo', icon: '🎮', category: 'Estudantes' },
  { href: '/study', label: 'Flashcards & Quizzes', desc: '200+ tópicos · repetição espaçada', icon: '📚', category: 'Estudantes' },
  { href: '/osce', label: 'Simulação OSCE', desc: 'AI como doente · feedback OSCE real', icon: '🎭', category: 'Estudantes' },
  { href: '/tutor', label: 'AI Tutor', desc: 'Tutoria socrática · passo a passo', icon: '👨‍🏫', category: 'Estudantes' },
  // Conta
  { href: '/dashboard', label: 'Dashboard', desc: 'O teu painel pessoal com briefe diário', icon: '🏠', category: 'Conta' },
  { href: '/settings', label: 'Definições', desc: 'Perfil, modo de experiência, conta', icon: '⚙️', category: 'Conta' },
  { href: '/pricing', label: 'Planos & Preços', desc: 'Ver todos os planos disponíveis', icon: '💳', category: 'Conta' },
  { href: '/ferramentas', label: 'Todas as Ferramentas', desc: 'Diretório completo de todas as funcionalidades', icon: '🗺️', category: 'Conta' },
]

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return { open, setOpen }
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = query.trim()
    ? TOOLS.filter(t =>
        t.label.toLowerCase().includes(query.toLowerCase()) ||
        t.desc.toLowerCase().includes(query.toLowerCase()) ||
        t.category.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : TOOLS.slice(0, 8)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => { setSelected(0) }, [query])

  const navigate = useCallback((href: string) => {
    router.push(href)
    onClose()
  }, [router, onClose])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[selected]) navigate(results[selected].href)
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)', width: 'min(600px, calc(100vw - 32px))', zIndex: 501, background: 'white', borderRadius: 16, boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid var(--border)' }}>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pesquisar ferramentas..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'var(--font-sans)', color: 'var(--ink)', background: 'transparent', letterSpacing: '-0.01em' }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'var(--bg-3)', border: 'none', borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>Limpar</button>
          )}
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '3px 6px', borderRadius: 4, color: 'var(--ink-4)', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>
              Nenhuma ferramenta encontrada para &ldquo;{query}&rdquo;
            </div>
          ) : (
            <>
              {!query && (
                <div style={{ padding: '8px 18px 4px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sugestões</div>
              )}
              {query && (
                <div style={{ padding: '8px 18px 4px', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{results.length} resultado{results.length !== 1 ? 's' : ''}</div>
              )}
              {results.map((tool, i) => (
                <button
                  key={tool.href}
                  onClick={() => navigate(tool.href)}
                  onMouseEnter={() => setSelected(i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', border: 'none', background: i === selected ? 'var(--bg-2)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {tool.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{tool.label}</span>
                      {tool.badge && (
                        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{tool.badge}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.desc}</div>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', flexShrink: 0 }}>{tool.category}</div>
                  {i === selected && (
                    <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: 3, color: 'var(--ink-4)', flexShrink: 0 }}>↵</kbd>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '8px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', letterSpacing: '0.06em' }}>↑↓ navegar &nbsp;·&nbsp; ↵ abrir &nbsp;·&nbsp; ESC fechar</span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>⌘K</span>
        </div>
      </div>
    </>
  )
}
