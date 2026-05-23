'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'

interface Dest { label: string; href: string; group: string; keywords?: string }

const DESTINATIONS: Dest[] = [
  { label: 'Cockpit',                    href: '/cockpit',     group: 'Hoje',       keywords: 'painel dashboard inicio home' },
  { label: 'Centro de Turno',            href: '/turno',       group: 'Hoje',       keywords: 'tarefas inbox pendentes ronda guiada passagem turno worklist' },
  { label: 'Registos Diários',           href: '/care-log',    group: 'Hoje',       keywords: 'cuidados diario notas' },
  { label: 'MAR — Administração',        href: '/mar',         group: 'Hoje',       keywords: 'medicacao toma administrar' },
  { label: 'Passagem de Turno',          href: '/handover',    group: 'Hoje',       keywords: 'turno passa shift' },
  { label: 'Residentes',                 href: '/patients',    group: 'Residentes', keywords: 'doentes utentes clientes pacientes' },
  { label: 'Avaliações',                 href: '/assessments', group: 'Residentes', keywords: 'barthel morse braden escalas' },
  { label: 'Planos de Cuidado',          href: '/care-plans',  group: 'Residentes', keywords: 'cuidados plano' },
  { label: 'Ocorrências',                href: '/incidents',   group: 'Residentes', keywords: 'incidentes quedas eventos' },
  { label: 'Atividades',                 href: '/activities',  group: 'Residentes', keywords: 'animacao ocupacao' },
  { label: 'Ocupação',                   href: '/census',      group: 'Gestão',     keywords: 'camas quartos lotacao painel ocupacao' },
  { label: 'Equipa & Escalas',           href: '/schedule',    group: 'Gestão',     keywords: 'turnos equipa staff funcionarios' },
  { label: 'Famílias',                   href: '/family',      group: 'Gestão',     keywords: 'contactos visitas mensagens' },
  { label: 'Poupança / ROI',             href: '/roi',         group: 'Gestão',     keywords: 'retorno custo economia' },
  { label: 'Revisão Farmacoterapêutica', href: '/residentes',  group: 'Clínico',    keywords: 'farmacoterapia revisao medicacao' },
  { label: 'Ronda Clínica',              href: '/rounds',      group: 'Clínico',    keywords: 'ronda visita risco' },
  { label: 'Qualidade',                  href: '/quality',     group: 'Clínico',    keywords: 'indicadores kpi' },
  { label: 'Connect',                    href: '/connect',     group: 'Clínico',    keywords: 'rede profissionais consulta' },
  { label: 'Definições',                 href: '/settings',    group: 'Conta',      keywords: 'configuracoes conta perfil instituicao tipo' },
]

const QUICK_ACTIONS: Dest[] = [
  { label: 'Abrir Centro de Turno', href: '/turno',     group: 'Ações', keywords: 'ronda tarefas passagem' },
  { label: 'Novo registo diário', href: '/care-log',    group: 'Ações', keywords: 'criar adicionar' },
  { label: 'Registar ocorrência', href: '/incidents',   group: 'Ações', keywords: 'criar nova queda' },
  { label: 'Nova avaliação',      href: '/assessments', group: 'Ações', keywords: 'criar barthel' },
  { label: 'Marcar turno',        href: '/schedule',    group: 'Ações', keywords: 'escala equipa' },
]

interface PatientHit { id: string; name: string; room_number?: string | null }
interface Row { key: string; label: string; hint?: string; href: string; group: string }

function RowIcon({ group }: { group: string }) {
  const p = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: '#94a3b8', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { flexShrink: 0 } }
  if (group === 'Residente') return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  if (group === 'Ações')     return <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
  return <svg {...p}><path d="M9 18l6-6-6-6"/></svg>
}

export default function ClinicalCommandPalette() {
  const router = useRouter()
  const { user, supabase } = useAuth() as any

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [patients, setPatients] = useState<PatientHit[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setOpen(o => !o) }
      if (e.key === 'Escape') setOpen(false)
    }
    const onCustom = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('phlox:cmdk', onCustom)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('phlox:cmdk', onCustom) }
  }, [])

  useEffect(() => {
    if (open) { setQuery(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30) }
  }, [open])

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  useEffect(() => {
    if (!open || !user || query.trim().length < 2) { setPatients([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('patients').select('id,name,room_number')
        .eq('user_id', user.id).ilike('name', `%${query.trim()}%`).limit(6)
      setPatients((data as PatientHit[]) || [])
    }, 180)
    return () => clearTimeout(t)
  }, [query, open, user, supabase])

  const q = query.trim().toLowerCase()
  const match = (text: string, kw?: string) => !q || text.toLowerCase().includes(q) || (kw || '').toLowerCase().includes(q)

  const rows: Row[] = []
  patients.forEach(p => rows.push({ key: `pt-${p.id}`, label: p.name, hint: p.room_number ? `Quarto ${p.room_number}` : 'Residente', href: `/patients/${p.id}`, group: 'Residente' }))
  if (q) QUICK_ACTIONS.filter(a => match(a.label, a.keywords)).forEach(a => rows.push({ key: `qa-${a.label}`, label: a.label, href: a.href, group: 'Ações' }))
  DESTINATIONS.filter(d => match(d.label, d.keywords)).forEach(d => rows.push({ key: `d-${d.href}`, label: d.label, hint: d.group, href: d.href, group: 'Navegação' }))

  const go = useCallback((href: string) => { setOpen(false); router.push(href) }, [router])

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, rows.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[active]) go(rows[active].href) }
  }

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])
  useEffect(() => { setActive(0) }, [query, patients.length])

  if (!open) return null
  let lastGroup = ''

  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(8,12,24,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 16px' }}>
      <div onKeyDown={onListKey}
        style={{ width: 'min(560px, 100%)', background: 'white', borderRadius: 14, boxShadow: '0 24px 70px rgba(0,0,0,0.3)', overflow: 'hidden', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', maxHeight: '70vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar residente ou navegar..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, fontFamily: 'var(--font-sans)', color: '#0b1120', background: 'transparent' }} />
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#94a3b8', background: '#f1f5f9', borderRadius: 5, padding: '3px 7px', flexShrink: 0 }}>ESC</kbd>
        </div>
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 0' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Sem resultados para “{query}”.</div>
          ) : rows.map((r, i) => {
            const showHeader = r.group !== lastGroup
            lastGroup = r.group
            const isActive = i === active
            return (
              <div key={r.key}>
                {showHeader && <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 18px 4px' }}>{r.group}</div>}
                <div data-idx={i} onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); go(r.href) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 18px', cursor: 'pointer', background: isActive ? '#eff6ff' : 'transparent' }}>
                  <RowIcon group={r.group} />
                  <span style={{ flex: 1, fontSize: 14, color: '#0b1120', fontWeight: isActive ? 600 : 400 }}>{r.label}</span>
                  {r.hint && <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{r.hint}</span>}
                  {isActive && <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#1d4ed8', flexShrink: 0 }}>↵</kbd>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 18px', display: 'flex', gap: 16, fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
          <span>↑↓ navegar</span><span>↵ abrir</span><span style={{ marginLeft: 'auto' }}>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  )
}
