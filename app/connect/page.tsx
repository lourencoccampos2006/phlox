'use client'

// ─── PHLOX CONNECT ────────────────────────────────────────────────────────────
// Comunicação clínica inter-profissional global.
// Qualquer profissional com conta Phlox pode contactar qualquer outro.
// Com diretório de profissionais — encontra um farmacêutico em Lisboa por nome.
// Não é uma rede social. É comunicação clínica estruturada e auditável.

import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsultType = 'interaction' | 'dose' | 'alternative' | 'adherence' | 'monitoring' | 'reconciliation' | 'other'
type ConsultStatus = 'pending' | 'accepted' | 'rejected' | 'resolved' | 'in_discussion'
type UserRole = 'pharmacist' | 'physician' | 'nurse' | 'intern' | 'other'

interface Professional {
  id: string
  display_name: string
  professional_role: UserRole
  institution: string | null
  speciality: string | null
}

interface ClinicalConsult {
  id: string
  from_user_id: string
  from_name: string
  from_role: UserRole
  to_role: UserRole
  to_user_id: string | null
  to_name: string | null
  patient_name: string
  patient_age?: number
  consult_type: ConsultType
  subject: string
  body: string
  medications: string[]
  priority: 'urgent' | 'high' | 'normal'
  status: ConsultStatus
  response?: string
  response_at?: string
  responded_by?: string
  created_at: string
  ai_suggestion?: string
  message_count?: number
}

interface ConnectMessage {
  id: string
  from_user_id: string
  from_name: string
  from_role: string | null
  content: string
  is_system: boolean
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<ConsultType, { label: string; color: string }> = {
  interaction:    { label: 'Interação medicamentosa',  color: '#dc2626' },
  dose:           { label: 'Ajuste de dose',           color: '#d97706' },
  alternative:    { label: 'Alternativa terapêutica',  color: '#1d4ed8' },
  adherence:      { label: 'Problema de adesão',       color: '#7c3aed' },
  monitoring:     { label: 'Monitorização',            color: '#0891b2' },
  reconciliation: { label: 'Reconciliação',            color: '#0d6e42' },
  other:          { label: 'Outra consulta',           color: '#374151' },
}

const STATUS_META: Record<ConsultStatus, { label: string; color: string; bg: string }> = {
  pending:       { label: 'Aguarda resposta',  color: '#d97706', bg: '#fffbeb' },
  accepted:      { label: 'Aceite',            color: '#0d6e42', bg: '#f0fdf5' },
  rejected:      { label: 'Não aceite',        color: '#dc2626', bg: '#fee2e2' },
  resolved:      { label: 'Resolvido',         color: '#374151', bg: 'var(--bg-2)' },
  in_discussion: { label: 'Em discussão',      color: '#1d4ed8', bg: '#eff6ff' },
}

const PRIORITY_META = {
  urgent: { label: 'Urgente', color: '#991b1b', bg: '#fee2e2' },
  high:   { label: 'Alta',    color: '#854d0e', bg: '#fef9c3' },
  normal: { label: 'Normal',  color: '#374151', bg: 'var(--bg-2)' },
}

const ROLE_LABELS: Record<UserRole, string> = {
  pharmacist: 'Farmacêutico', physician: 'Médico',
  nurse: 'Enfermeiro', intern: 'Interno', other: 'Outro',
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Professional Directory ───────────────────────────────────────────────────

function ProfessionalDirectory({ onSelect }: { onSelect: (p: Professional) => void }) {
  const { supabase } = useAuth()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<UserRole | 'all'>('all')
  const [results, setResults] = useState<Professional[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('profiles')
      .select('id, display_name, professional_role, institution, speciality')
      .eq('connect_visible', true)
      .not('display_name', 'is', null)

    if (role !== 'all') q = q.eq('professional_role', role)
    if (query.trim()) q = q.ilike('display_name', `%${query.trim()}%`)

    const { data } = await q.limit(20)
    setResults((data || []).filter((p: any) => p.display_name))
    setLoading(false)
  }, [supabase, query, role])

  useEffect(() => { search() }, [role])

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          Diretório de profissionais
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="Nome, instituição, especialidade..."
            style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <select value={role} onChange={e => setRole(e.target.value as any)}
            style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '8px 10px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', cursor: 'pointer' }}>
            <option value="all">Todos os papéis</option>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={search} disabled={loading}
            style={{ padding: '8px 14px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
            Pesquisar
          </button>
        </div>
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>A pesquisar...</div>
        ) : results.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: 13, color: 'var(--ink-4)' }}>
            Nenhum profissional encontrado. Os profissionais precisam de activar a visibilidade nas definições de perfil.
          </div>
        ) : results.map((p, i) => (
          <button key={p.id} onClick={() => onSelect(p)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: 'white', border: 'none', borderBottom: i < results.length - 1 ? '1px solid var(--bg-3)' : 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
            className="dir-item">
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
              {p.display_name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.display_name}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', marginTop: 1 }}>
                {ROLE_LABELS[p.professional_role as UserRole] || p.professional_role}
                {p.institution && <span> · {p.institution}</span>}
                {p.speciality && <span> · {p.speciality}</span>}
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Consult thread view ──────────────────────────────────────────────────────

function ConsultThread({ consult, userId, supabase, myName, myRole, onUpdate }: {
  consult: ClinicalConsult; userId: string; supabase: any
  myName: string; myRole: UserRole; onUpdate: (c: ClinicalConsult) => void
}) {
  const [messages, setMessages] = useState<ConnectMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const t = TYPE_META[consult.consult_type]
  const s = STATUS_META[consult.status]
  const p = PRIORITY_META[consult.priority]
  const isOwn = consult.from_user_id === userId
  const canRespond = !isOwn && consult.status === 'pending'

  useEffect(() => {
    supabase.from('connect_messages').select('*').eq('consult_id', consult.id)
      .order('created_at', { ascending: true })
      .then(({ data }: any) => { setMessages(data || []); setLoading(false) })

    const channel = supabase
      .channel(`connect-${consult.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connect_messages', filter: `consult_id=eq.${consult.id}` },
        (payload: any) => setMessages(prev => [...prev, payload.new as ConnectMessage])
      ).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [consult.id, supabase])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    await supabase.from('connect_messages').insert({
      consult_id: consult.id, from_user_id: userId,
      from_name: myName, from_role: myRole, content: input.trim()
    })
    setInput('')
    setSending(false)
    // Update status to in_discussion
    if (consult.status === 'pending' && !isOwn) {
      await supabase.from('clinical_consults').update({ status: 'in_discussion' }).eq('id', consult.id)
      onUpdate({ ...consult, status: 'in_discussion' })
    }
  }

  const respond = async (accepted: boolean, text: string) => {
    const newStatus: ConsultStatus = accepted ? 'accepted' : 'rejected'
    await supabase.from('clinical_consults').update({
      status: newStatus, response: text,
      responded_by: myName, response_at: new Date().toISOString(),
    }).eq('id', consult.id)
    await supabase.from('connect_messages').insert({
      consult_id: consult.id, from_user_id: userId, from_name: myName,
      from_role: myRole, is_system: true,
      content: `${myName} ${accepted ? 'aceitou' : 'não aceitou'} a recomendação.${text ? ' ' + text : ''}`,
    })
    onUpdate({ ...consult, status: newStatus, response: text })
  }

  const resolve = async () => {
    await supabase.from('clinical_consults').update({ status: 'resolved' }).eq('id', consult.id)
    onUpdate({ ...consult, status: 'resolved' })
  }

  return (
    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{consult.subject}</span>
              {consult.priority !== 'normal' && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: p.color, background: p.bg, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.label}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>
                {consult.from_name} → {consult.to_name || ROLE_LABELS[consult.to_role]}
              </span>
              <span style={{ fontSize: 9, color: t.color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.label}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: s.color, background: s.bg, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase', marginLeft: 'auto' }}>{s.label}</span>
            </div>
          </div>
          {isOwn && consult.status !== 'resolved' && (
            <button onClick={resolve}
              style={{ padding: '5px 10px', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
              Resolver
            </button>
          )}
        </div>

        {/* Patient + medications */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            Doente: {consult.patient_name}{consult.patient_age ? `, ${consult.patient_age}a` : ''}
          </span>
          {consult.medications?.map(m => (
            <span key={m} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 3 }}>{m}</span>
          ))}
        </div>
      </div>

      {/* Initial body */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-3)' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>
            {consult.from_name.charAt(0)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{consult.from_name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{ROLE_LABELS[consult.from_role]}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', marginLeft: 'auto' }}>{timeAgo(consult.created_at)}</span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, margin: 0 }}>{consult.body}</p>
            {consult.ai_suggestion && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 7 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Análise Phlox</div>
                <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.6 }}>{consult.ai_suggestion}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thread messages */}
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: '10px 18px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>A carregar...</div>
        ) : messages.map(msg => (
          <div key={msg.id} style={{ display: 'flex', gap: 10, marginBottom: 10, justifyContent: msg.from_user_id === userId ? 'flex-end' : 'flex-start' }}>
            {msg.from_user_id !== userId && (
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.is_system ? '#f0fdf5' : 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: msg.is_system ? '#0d6e42' : 'var(--ink-3)', flexShrink: 0 }}>
                {msg.from_name.charAt(0)}
              </div>
            )}
            <div style={{ maxWidth: '75%', padding: '9px 13px', background: msg.is_system ? '#f0fdf5' : msg.from_user_id === userId ? 'var(--ink)' : 'white', border: `1px solid ${msg.is_system ? '#bbf7d0' : msg.from_user_id === userId ? 'transparent' : 'var(--border)'}`, borderRadius: msg.from_user_id === userId ? '12px 12px 4px 12px' : msg.is_system ? 8 : '4px 12px 12px 12px' }}>
              {msg.from_user_id !== userId && !msg.is_system && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{msg.from_name}</div>
              )}
              <div style={{ fontSize: 13, color: msg.is_system ? '#0d6e42' : msg.from_user_id === userId ? 'white' : 'var(--ink)', lineHeight: 1.5 }}>{msg.content}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Response controls — for non-owner when pending */}
      {canRespond && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', background: '#fffbeb' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Responder à recomendação</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { const t = prompt('Comentário (opcional):') || ''; respond(true, t) }}
              style={{ flex: 1, padding: '8px', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Aceitar recomendação
            </button>
            <button onClick={() => { const t = prompt('Motivo (opcional):') || ''; respond(false, t) }}
              style={{ flex: 1, padding: '8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Não aceitar
            </button>
          </div>
        </div>
      )}

      {/* Message input */}
      {consult.status !== 'resolved' && (
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Adicionar comentário..."
            style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            style={{ padding: '9px 16px', background: input.trim() ? 'var(--ink)' : 'var(--bg-3)', color: input.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
            Enviar
          </button>
        </div>
      )}
    </div>
  )
}

// ─── New consult form ─────────────────────────────────────────────────────────

function NewConsultForm({ myRole, myName, supabase, onSubmit, onCancel }: {
  myRole: UserRole; myName: string; supabase: any
  onSubmit: (c: Partial<ClinicalConsult>) => Promise<void>
  onCancel: () => void
}) {
  const [step, setStep] = useState<'recipient' | 'form'>('recipient')
  const [selectedPro, setSelectedPro] = useState<Professional | null>(null)
  const [broadcastRole, setBroadcastRole] = useState<UserRole>('physician')
  const [form, setForm] = useState({
    consult_type: 'interaction' as ConsultType,
    patient_name: '', patient_age: '',
    subject: '', body: '', medications: '',
    priority: 'normal' as 'urgent' | 'high' | 'normal',
  })
  const [analysing, setAnalysing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const analyse = async () => {
    if (!form.body.trim()) return
    setAnalysing(true)
    try {
      const { aiComplete } = await import('@/lib/ai')
      const result = await aiComplete([
        { role: 'system', content: 'Es um farmacologista clínico. Analisa a situação em 2-3 frases com evidência. PT-PT.' },
        { role: 'user', content: `${form.consult_type}: ${form.body}. Meds: ${form.medications}` }
      ], { maxTokens: 250, temperature: 0.2 })
      setAiSuggestion((result as { content?: string }).content ?? '')
    } catch {}
    setAnalysing(false)
  }

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.body.trim() || !form.patient_name.trim()) return
    setSubmitting(true)
    await onSubmit({
      from_role: myRole, from_name: myName,
      to_role: selectedPro?.professional_role as UserRole || broadcastRole,
      to_user_id: selectedPro?.id || null,
      to_name: selectedPro?.display_name || null,
      patient_name: form.patient_name,
      patient_age: form.patient_age ? parseInt(form.patient_age) : undefined,
      consult_type: form.consult_type,
      subject: form.subject, body: form.body,
      medications: form.medications.split('\n').filter(Boolean),
      priority: form.priority,
      ai_suggestion: aiSuggestion || undefined,
      status: 'pending',
    })
    setSubmitting(false)
  }

  const input_s = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }
  const label_s = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 5, display: 'block' }

  if (step === 'recipient') return (
    <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Nova consulta · Passo 1: Para quem?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>
          Encontra um profissional específico ou envia a todos os do papel seleccionado.
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <ProfessionalDirectory onSelect={p => { setSelectedPro(p); setStep('form') }} />
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 10 }}>Ou enviar a todos os profissionais do papel:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.entries(ROLE_LABELS) as [UserRole, string][]).filter(([k]) => k !== myRole).map(([k, v]) => (
              <button key={k} onClick={() => setBroadcastRole(k)}
                style={{ padding: '7px 14px', border: `1.5px solid ${broadcastRole === k ? 'var(--ink)' : 'var(--border)'}`, borderRadius: 6, background: broadcastRole === k ? 'var(--ink)' : 'white', color: broadcastRole === k ? 'white' : 'var(--ink-3)', cursor: 'pointer', fontSize: 12, fontWeight: broadcastRole === k ? 700 : 400, fontFamily: 'var(--font-sans)' }}>
                {v}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { setSelectedPro(null); setStep('form') }}
              style={{ padding: '10px 18px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Enviar a {ROLE_LABELS[broadcastRole]}s →
            </button>
            <button onClick={onCancel}
              style={{ padding: '10px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-sans)' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'white', border: '1.5px solid var(--ink)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <button onClick={() => setStep('recipient')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 13, fontFamily: 'var(--font-sans)', padding: 0 }}>
          ← Alterar destinatário
        </button>
        <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700 }}>
          Para: {selectedPro ? selectedPro.display_name : `Todos os ${ROLE_LABELS[broadcastRole]}s`}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={label_s}>Tipo de consulta</label>
          <select value={form.consult_type} onChange={e => set('consult_type', e.target.value)} style={{ ...input_s, background: 'white' }}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={label_s}>Prioridade</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} style={{ ...input_s, background: 'white' }}>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>
        <div>
          <label style={label_s}>Nome do doente *</label>
          <input value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Ex: A.M.S." style={input_s} />
        </div>
        <div>
          <label style={label_s}>Idade</label>
          <input type="number" value={form.patient_age} onChange={e => set('patient_age', e.target.value)} placeholder="Ex: 68" style={input_s} />
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label_s}>Assunto *</label>
        <input value={form.subject} onChange={e => set('subject', e.target.value)}
          placeholder="Ex: Interação grave warfarina + ibuprofeno — risco hemorrágico elevado" style={input_s} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={label_s}>Medicamentos (um por linha)</label>
        <textarea value={form.medications} onChange={e => set('medications', e.target.value)}
          placeholder={'Warfarina 5mg\nIbuprofeno 400mg SOS'} rows={2}
          style={{ ...input_s, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6 }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_s}>Descrição e recomendação *</label>
        <textarea value={form.body} onChange={e => set('body', e.target.value)}
          placeholder="Descreve o problema identificado e a tua recomendação terapêutica..."
          rows={3} style={{ ...input_s, resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      {aiSuggestion && (
        <div style={{ padding: '10px 13px', background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Análise Phlox</div>
          <div style={{ fontSize: 12, color: '#14532d', lineHeight: 1.6 }}>{aiSuggestion}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} disabled={submitting || !form.subject.trim() || !form.body.trim() || !form.patient_name.trim()}
          style={{ flex: 1, padding: '11px', background: form.subject.trim() && form.body.trim() ? 'var(--ink)' : 'var(--bg-3)', color: form.subject.trim() && form.body.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          {submitting ? 'A enviar...' : 'Enviar consulta →'}
        </button>
        <button onClick={() => { if (form.body.trim()) analyse() }}
          style={{ padding: '11px 14px', background: 'white', color: '#0d6e42', border: '1px solid #bbf7d0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          {analysing ? '...' : 'Análise AI'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '11px 14px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ConnectPage() {
  const { user, supabase } = useAuth()
  const [consults, setConsults] = useState<ClinicalConsult[]>([])
  const [loading, setLoading] = useState(true)
  const [composing, setComposing] = useState(false)
  const [selected, setSelected] = useState<ClinicalConsult | null>(null)
  const [myRole, setMyRole] = useState<UserRole>('pharmacist')
  const [tab, setTab] = useState<'inbox' | 'sent' | 'all'>('inbox')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const load = useCallback(async () => {
    if (!user || !isPro) { setLoading(false); return }
    const [{ data: ownData }, { data: globalData }] = await Promise.all([
      supabase.from('clinical_consults').select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('clinical_consults').select('*')
        .eq('to_role', myRole).is('to_user_id', null).neq('from_user_id', user.id)
        .order('created_at', { ascending: false }).limit(20),
    ])
    const seen = new Set<string>()
    const all = [...(ownData || []), ...(globalData || [])].filter(c => {
      if (seen.has(c.id)) return false; seen.add(c.id); return true
    })
    setConsults(all)
    setLoading(false)
  }, [user, supabase, isPro, myRole])

  useEffect(() => { load() }, [load])

  // Real-time new consults
  useEffect(() => {
    if (!user || !isPro) return
    const channel = supabase
      .channel('connect-new')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clinical_consults' },
        (payload: any) => {
          const c = payload.new as ClinicalConsult
          if (c.from_user_id === user.id || c.to_user_id === user.id || (c.to_role === myRole && !c.to_user_id)) {
            setConsults(prev => [c, ...prev.filter(x => x.id !== c.id)])
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, supabase, isPro, myRole])

  const handleSubmit = async (c: Partial<ClinicalConsult>) => {
    if (!user) return
    const { data } = await supabase.from('clinical_consults').insert({
      ...c, from_user_id: user.id,
      from_name: user.name || user.email || 'Profissional',
    }).select().single()
    if (data) { setConsults(p => [data, ...p]); setComposing(false) }
  }

  const updateConsult = (updated: ClinicalConsult) => {
    setConsults(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  const filtered = consults.filter(c => {
    if (tab === 'inbox') return c.from_user_id !== user?.id
    if (tab === 'sent') return c.from_user_id === user?.id
    return true
  })

  const pendingCount = consults.filter(c => c.status === 'pending' && c.from_user_id !== user?.id).length

  const tabStyle = (t: string) => ({
    padding: '9px 16px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? 'var(--ink)' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? 'var(--ink)' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1,
  })

  if (!isPro) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '56px 36px', textAlign: 'center' }}>
          <div className="eyebrow" style={{ justifyContent: 'center', marginBottom: 16 }}>Phlox Connect</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 12 }}>
            Comunicação clínica entre profissionais.
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 28, maxWidth: 420, margin: '0 auto 28px' }}>
            Encontra qualquer farmacêutico, médico ou enfermeiro com conta Phlox. Envias a consulta — eles respondem. Auditável e estruturado. Pro e Institucional.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '13px 32px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Activar Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div className="eyebrow" style={{ color: '#475569', marginBottom: 6 }}>Phlox Connect · Comunicação Inter-Profissional</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#f8fafc', fontWeight: 400 }}>
                Consultas clínicas
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={myRole} onChange={e => setMyRole(e.target.value as UserRole)}
                style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer' }}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => { setSelected(null); setComposing(true) }}
                style={{ padding: '9px 18px', background: '#22c55e', color: '#0f172a', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap' }}>
                Nova consulta
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid #1e293b' }}>
            {([['inbox','Recebidas'], ['sent','Enviadas'], ['all','Todas']] as const).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                style={{ ...tabStyle(id), color: tab === id ? '#f8fafc' : '#475569', borderBottomColor: tab === id ? '#22c55e' : 'transparent' }}>
                {label}
                {id === 'inbox' && pendingCount > 0 && (
                  <span style={{ marginLeft: 6, background: '#dc2626', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 10, fontFamily: 'var(--font-mono)' }}>{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Split layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', flex: 1, overflow: 'hidden', height: 'calc(100vh - 120px)' }} className="connect-grid">
        {/* List */}
        <div style={{ background: 'white', borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          {composing && !selected && (
            <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', background: '#fffbeb' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#854d0e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>A redigir nova consulta...</div>
            </div>
          )}
          {loading ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0,1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 6 }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-4)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                {tab === 'inbox' ? 'Sem consultas recebidas' : 'Sem consultas enviadas'}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                {tab === 'inbox' ? 'As consultas de outros profissionais aparecem aqui — incluindo consultas gerais enviadas para o teu papel.' : 'Clica em "Nova consulta" para contactar um colega.'}
              </div>
            </div>
          ) : filtered.map(c => {
            const t = TYPE_META[c.consult_type]
            const s = STATUS_META[c.status]
            const isOwn = c.from_user_id === user?.id
            return (
              <button key={c.id} onClick={() => { setSelected(c); setComposing(false) }}
                style={{ width: '100%', display: 'flex', gap: 10, padding: '11px 14px', background: selected?.id === c.id ? 'var(--bg)' : 'white', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.status === 'pending' && !isOwn ? '#d97706' : c.status === 'accepted' ? '#0d6e42' : 'var(--bg-3)', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{c.subject}</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isOwn ? `Para: ${c.to_name || ROLE_LABELS[c.to_role]}` : `De: ${c.from_name}`} · {c.patient_name}
                  </div>
                </div>
                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{timeAgo(c.created_at)}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detail */}
        <div style={{ overflowY: 'auto', padding: '16px 20px' }}>
          {composing ? (
            <NewConsultForm myRole={myRole} myName={user?.name || user?.email || 'Profissional'} supabase={supabase}
              onSubmit={handleSubmit} onCancel={() => setComposing(false)} />
          ) : selected ? (
            <ConsultThread consult={selected} userId={user?.id || ''} supabase={supabase}
              myName={user?.name || 'Profissional'} myRole={myRole} onUpdate={updateConsult} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-4)', gap: 10 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', textAlign: 'center' }}>Selecciona uma consulta</div>
              <div style={{ fontSize: 13, color: 'var(--ink-4)', textAlign: 'center', maxWidth: 300, lineHeight: 1.6 }}>
                Ou cria uma nova para contactar um colega de qualquer instituição.
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dir-item:hover { background: var(--bg) !important; }
        @media (max-width: 768px) { .connect-grid { grid-template-columns: 1fr !important; height: auto !important; } }
      `}</style>
    </div>
  )
}