'use client'

// PhloxCopilot — assistente contextual flutuante (Pro).
// Só aparece para plano Pro (e nunca em páginas públicas).
//
// 2026-09-08: o atalho Cmd/Ctrl+K saiu (abria-se sem querer, e num tablet de
// sala não serve para nada), o foco passou a ser escolha de quem escreve em
// vez de imposição, e o campo ganhou ditado por voz — numa sala de cuidados
// escreve-se de pé e com uma mão só.

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { getPhloxContext, subscribePhloxContext, serializeContext } from '@/lib/copilotContext'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import { save } from '@/lib/saves'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { marcarPresenca } from '@/lib/presenca'
import { ptDate } from '@/lib/ptTime'
import MicButton from '@/components/MicButton'

// Páginas PÚBLICAS/marketing onde o Copilot nunca deve aparecer — nem sequer a
// um utilizador com sessão iniciada (senão o ✦ fica por cima da landing page
// durante uma apresentação). Comparação por PREFIXO: '/blog' cobre '/blog/x'.
const PUBLIC_PREFIXES = [
  '/about', '/pricing', '/login', '/signup', '/terms', '/privacy', '/trust',
  '/centro-de-dia', '/institucional', '/blog', '/guias', '/onboarding',
  '/seguranca', '/dispositivo-medico', '/subprocessadores', '/cookies',
  '/checkout', '/api-docs', '/changelog',
]
const isPublicPath = (pathname: string) =>
  pathname === '/' || PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))

interface ProposedAction {
  type: 'save_summary' | 'log_resident_request' | 'marcar_presenca' | 'registar_ocorrencia' | 'recado_familia' | 'nota_no_mural'
  label: string; content: string; args?: Record<string, any>
}
interface Msg { role: 'user' | 'assistant'; content: string; usedTool?: string | null; proposedAction?: ProposedAction | null; actionDone?: boolean; actionError?: string }

const TOOL_BADGE: Record<string, string> = {
  check_interactions: '🔎 Verificado com interações reais',
  patient_data: '🧠 Consultado o registo atual',
  patient_data_interactions: '🧠🔎 Registo atual + interações reais verificadas',
  estado_da_casa: '🏠 Leu o estado real da casa hoje',
}

// Sugestões PROATIVAS — adapta-se ao que o utilizador está a ver e a quem acompanha.
const chipVolta: React.CSSProperties = {
  border: '1px dashed #d6d8dc', background: 'none', borderRadius: 20,
  padding: '3px 10px', fontSize: 11, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
}

function proactiveSuggestions(ctxLabel: string, path: string, prof?: ActiveProfile | null): string[] {
  const l = (ctxLabel || '').toLowerCase()
  // Se há um doente/familiar em foco, oferece ações sobre ESSA pessoa primeiro.
  if (prof && prof.type !== 'self') {
    const n = prof.name.split(' ')[0]
    return [`Faz um resumo clínico de ${n}`, `O que devo vigiar em ${n}?`, `Há interações na medicação de ${n}?`]
  }
  if (l.includes('medicamento') || l.includes('bula')) return ['Dá-se bem com a minha medicação?', 'Quais os efeitos mais comuns?', 'Posso tomar com álcool?']
  if (l.includes('interaç')) return ['Explica o mecanismo desta interação', 'Que alternativa mais segura existe?', 'Qual o grau de gravidade?']
  if (l.includes('ecg')) return ['Que achados devo procurar?', 'Diagnósticos diferenciais deste traçado', 'O que faço a seguir?']
  if (l.includes('análise') || l.includes('laborat')) return ['Que valores estão alterados?', 'O que pode causar isto?', 'Preciso de mais exames?']
  if (l.includes('medicação') || path.includes('/mymeds')) return ['Há interações entre os meus medicamentos?', 'Esqueci uma dose, o que faço?', 'Algum precisa de cuidado especial?']
  if (l.includes('triagem') || l.includes('sintoma')) return ['Devo ir ao médico ou às urgências?', 'Que sinais de alarme vigiar?', 'O que posso fazer em casa?']
  if (l.includes('pergunta clínica') || l.includes('biblioteca')) return ['Resume em 3 pontos', 'Qual a evidência por trás disto?', 'E em doentes idosos?']
  // Ferramentas instrumentadas nesta ronda (contexto rico):
  if (l.includes('doente do estágio') || l.includes('doente:') || l.includes('utente:')) return ['Faz um resumo deste doente', 'Que diagnósticos diferenciais considerar?', 'Qual o próximo passo?']
  if (l.includes('caso na arena') || l.includes('estação osce')) return ['Ajuda-me a raciocinar (sem dar a resposta)', 'Que dados me faltam?', 'Explica o porquê da resposta']
  if (l.includes('tutoria')) return ['Faz-me uma pergunta sobre isto', 'Explica passo a passo', 'Dá-me uma mnemónica']
  if (l.includes('ficha de fármaco')) return ['Mecanismo em 1 frase', 'Efeitos adversos mais importantes', 'Interações a ter em conta']
  if (l.includes('calculadora')) return ['O que significa este resultado?', 'Quando é que isto muda a conduta?', 'Que valores são de alarme?']
  if (l.includes('familiar no lar')) return ['Como tem corrido nos últimos dias?', 'A medicação está toda a ser dada?', 'Guarda um resumo desta semana']
  if (l.includes('atenção')) return ['Quem precisa de mais atenção hoje?', 'Há pedidos dos utentes por resolver?', 'O que devo confirmar primeiro?']
  return ['Explica isto de forma simples', 'Quais os riscos clínicos aqui?', 'Guarda um resumo disto']
}

export default function PhloxCopilot() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState('')
  const [ctxLabel, setCtxLabel] = useState('')   // contexto da página (ex: "Medicamento aberto")
  const [activeProf, setActiveProf] = useState<ActiveProfile | null>(null)  // perfil/doente em foco
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)  // posição do botão (arrastável)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dragRef = useRef<{ ox: number; oy: number; moved: boolean } | null>(null)

  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'
  const isPublic = !user || isPublicPath(pathname)

  // Mesma regra de visibilidade da BottomNav (components/BottomNav.tsx) — para
  // saber, no mobile, se o botão do Copilot precisa de subir para não ficar
  // em cima da barra de navegação inferior (era a bola "incomodativa": as
  // duas coisas fixas disputavam o mesmo canto inferior direito do ecrã).
  const hasBottomNav = !!user && (user.experience_mode || 'personal') !== 'clinical'
    && !(pathname.startsWith('/hp') || pathname === '/' || pathname.startsWith('/login') || pathname.startsWith('/onboarding'))

  // ── FOCO: agora é uma escolha, não uma imposição ─────────────────────────
  // Antes o Copilot agarrava sozinho a página em que estavas e a pessoa que
  // tinhas aberta, e mantinha isso agarrado. Quando a conversa mudava de
  // assunto, ele continuava a responder sobre a pessoa anterior — parecia
  // avariado. Agora sugere o foco, mas quem manda é quem escreve: dá para
  // largar a pessoa e dá para largar "o que estou a ver".
  const [usarPerfil, setUsarPerfil] = useState(true)
  const [usarPagina, setUsarPagina] = useState(true)

  useEffect(() => {
    const update = () => setCtxLabel(getPhloxContext()?.label || '')
    update()
    return subscribePhloxContext(update)
  }, [])

  useEffect(() => { if (open) setActiveProf(getActiveProfile()) }, [open])

  /** Recomeçar do zero — conversa, foco e memória do painel. */
  const limparConversa = useCallback(() => {
    setMsgs([]); setSelection(''); setUsarPerfil(true); setUsarPagina(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }, [])

  // Posição inicial e persistência do botão — limitada ao ecrã ATUAL. Sem
  // isto, uma posição guardada num ecrã maior (ex: desktop) podia cair fora
  // do ecrã (ou por cima de outro conteúdo) ao abrir num telemóvel mais
  // pequeno, já que só o arrasto em si tinha limites (não a leitura inicial).
  useEffect(() => {
    try {
      const s = localStorage.getItem('phlox_copilot_pos')
      if (!s) return
      const p = JSON.parse(s)
      setPos({ x: Math.max(8, Math.min(window.innerWidth - 60, p.x)), y: Math.max(8, Math.min(window.innerHeight - 60, p.y)) })
    } catch {}
  }, [])

  // O Ctrl/Cmd+K saiu (2026-09-08, decisão do Fernando): abria-se sem querer,
  // e num tablet de sala um atalho de teclado não serve para nada. Fica o
  // Escape para fechar, que é o que qualquer pessoa espera.
  useEffect(() => {
    if (!isPro || isPublic) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPro, isPublic])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50) }, [open])
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight) }, [msgs, busy])

  const send = useCallback(async (override?: string) => {
    const q = (typeof override === 'string' ? override : input).trim()
    if (!q || busy) return
    setInput('')
    const newMsgs = [...msgs, { role: 'user' as const, content: q }]
    setMsgs(newMsgs); setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const pageContext = usarPagina ? serializeContext(getPhloxContext()) : ''
      const ap = usarPerfil ? getActiveProfile() : null
      const profileCtx = ap
        ? (ap.type === 'self' ? 'O utilizador está a trabalhar no SEU próprio perfil.'
            : `O utilizador tem o perfil "${ap.name}" ativo${ap.type === 'patient' ? ' (um doente/utente que acompanha)' : ' (um familiar)'}.${ap.age ? ` ${ap.age} anos.` : ''}${ap.sex ? ` Sexo ${ap.sex}.` : ''}${ap.conditions ? ` Condições: ${ap.conditions}.` : ''}${ap.allergies ? ` Alergias: ${ap.allergies}.` : ''}`)
        : ''
      const r = await fetch('/api/copilot-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({
          message: q, path: pathname, selection, context: pageContext, profile: profileCtx,
          profileId: ap?.id, profileType: ap?.type,
          mode: user?.experience_mode, history: newMsgs.slice(-6),
        }),
      })
      const j = await r.json()
      setMsgs(m => [...m, { role: 'assistant', content: j.reply || j.error || 'Sem resposta.', usedTool: j.usedTool || null, proposedAction: j.proposedAction || null }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'Erro de ligação.' }])
    } finally { setBusy(false); setSelection('') }
  }, [input, busy, msgs, pathname, selection, supabase])

  // Executa uma ação PROPOSTA pelo Copilot, só depois de confirmação do utilizador.
  const confirmAction = useCallback(async (idx: number, action: ProposedAction) => {
    const ap = getActiveProfile()
    try {
      if (action.type === 'save_summary') {
        const profileName = ap ? (ap.type === 'self' ? `Eu (${ap.name.split(' ')[0]})` : ap.name) : undefined
        save({
          kind: 'note',
          title: action.label.replace(/^💾\s*/, '') || 'Nota do Copilot',
          preview: action.content.slice(0, 160),
          data: { content: action.content },
          href: pathname,
          profileId: ap?.id, profileName, profileType: ap?.type,
        })
      } else if (action.type === 'log_resident_request') {
        if (!ap || ap.type !== 'patient') throw new Error('Sem utente em foco')
        const { error } = await supabase.from('resident_requests').insert(scope.stamp({ patient_id: ap.id, kind: 'observacao', content: action.content }))
        if (error) throw error

      // ── Ações novas (2026-09-05) ────────────────────────────────────────
      // O Copilot deixou de ser só uma caixa de respostas: quando a mensagem
      // pede que se FAÇA alguma coisa, ele propõe a ação já preenchida. A
      // execução continua a ser um toque da pessoa — isto escreve no registo
      // de alguém e não pode acontecer só porque a IA percebeu bem a frase.
      } else if (action.type === 'marcar_presenca') {
        if (!ap || ap.type !== 'patient') throw new Error('Sem utente em foco')
        const estado = (action.args?.estado === 'left' || action.args?.estado === 'absent') ? action.args!.estado : 'present'
        const r = await marcarPresenca(
          { supabase, scope, user, avisaFamilia: institution === 'day_care' },
          { id: ap.id, name: ap.name }, estado,
        )
        if (r.erro) throw new Error(r.erro)

      } else if (action.type === 'registar_ocorrencia') {
        if (!ap || ap.type !== 'patient') throw new Error('Sem utente em foco')
        const tipos = ['fall', 'medication_error', 'pressure_ulcer', 'behavioral', 'choking', 'infection', 'other']
        const gravidades = ['minor', 'moderate', 'major', 'critical']
        const { error } = await supabase.from('incidents').insert(scope.stamp({
          user_id: user.id, patient_id: ap.id, date: ptDate(),
          type: tipos.includes(action.args?.tipo) ? action.args!.tipo : 'other',
          severity: gravidades.includes(action.args?.gravidade) ? action.args!.gravidade : 'minor',
          description: action.content.slice(0, 1000), status: 'open',
        }))
        if (error) throw error

      } else if (action.type === 'recado_familia') {
        if (!ap || ap.type !== 'patient') throw new Error('Sem utente em foco')
        const { error } = await supabase.from('family_thread_messages').insert(scope.stamp({
          user_id: user.id, patient_id: ap.id, author_side: 'staff',
          author_name: user?.name || 'Equipa', kind: 'message',
          content: action.content.slice(0, 1000), read_by_family: false, read_by_staff: true,
        }))
        if (error) throw error

      } else if (action.type === 'nota_no_mural') {
        const { data: sd } = await supabase.auth.getSession()
        const r = await fetch('/api/team-messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
          body: JSON.stringify({ body: action.content.slice(0, 1000), channel: 'avisos', priority: 'normal' }),
        }).then(x => x.json()).catch(() => ({ error: 'falhou' }))
        if (r?.error) throw new Error(r.error)
      }
      setMsgs(m => m.map((msg, i) => i === idx ? { ...msg, actionDone: true } : msg))
    } catch {
      setMsgs(m => m.map((msg, i) => i === idx ? { ...msg, actionError: 'Não foi possível concluir.' } : msg))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, supabase, scope.orgId, scope.userId, user, institution])

  if (!isPro || isPublic) return null

  // Drag do botão
  function onPointerDown(e: React.PointerEvent) {
    const startX = e.clientX, startY = e.clientY
    const base = pos || { x: window.innerWidth - 72, y: window.innerHeight - 72 }
    dragRef.current = { ox: base.x - startX, oy: base.y - startY, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const nx = Math.max(8, Math.min(window.innerWidth - 60, e.clientX + dragRef.current.ox))
    const ny = Math.max(8, Math.min(window.innerHeight - 60, e.clientY + dragRef.current.oy))
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) dragRef.current.moved = true
    setPos({ x: nx, y: ny })
  }
  function onPointerUp() {
    if (pos) { try { localStorage.setItem('phlox_copilot_pos', JSON.stringify(pos)) } catch {} }
    setTimeout(() => { dragRef.current = null }, 0)
  }
  const btnStyle: React.CSSProperties = pos
    ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 9000 }
    : { position: 'fixed', bottom: 20, right: 20, zIndex: 9000 }
  const btnClassName = !pos && hasBottomNav ? 'copilot-fab copilot-fab-avoid-nav' : 'copilot-fab'

  return (
    <>
      {/* Botão flutuante arrastável */}
      {!open && (
        <button
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
          onClick={() => { if (dragRef.current?.moved) return; const s = window.getSelection()?.toString() || ''; setSelection(s.slice(0, 1500)); setOpen(true) }}
          aria-label="Abrir Phlox Copilot"
          title={ctxLabel ? `Copilot · sabe: ${ctxLabel}` : 'Phlox Copilot (⌘K)'}
          className={btnClassName}
          style={{
            ...btnStyle, touchAction: 'none',
            width: 52, height: 52, borderRadius: '50%', border: '1px solid #23262d',
            background: '#16181d', color: 'white', cursor: 'grab', boxShadow: '0 6px 24px rgba(22,24,29,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
          }}>✦
          {ctxLabel && <span style={{ position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: '50%', background: '#0d6e42', border: '2px solid white' }} />}
        </button>
      )}
      <style>{`
        @media (max-width: 768px) {
          .copilot-fab-avoid-nav { bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 14px) !important; }
          .copilot-panel-avoid-nav { bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 14px) !important; }
        }
      `}</style>

      {open && (
        <div className={hasBottomNav ? 'copilot-panel copilot-panel-avoid-nav' : 'copilot-panel'} style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9001,
          width: 'min(400px, calc(100vw - 32px))', height: 'min(560px, calc(100vh - 100px))',
          background: 'white', border: '1px solid #e7e8ea', borderRadius: 14,
          boxShadow: '0 16px 48px rgba(22,24,29,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #e7e8ea' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#0d6e42', fontSize: 16 }}>✦</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Phlox Copilot</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              {msgs.length > 0 && (
                <button onClick={limparConversa} title="Começar uma conversa nova"
                  style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11.5, color: '#6b7280', fontFamily: 'inherit', padding: '4px 8px' }}>
                  Limpar
                </button>
              )}
            <button aria-label="Fechar" onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#8b8f99' }}>×</button>
            </div>
          </div>

          {/* Mensagens */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ctxLabel && usarPagina && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#0d6e42', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 10px' }}>
                <span>👁</span> Estou a ver: <b>{ctxLabel}</b>
                <button onClick={() => setUsarPagina(false)} aria-label="Deixar de usar o que estou a ver"
                  title="Deixar de usar o que estou a ver"
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: 13, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )}
            {activeProf && activeProf.type !== 'self' && usarPerfil && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: activeProf.type === 'patient' ? '#1e40af' : '#7c3aed', background: activeProf.type === 'patient' ? '#eff6ff' : '#faf5ff', border: `1px solid ${activeProf.type === 'patient' ? '#bfdbfe' : '#e9d5ff'}`, borderRadius: 8, padding: '6px 10px' }}>
                <span>{activeProf.type === 'patient' ? '🧑‍⚕️' : '👥'}</span> Em foco: <b>{activeProf.name}</b>
                <button onClick={() => setUsarPerfil(false)} aria-label="Largar esta pessoa"
                  title="Largar esta pessoa — a conversa deixa de ser sobre ela"
                  style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, fontSize: 13, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )}
            {/* Largado por engano? Volta a pegar. */}
            {((!usarPagina && ctxLabel) || (!usarPerfil && activeProf && activeProf.type !== 'self')) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {!usarPagina && ctxLabel && (
                  <button onClick={() => setUsarPagina(true)} style={chipVolta}>+ usar o que estou a ver</button>
                )}
                {!usarPerfil && activeProf && activeProf.type !== 'self' && (
                  <button onClick={() => setUsarPerfil(true)} style={chipVolta}>+ falar de {activeProf.name.split(' ')[0]}</button>
                )}
              </div>
            )}
            {msgs.length === 0 && (
              <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                Pergunta-me qualquer coisa sobre o que estás a ver. Sei em que página estás{ctxLabel ? ', o que abriste' : ''}{selection ? ' e o que selecionaste' : ''}.
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {proactiveSuggestions(ctxLabel, pathname, activeProf).map(s => (
                    <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', padding: '8px 10px', background: '#f6f7f8', border: '1px solid #e7e8ea', borderRadius: 8, cursor: 'pointer', fontSize: 12.5, color: '#374151' }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                {m.usedTool && TOOL_BADGE[m.usedTool] && (
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#0d6e42', marginBottom: 3 }}>{TOOL_BADGE[m.usedTool]}</div>
                )}
                <div style={{
                  padding: '9px 12px', borderRadius: 10, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
                  background: m.role === 'user' ? '#16181d' : '#f6f7f8',
                  color: m.role === 'user' ? 'white' : '#16181d',
                }}>{m.content}</div>
                {m.proposedAction && (
                  m.actionDone ? (
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0d6e42', marginTop: 5 }}>✓ Feito</div>
                  ) : (
                    <button onClick={() => confirmAction(i, m.proposedAction!)} style={{ marginTop: 5, padding: '6px 12px', background: 'white', border: '1.5px solid #0d6e42', color: '#0d6e42', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {m.proposedAction.type === 'save_summary' ? '💾 ' : '🙋 '}{m.proposedAction.label}
                    </button>
                  )
                )}
                {m.actionError && <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 5 }}>{m.actionError}</div>}
              </div>
            ))}
            {busy && <div style={{ alignSelf: 'flex-start', color: '#8b8f99', fontSize: 13 }}>A pensar…</div>}
          </div>

          {/* Input */}
          <div style={{ padding: 10, borderTop: '1px solid #e7e8ea' }}>
            {selection && <div style={{ fontSize: 11, color: '#6d28d9', marginBottom: 6, background: '#faf5ff', padding: '4px 8px', borderRadius: 6 }}>↳ com a tua seleção</div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Pergunta…" rows={1}
                style={{ flex: 1, resize: 'none', padding: '9px 11px', border: '1px solid #e7e8ea', borderRadius: 8, fontSize: 13.5, fontFamily: 'inherit', maxHeight: 100, boxSizing: 'border-box' }} />
              {/* Ditar em vez de escrever. Numa sala de cuidados escreve-se de
                  pé, com uma mão e o telemóvel na outra — falar é mais rápido
                  e mais provável de acontecer. O texto ditado fica no campo
                  para se poder corrigir antes de enviar; nunca envia sozinho. */}
              <MicButton size={36} onTranscript={t => setInput(v => (v ? v.trim() + ' ' : '') + t)} />
              <button onClick={() => send()} disabled={busy || !input.trim()} style={{
                padding: '9px 14px', background: '#16181d', color: 'white', border: 'none', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: busy || !input.trim() ? 0.5 : 1,
              }}>↑</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
