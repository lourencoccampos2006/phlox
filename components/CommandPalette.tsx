'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'

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
  { href: '/adr-report', label: 'Notificar RAM', desc: 'WHO-UMC · MedDRA · INFARMED', icon: 'alert', category: 'Segurança' },
  // A Minha Saúde
  { href: '/mymeds', label: 'Medicamentos', desc: 'Lista completa com lembretes e verificação automática', icon: 'pill', category: 'Saúde' },
  { href: '/vitals', label: 'Sinais Vitais', desc: 'TA · FC · SpO₂ · peso · tendências', icon: 'chart', category: 'Saúde' },
  { href: '/relatorio', label: 'Relatório Semanal', desc: 'IA analisa a tua semana e dá recomendações', icon: 'clipboard', category: 'Saúde' },
  { href: '/sintomas', label: 'Diário de Saúde', desc: 'Registo de sintomas e bem-estar diário', icon: 'note', category: 'Saúde' },
  // IA & Análise
  { href: '/ai', label: 'Phlox AI', desc: 'Co-piloto farmacológico com contexto clínico', icon: 'spark', category: 'IA & Análise' },
  { href: '/oracle', label: 'Oracle — Farmacêutico AI', desc: 'Consulta estruturada com plano de intervenção', icon: 'spark', category: 'IA & Análise' },
  { href: '/scan', label: 'Tradutor de Bula', desc: 'Texto técnico em linguagem simples', icon: 'book', category: 'IA & Análise', badge: 'Grátis' },
  // Documentos
  { href: '/passport', label: 'Passaporte de Saúde', desc: 'Cartão de emergência com QR code e PDF', icon: 'user', category: 'Documentos' },
  { href: '/link', label: 'Phlox Link', desc: 'Partilha dados com médico ou farmacêutico', icon: 'layers', category: 'Documentos' },
  { href: '/integracoes', label: 'Importar Dados', desc: 'Apple Saúde · Garmin · Fitbit · MySNS', icon: 'inbox', category: 'Documentos' },
  // Clínico
  { href: '/turno', label: 'Turno', desc: 'Todos os doentes, doses e alertas num ecrã', icon: 'building', category: 'Clínico' },
  { href: '/mar', label: 'Administração (MAR)', desc: 'Registo de tomas por turno · alertas', icon: 'clipboard', category: 'Clínico' },
  { href: '/patients', label: 'Doentes & Utentes', desc: 'Fichas, medicação, alertas e notas clínicas', icon: 'layers', category: 'Clínico' },
  { href: '/protocolos', label: 'Protocolos', desc: 'ESC · ADA · NICE · DGS', icon: 'book', category: 'Clínico' },
  // Estudantes
  { href: '/arena', label: 'Arena', desc: 'Ligas competitivas com casos clínicos IA', icon: 'trophy', category: 'Estudantes' },
  { href: '/study', label: 'Flashcards & Quizzes', desc: '200+ tópicos · repetição espaçada', icon: 'book', category: 'Estudantes' },
  { href: '/osce', label: 'Simulação OSCE', desc: 'AI como doente · feedback OSCE real', icon: 'cards', category: 'Estudantes' },
  { href: '/tutor', label: 'AI Tutor', desc: 'Tutoria socrática · passo a passo', icon: 'user', category: 'Estudantes' },
  // Conta
  { href: '/inicio', label: 'Início', desc: 'A tua página inicial — ferramentas e atalhos', icon: 'home', category: 'Conta' },
  { href: '/settings', label: 'Definições', desc: 'Perfil, modo de experiência, conta', icon: 'sliders', category: 'Conta' },
  { href: '/pricing', label: 'Planos & Preços', desc: 'Ver todos os planos disponíveis', icon: 'euro', category: 'Conta' },
  { href: '/inicio', label: 'Início', desc: 'Página inicial com as tuas ferramentas', icon: 'home', category: 'Conta' },
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

  // `setOpen` do useState ja e estavel; so falta o involucro.
  return useMemo(() => ({ open, setOpen }), [open])
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
      <div style={{ position: 'fixed', top: '15vh', left: '50%', transform: 'translateX(-50%)', width: 'min(600px, calc(100vw - 32px))', zIndex: 501, background: 'white', borderRadius: 'var(--r-xl)', boxShadow: '0 32px 80px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden', border: '1px solid var(--border)' }}>

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
            <button onClick={() => setQuery('')} style={{ background: 'var(--bg-3)', border: 'none', borderRadius: 'var(--r)', padding: '2px 6px', fontSize: 11, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>Limpar</button>
          )}
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '3px 6px', borderRadius: 'var(--r)', color: 'var(--ink-4)', flexShrink: 0 }}>ESC</kbd>
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
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={tool.icon} size={15} color="var(--ink-3)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{tool.label}</span>
                      {tool.badge && (
                        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--green)', background: 'var(--badge-green-bg)', border: '1px solid var(--badge-green-border)', borderRadius: 'var(--r-sm)', padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{tool.badge}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.desc}</div>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)', flexShrink: 0 }}>{tool.category}</div>
                  {i === selected && (
                    <kbd style={{ fontSize: 9, fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', border: '1px solid var(--border)', padding: '2px 5px', borderRadius: 'var(--r-sm)', color: 'var(--ink-4)', flexShrink: 0 }}>↵</kbd>
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
