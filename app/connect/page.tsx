'use client'

// ─── PHLOX CONNECT ────────────────────────────────────────────────────────────
// A comunicação clínica entre profissionais que ainda não existe em Portugal.
// Farmacêutico identifica problema → envia consulta directa ao médico → médico
// responde dentro do contexto clínico do doente → tudo auditável e registado.
// Não é WhatsApp. É comunicação clínica estruturada com contexto farmacológico.
// Substitui o fax, o telefonema, e o "vou falar com ele na próxima semana".

import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/Header'
import { useAuth } from '@/components/AuthContext'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsultType = 'interaction' | 'dose' | 'alternative' | 'adherence' | 'monitoring' | 'reconciliation' | 'other'
type ConsultStatus = 'pending' | 'accepted' | 'rejected' | 'resolved'
type UserRole = 'pharmacist' | 'physician' | 'nurse' | 'intern' | 'other'

interface ClinicalConsult {
  id: string
  from_user_id: string
  from_name: string
  from_role: UserRole
  to_role: UserRole
  to_user_id?: string
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
}

// ─── Style constants ──────────────────────────────────────────────────────────

const TYPE_META: Record<ConsultType, { label: string; icon: string; color: string }> = {
  interaction:    { label: 'Interação medicamentosa',  icon: '⚡', color: '#dc2626' },
  dose:           { label: 'Ajuste de dose',           icon: '💊', color: '#d97706' },
  alternative:    { label: 'Alternativa terapêutica',  icon: '🔄', color: '#1d4ed8' },
  adherence:      { label: 'Problema de adesão',       icon: '📋', color: '#7c3aed' },
  monitoring:     { label: 'Monitorização',            icon: '🔬', color: '#0891b2' },
  reconciliation: { label: 'Reconciliação',            icon: '⚖️', color: '#0d6e42' },
  other:          { label: 'Outra consulta',           icon: '💬', color: '#374151' },
}

const STATUS_META: Record<ConsultStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:  { label: 'Aguarda resposta', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  accepted: { label: 'Aceite',           color: '#0d6e42', bg: '#f0fdf5', border: '#bbf7d0' },
  rejected: { label: 'Não aceite',       color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  resolved: { label: 'Resolvido',        color: '#374151', bg: 'var(--bg-2)', border: 'var(--border)' },
}

const PRIORITY_META = {
  urgent: { label: '🚨 Urgente',  color: '#991b1b', bg: '#fee2e2' },
  high:   { label: '⚠️ Alta',     color: '#854d0e', bg: '#fef9c3' },
  normal: { label: '📋 Normal',   color: '#374151', bg: 'var(--bg-2)' },
}

const ROLE_LABELS: Record<UserRole, string> = {
  pharmacist: '💊 Farmacêutico', physician: '⚕️ Médico',
  nurse: '💉 Enfermeiro', intern: '🎓 Interno', other: '👤 Outro',
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return `${Math.floor(diff / 60000)}m`
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── ConsultCard ──────────────────────────────────────────────────────────────

function ConsultCard({ consult, isOwn, onRespond, onResolve }: {
  consult: ClinicalConsult; isOwn: boolean
  onRespond: (id: string, text: string, status: ConsultStatus) => void
  onResolve: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [response, setResponse] = useState('')
  const [responding, setResponding] = useState(false)
  const t = TYPE_META[consult.consult_type]
  const s = STATUS_META[consult.status]
  const p = PRIORITY_META[consult.priority]

  return (
    <div style={{ background: 'white', border: `1px solid ${consult.status === 'pending' && !isOwn ? '#fde68a' : 'var(--border)'}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <div onClick={() => setExpanded(!expanded)}
        style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ fontSize: 22, flexShrink: 0 }}>{t.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{consult.subject}</span>
            {consult.priority !== 'normal' && (
              <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.color, background: p.bg, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em' }}>{p.label}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
              {ROLE_LABELS[consult.from_role]} · {consult.patient_name}{consult.patient_age ? `, ${consult.patient_age}a` : ''}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{s.label}</span>
            <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{timeAgo(consult.created_at)}</span>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0, marginTop: 4 }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
          {/* Body */}
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 12 }}>{consult.body}</p>

          {/* Medications */}
          {consult.medications.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {consult.medications.map((m, i) => (
                <span key={i} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 4 }}>{m}</span>
              ))}
            </div>
          )}

          {/* AI Suggestion */}
          {consult.ai_suggestion && (
            <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                🤖 Análise Phlox
              </div>
              <div style={{ fontSize: 13, color: '#14532d', lineHeight: 1.6 }}>{consult.ai_suggestion}</div>
            </div>
          )}

          {/* Response */}
          {consult.response && (
            <div style={{ background: consult.status === 'accepted' ? '#f0fdf5' : '#fef2f2', border: `1px solid ${consult.status === 'accepted' ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: consult.status === 'accepted' ? '#0d6e42' : '#dc2626', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                {consult.status === 'accepted' ? '✓ Aceite' : '✗ Não aceite'} · {consult.responded_by}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.6 }}>{consult.response}</div>
            </div>
          )}

          {/* Response form — for the receiving side */}
          {!isOwn && consult.status === 'pending' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>A tua resposta</div>
              <textarea value={response} onChange={e => setResponse(e.target.value)}
                placeholder="Responde à consulta do colega..."
                rows={3}
                style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.6, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setResponding(true); onRespond(consult.id, response, 'accepted'); setResponding(false) }}
                  style={{ flex: 1, padding: '9px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  ✓ Aceitar recomendação
                </button>
                <button onClick={() => { setResponding(true); onRespond(consult.id, response, 'rejected'); setResponding(false) }}
                  style={{ flex: 1, padding: '9px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
                  ✗ Não aceitar
                </button>
              </div>
            </div>
          )}

          {/* Resolve */}
          {isOwn && consult.status !== 'pending' && consult.status !== 'resolved' && (
            <button onClick={() => onResolve(consult.id)}
              style={{ width: '100%', padding: '8px', background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', marginTop: 8 }}>
              Marcar como resolvido
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New consult form ─────────────────────────────────────────────────────────

function NewConsultForm({ myRole, myName, onSubmit, onCancel }: {
  myRole: UserRole; myName: string
  onSubmit: (c: Partial<ClinicalConsult>) => Promise<void>
  onCancel: () => void
}) {
  const { supabase } = useAuth()
  const [form, setForm] = useState({
    consult_type: 'interaction' as ConsultType,
    to_role: 'physician' as UserRole,
    patient_name: '', patient_age: '',
    subject: '', body: '',
    medications: '', priority: 'normal' as 'urgent' | 'high' | 'normal',
  })
  const [analysing, setAnalysing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const analyse = async () => {
    if (!form.body.trim() || !form.medications.trim()) return
    setAnalysing(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/connect/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ type: form.consult_type, body: form.body, medications: form.medications, patient_age: form.patient_age }),
      })
      const data = await res.json()
      if (data.suggestion) setAiSuggestion(data.suggestion)
    } catch {}
    setAnalysing(false)
  }

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.body.trim() || !form.patient_name.trim()) return
    setSubmitting(true)
    await onSubmit({
      from_role: myRole, from_name: myName,
      to_role: form.to_role,
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

  const input_style = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }
  const label_style = { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginBottom: 6, display: 'block' }

  return (
    <div style={{ background: 'white', border: '2px solid var(--ink)', borderRadius: 12, padding: 22 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
        Nova consulta inter-profissional
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={label_style}>Tipo de consulta</label>
          <select value={form.consult_type} onChange={e => set('consult_type', e.target.value)} style={{ ...input_style, background: 'white' }}>
            {Object.entries(TYPE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={label_style}>Dirigida a</label>
          <select value={form.to_role} onChange={e => set('to_role', e.target.value)} style={{ ...input_style, background: 'white' }}>
            {Object.entries(ROLE_LABELS).filter(([k]) => k !== myRole).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label style={label_style}>Nome do doente</label>
          <input value={form.patient_name} onChange={e => set('patient_name', e.target.value)} placeholder="Ex: M.S." style={input_style} />
        </div>
        <div>
          <label style={label_style}>Idade</label>
          <input type="number" value={form.patient_age} onChange={e => set('patient_age', e.target.value)} placeholder="Ex: 72" style={input_style} />
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_style}>Assunto *</label>
        <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Ex: Interação grave ibuprofeno + varfarina — risco hemorrágico elevado" style={input_style} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_style}>Medicamentos envolvidos (um por linha)</label>
        <textarea value={form.medications} onChange={e => set('medications', e.target.value)}
          placeholder={'Varfarina 5mg\nIbuprofeno 400mg SOS'} rows={3}
          style={{ ...input_style, resize: 'vertical', lineHeight: 1.6, fontFamily: 'var(--font-mono)' }} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={label_style}>Descrição do problema e recomendação *</label>
        <textarea value={form.body} onChange={e => set('body', e.target.value)}
          placeholder="Descreve o problema identificado e a tua recomendação terapêutica..."
          rows={4} style={{ ...input_style, resize: 'vertical', lineHeight: 1.6 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <label style={label_style}>Prioridade</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['normal', 'high', 'urgent'] as const).map(p => (
              <button key={p} onClick={() => set('priority', p)}
                style={{ padding: '6px 12px', border: `1.5px solid ${form.priority === p ? PRIORITY_META[p].color : 'var(--border)'}`, borderRadius: 6, background: form.priority === p ? PRIORITY_META[p].bg : 'white', cursor: 'pointer', fontSize: 12, fontWeight: form.priority === p ? 700 : 400, color: form.priority === p ? PRIORITY_META[p].color : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
                {PRIORITY_META[p].label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={analyse} disabled={analysing || !form.body.trim()}
          style={{ padding: '8px 14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', marginTop: 14, opacity: form.body.trim() ? 1 : 0.5 }}>
          {analysing ? 'A analisar...' : '🤖 Análise Phlox'}
        </button>
      </div>

      {aiSuggestion && (
        <div style={{ background: '#f0fdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#0d6e42', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>🤖 Análise Phlox</div>
          <div style={{ fontSize: 13, color: '#14532d', lineHeight: 1.6 }}>{aiSuggestion}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSubmit} disabled={submitting || !form.subject.trim() || !form.body.trim() || !form.patient_name.trim()}
          style={{ flex: 1, padding: '12px', background: form.subject.trim() && form.body.trim() ? 'var(--ink)' : 'var(--bg-3)', color: form.subject.trim() && form.body.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
          {submitting ? 'A enviar...' : 'Enviar consulta →'}
        </button>
        <button onClick={onCancel}
          style={{ padding: '12px 18px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-sans)' }}>
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
  const [myRole, setMyRole] = useState<UserRole>('pharmacist')
  const [tab, setTab] = useState<'inbox' | 'sent' | 'all'>('inbox')

  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'

  const load = useCallback(async () => {
    if (!user || !isPro) { setLoading(false); return }
    const { data } = await supabase.from('clinical_consults').select('*').or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`).order('created_at', { ascending: false }).limit(50)
    setConsults(data || [])
    setLoading(false)
  }, [user, supabase, isPro])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (c: Partial<ClinicalConsult>) => {
    if (!user) return
    const { data } = await supabase.from('clinical_consults').insert({
      ...c, from_user_id: user.id,
      from_name: user.name || user.email || 'Profissional',
    }).select().single()
    if (data) { setConsults(p => [data, ...p]); setComposing(false) }
  }

  const handleRespond = async (id: string, text: string, status: ConsultStatus) => {
    await supabase.from('clinical_consults').update({
      status, response: text,
      responded_by: user?.name || 'Profissional',
      response_at: new Date().toISOString(),
    }).eq('id', id)
    setConsults(p => p.map(c => c.id === id ? { ...c, status, response: text, responded_by: user?.name || 'Profissional' } : c))
  }

  const handleResolve = async (id: string) => {
    await supabase.from('clinical_consults').update({ status: 'resolved' }).eq('id', id)
    setConsults(p => p.map(c => c.id === id ? { ...c, status: 'resolved' } : c))
  }

  const filtered = consults.filter(c => {
    if (tab === 'inbox') return c.to_user_id === user?.id || (!c.to_user_id && c.to_role === myRole && c.from_user_id !== user?.id)
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
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🔗</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', marginBottom: 12 }}>Phlox Connect</div>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.8, marginBottom: 28, maxWidth: 440, margin: '0 auto 28px' }}>
            A comunicação clínica inter-profissional que ainda não existe em Portugal. Farmacêutico → Médico → Enfermeiro, dentro do contexto clínico do doente. Auditável. Estruturado. Pro e Institucional.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '13px 32px', borderRadius: 8, fontSize: 15, fontWeight: 700 }}>
            Activar Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      {/* Header */}
      <div style={{ background: 'var(--ink)', borderBottom: '1px solid #1e293b' }}>
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
                Phlox Connect · Comunicação Clínica Inter-Profissional
              </div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#f8fafc', fontWeight: 400, marginBottom: 4 }}>
                Consultas clínicas
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Farmacêutico ↔ Médico ↔ Enfermeiro · dentro do contexto do doente · auditável
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Role selector */}
              <select value={myRole} onChange={e => setMyRole(e.target.value as UserRole)}
                style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 7, padding: '8px 12px', fontSize: 12, fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer' }}>
                {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => setComposing(true)}
                style={{ padding: '10px 18px', background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 6 }}>
                + Nova consulta
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', borderTop: '1px solid #1e293b' }}>
            <button onClick={() => setTab('inbox')} style={{ ...tabStyle('inbox'), color: tab === 'inbox' ? '#f8fafc' : '#475569', borderBottomColor: tab === 'inbox' ? '#22c55e' : 'transparent' }}>
              Recebidas {pendingCount > 0 && <span style={{ background: '#dc2626', color: 'white', fontSize: 9, padding: '1px 5px', borderRadius: 10, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>{pendingCount}</span>}
            </button>
            <button onClick={() => setTab('sent')} style={{ ...tabStyle('sent'), color: tab === 'sent' ? '#f8fafc' : '#475569', borderBottomColor: tab === 'sent' ? '#22c55e' : 'transparent' }}>Enviadas</button>
            <button onClick={() => setTab('all')} style={{ ...tabStyle('all'), color: tab === 'all' ? '#f8fafc' : '#475569', borderBottomColor: tab === 'all' ? '#22c55e' : 'transparent' }}>Todas</button>
          </div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        {composing && (
          <div style={{ marginBottom: 16 }}>
            <NewConsultForm myRole={myRole} myName={user?.name || user?.email || 'Profissional'} onSubmit={handleSubmit} onCancel={() => setComposing(false)} />
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 10 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '56px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              {tab === 'inbox' ? 'Sem consultas recebidas' : tab === 'sent' ? 'Ainda não enviaste nenhuma consulta' : 'Sem consultas'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 20px' }}>
              {tab === 'inbox' ? 'Quando um colega te enviar uma consulta clínica, aparece aqui.' : 'Usa o Phlox Connect para comunicar com médicos, farmacêuticos ou enfermeiros sobre um doente específico.'}
            </div>
            <button onClick={() => setComposing(true)}
              style={{ padding: '11px 22px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              + Criar primeira consulta
            </button>
          </div>
        ) : filtered.map(c => (
          <ConsultCard key={c.id} consult={c} isOwn={c.from_user_id === user?.id}
            onRespond={handleRespond} onResolve={handleResolve} />
        ))}
      </div>
    </div>
  )
}