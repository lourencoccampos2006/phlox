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
  { label: 'Painel de Gestão',           href: '/gestao',      group: 'Gestão',     keywords: 'painel gestao coordenador ops board tempo real direcao' },
  { label: 'Agenda & Transportes',       href: '/agenda',      group: 'Gestão',     keywords: 'agenda consultas exames transportes terapias visitas calendario marcacoes' },
  { label: 'Faturação & Mensalidades',   href: '/faturacao',   group: 'Gestão',     keywords: 'faturacao mensalidades comparticipacao pagamentos dividas financeiro recibo segurança social' },
  { label: 'Documentos',                 href: '/documentos',  group: 'Gestão',     keywords: 'documentos contratos consentimentos rgpd processo ficheiros relatorios' },
  { label: 'Ocupação',                   href: '/census',      group: 'Gestão',     keywords: 'camas quartos lotacao ocupacao' },
  { label: 'Equipa & Escalas',           href: '/schedule',    group: 'Gestão',     keywords: 'turnos equipa staff funcionarios' },
  { label: 'Protocolos',                 href: '/protocolos',  group: 'Gestão',     keywords: 'protocolos checklist procedimentos quedas ulceras emergencia governança' },
  { label: 'Famílias',                   href: '/family',      group: 'Gestão',     keywords: 'contactos visitas mensagens' },
  { label: 'Indicadores & Desempenho',    href: '/roi',         group: 'Gestão',     keywords: 'indicadores desempenho analytics receita vendas tendencia kpi estatistica relatorio retorno' },
  { label: 'Revisão Farmacoterapêutica', href: '/residentes',  group: 'Clínico',    keywords: 'farmacoterapia revisao medicacao' },
  { label: 'Gestão de Feridas',          href: '/feridas',     group: 'Clínico',    keywords: 'feridas ulceras pressao escaras pele penso npuap braden fotos' },
  { label: 'Peso & Nutrição',            href: '/nutricao',    group: 'Clínico',    keywords: 'peso nutricao desnutricao imc perda mna alimentacao' },
  { label: 'Hidratação & Eliminação',    href: '/hidratacao',  group: 'Clínico',    keywords: 'hidratacao agua liquidos dejecao bristol obstipacao desidratacao eliminacao' },
  { label: 'Ronda Clínica',              href: '/rounds',      group: 'Clínico',    keywords: 'ronda visita risco' },
  { label: 'Qualidade',                  href: '/quality',     group: 'Clínico',    keywords: 'indicadores kpi' },
  { label: 'Indicação Farmacêutica',     href: '/indicacao',   group: 'Clínico',    keywords: 'indicacao farmacia balcao otc automedicacao aconselhamento sintoma queixa farmaceutico comunitaria' },
  { label: 'Nota Clínica SOAP',          href: '/soap',        group: 'Clínico',    keywords: 'soap nota consulta clinica medico subjetivo objetivo avaliacao plano processo registo' },
  { label: 'Gestão de Rastreios',        href: '/rastreios',   group: 'Clínico',    keywords: 'rastreios vacinas dgs mama colo utero colon psof mamografia citologia prevencao centro saude usf' },
  { label: 'Connect',                    href: '/connect',     group: 'Clínico',    keywords: 'rede profissionais consulta' },
  { label: 'Ponto de Venda (POS)',       href: '/vendas',      group: 'Operações',  keywords: 'vendas pos caixa balcao codigo barras leitor scanner recibo fatura preco dispensa venda registadora' },
  { label: 'Webhooks & Integrações',      href: '/webhooks',    group: 'Operações',  keywords: 'webhooks integracao api zapier make n8n erp eventos hmac sincronizar export' },
  { label: 'Audit Trail',                 href: '/auditoria',   group: 'Legal',      keywords: 'audit trail auditoria registo eventos hash cadeia seguranca rgpd quem fez o que' },
  { label: 'Decision Engine (Pro)',       href: '/motor-clinico', group: 'Clínico',  keywords: 'motor regras stopp beers interacoes anticolinergico carga qtc renal score auditavel deterministic' },
  { label: 'Chaves de API (Institucional)', href: '/api-keys',  group: 'Operações',  keywords: 'api key chaves rest endpoint scope rate limit erp bi sincronizar institutional' },
  { label: 'SSO Empresarial',             href: '/sso-config',  group: 'Operações',  keywords: 'sso saml oidc entra azure okta auth0 google workspace empresarial institucional login' },
  { label: 'AI Copilot clínico (Pro)',    href: '/copiloto',    group: 'Clínico',    keywords: 'copilot copiloto ai assistente decisao regras stopp beers citacoes raciocinio anchored deterministic' },
  { label: 'Insights & Benchmarks (Pro)', href: '/insights',    group: 'Gestão',     keywords: 'insights benchmarks comparar pool mediana percentil anonymized analytics setor' },
  { label: 'Trust Center',                href: '/trust',       group: 'Legal',      keywords: 'trust center confiabilidade rgpd dpa subprocessadores estado seguranca' },
  { label: 'Exportar os meus dados',      href: '/exportar-dados', group: 'Conta',   keywords: 'rgpd portabilidade export download dados pessoais artigo 20' },
  { label: 'Guardados — biblioteca',        href: '/guardados',   group: 'Conta',      keywords: 'guardados favoritos biblioteca mnemonica explicacao analise consulta save' },
  { label: 'Calendário Phlox',              href: '/calendario',  group: 'Conta',      keywords: 'calendario eventos consulta exame lembrete agenda ics apple google' },
  { label: 'Hidratação — registar água',    href: '/agua',        group: 'Conta',      keywords: 'agua hidratacao copo litros meta dia' },
  { label: 'Peso — registar e ver tendência', href: '/pesar',     group: 'Conta',      keywords: 'peso kg balanca grafico tendencia mensal vitais imc' },
  { label: 'Importar Apple Health',         href: '/health-import', group: 'Conta',    keywords: 'apple health import iphone xml ta peso tensao saude vital' },
  { label: 'Cartão de Emergência',          href: '/cartao-emergencia', group: 'Conta', keywords: 'cartao emergencia wallet apple google qr ICE alergias sangue contacto' },
  { label: 'Phlox Reach — convidar amigos', href: '/reach',     group: 'Conta',      keywords: 'reach convites referrals partilhar codigo amigos premio meses gratis' },
  { label: 'Brief diário (pessoal)',        href: '/brief',     group: 'Conta',      keywords: 'brief sumario diario dashboard pessoal hoje atividade alertas tarefas' },
  { label: 'AI Briefing — caso clínico',    href: '/briefing',  group: 'Clínico',    keywords: 'briefing consulta caso ai analise prepara apresentacao internato urgencia farmacia profissional' },
  { label: 'Calculadoras essenciais',       href: '/calc',      group: 'Clínico',    keywords: 'calc essenciais crcl egfr ckdepi imc bsa cha2ds2 hasbled qsofa news2 wells meld glasgow centor abcd2 padua osm fena maddrey light bishop' },
  { label: 'Calculadoras farmacocinéticas', href: '/calculos',  group: 'Clínico',    keywords: 'pk farmacocinetica vd clearance dose loading manutencao child-pugh interval ajuste' },
  { label: 'Sala de Espera',             href: '/sala-espera', group: 'Operações',  keywords: 'sala espera fila check-in chegada recepcao secretaria walk-in atendimento sem conta' },
  { label: 'Tarefas da Equipa',          href: '/tarefas-equipa', group: 'Operações', keywords: 'tarefas equipa limpeza manutencao cozinha secretaria quadro kanban afazeres' },
  { label: 'Stock & Validades',          href: '/stock',       group: 'Operações',  keywords: 'stock existencias validades prazos rutura encomendas epi consumiveis inventario' },
  { label: 'Conformidade & Auditoria',   href: '/conformidade', group: 'Legal',     keywords: 'conformidade auditoria rgpd legal licenciamento checklist seguranca obrigacoes' },
  { label: 'Consentimentos & RGPD',      href: '/consentimentos', group: 'Legal',   keywords: 'consentimento rgpd informado procedimento imagem vacina assinatura declaracao' },
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
