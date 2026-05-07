'use client'

// ─── PHLOX WARD — Ficha Clínica Colaborativa ────────────────────────────────
// A unidade de trabalho é o DOENTE, não o utilizador.
// Cada doente tem um feed onde toda a equipa colabora em tempo real.
// Passagem de turno automática gerada por AI.
// Multi-utilizador com papéis (médico, farmacêutico, enfermeiro).
// A alternativa acessível aos EHRs de €100.000.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Patient { id: string; name: string; age: number | null; conditions: string | null; sex: string | null }
interface WardMessage {
  id: string; channel_id: string; user_id: string; author_name: string; author_role: string | null
  type: 'note' | 'alert' | 'handover' | 'decision' | 'question' | 'answer' | 'vital' | 'task'
  content: string; pinned: boolean; resolved: boolean
  created_at: string; reply_to: string | null
  metadata?: { priority?: 'high' | 'medium' | 'low'; task_done?: boolean; vital_name?: string; vital_value?: string }
}
interface Channel { id: string; patient_id: string }
interface Handover {
  id: string; shift: 'manha' | 'tarde' | 'noite'; date: string
  patients_summary: { patient_id: string; patient_name: string; status: string; alerts: string[]; action_needed: string }[]
  general_notes: string; from_name: string; completed: boolean
}

// ─── Style maps ───────────────────────────────────────────────────────────────

const MSG_TYPE = {
  note:     { label: 'Nota',          icon: '📝', color: '#374151',  bg: 'var(--bg-2)',  border: 'var(--border)' },
  alert:    { label: 'Alerta',         icon: '🚨', color: '#991b1b',  bg: '#fee2e2',      border: '#fca5a5' },
  handover: { label: 'Passagem',       icon: '🔄', color: '#1d4ed8',  bg: '#eff6ff',      border: '#bfdbfe' },
  decision: { label: 'Decisão',        icon: '⚕️', color: '#0d6e42',  bg: '#f0fdf5',      border: '#bbf7d0' },
  question: { label: 'Pergunta',       icon: '❓', color: '#7c3aed',  bg: '#faf5ff',      border: '#e9d5ff' },
  answer:   { label: 'Resposta',       icon: '💬', color: '#7c3aed',  bg: '#faf5ff',      border: '#e9d5ff' },
  vital:    { label: 'Parâmetro',      icon: '📊', color: '#0891b2',  bg: '#ecfeff',      border: '#a5f3fc' },
  task:     { label: 'Tarefa',         icon: '✅', color: '#65a30d',  bg: '#f7fee7',      border: '#d9f99d' },
}

const ROLE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  'Médico':          { color: '#1d4ed8', bg: '#eff6ff', label: '⚕️ Médico' },
  'Farmacêutico':    { color: '#0d6e42', bg: '#f0fdf5', label: '💊 Farmacêutico' },
  'Enfermeiro':      { color: '#7c3aed', bg: '#faf5ff', label: '💉 Enfermeiro' },
  'Interno':         { color: '#d97706', bg: '#fffbeb', label: '🎓 Interno' },
  'Auxiliar':        { color: '#374151', bg: 'var(--bg-2)', label: '👤 Auxiliar' },
  'Fisioterapeuta':  { color: '#0891b2', bg: '#ecfeff', label: '🏃 Fisioterapeuta' },
}

const SHIFT_LABELS = { manha: { label: 'Manhã', icon: '☀️' }, tarde: { label: 'Tarde', icon: '🌤' }, noite: { label: 'Noite', icon: '🌙' } }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Message component ────────────────────────────────────────────────────────

function WardMsg({ msg, onPin, onResolve, onReply, isMe }: {
  msg: WardMessage; onPin: () => void; onResolve: () => void
  onReply: () => void; isMe: boolean
}) {
  const [hover, setHover] = useState(false)
  const t = MSG_TYPE[msg.type] || MSG_TYPE.note
  const role = msg.author_role ? ROLE_STYLE[msg.author_role] : null

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--bg-3)', position: 'relative' }}>
      {/* Left indicator */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, marginTop: 6, flexShrink: 0 }} />
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author + time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{msg.author_name}</span>
          {role && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: role.color, background: role.bg, padding: '1px 6px', borderRadius: 3, letterSpacing: '0.04em' }}>{role.label}</span>}
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.color, background: t.bg, border: `1px solid ${t.border}`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.icon} {t.label}</span>
          {msg.pinned && <span style={{ fontSize: 9, color: '#d97706', fontFamily: 'var(--font-mono)' }}>📌 fixado</span>}
          {msg.resolved && <span style={{ fontSize: 9, color: '#0d6e42', fontFamily: 'var(--font-mono)' }}>✓ resolvido</span>}
          <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{timeAgo(msg.created_at)}</span>
        </div>
        {/* Special: vital */}
        {msg.type === 'vital' && msg.metadata?.vital_name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: '#0891b2', fontFamily: 'var(--font-mono)' }}>{msg.metadata.vital_name}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0e7490', fontWeight: 400 }}>{msg.metadata.vital_value}</span>
            </div>
            {msg.content && <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{msg.content}</span>}
          </div>
        ) : msg.type === 'task' ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ width: 18, height: 18, border: `2px solid ${msg.metadata?.task_done ? '#0d6e42' : '#d1d5db'}`, borderRadius: 3, background: msg.metadata?.task_done ? '#d1fae5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {msg.metadata?.task_done && <span style={{ fontSize: 10, color: '#0d6e42' }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, textDecoration: msg.metadata?.task_done ? 'line-through' : 'none' }}>{msg.content}</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
        )}
      </div>
      {/* Actions on hover */}
      {hover && (
        <div style={{ position: 'absolute', top: 8, right: 0, display: 'flex', gap: 4, background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <button onClick={onReply} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--ink-4)', padding: '2px 4px' }} title="Responder">↩</button>
          <button onClick={onPin} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: msg.pinned ? '#d97706' : 'var(--ink-4)', padding: '2px 4px' }} title="Fixar">📌</button>
          {(msg.type === 'question' || msg.type === 'task') && (
            <button onClick={onResolve} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: msg.resolved ? '#0d6e42' : 'var(--ink-4)', padding: '2px 4px' }} title="Marcar como resolvido">✓</button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Compose bar ──────────────────────────────────────────────────────────────

function ComposeBar({ onSend, replyTo, onCancelReply }: {
  onSend: (type: WardMessage['type'], content: string, meta?: any) => Promise<void>
  replyTo: WardMessage | null; onCancelReply: () => void
}) {
  const [msgType, setMsgType] = useState<WardMessage['type']>('note')
  const [content, setContent] = useState('')
  const [vitalName, setVitalName] = useState('')
  const [vitalValue, setVitalValue] = useState('')
  const [sending, setSending] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const QUICK_TYPES: { type: WardMessage['type']; icon: string; label: string }[] = [
    { type: 'note',     icon: '📝', label: 'Nota' },
    { type: 'alert',    icon: '🚨', label: 'Alerta' },
    { type: 'decision', icon: '⚕️', label: 'Decisão' },
    { type: 'vital',    icon: '📊', label: 'Parâmetro' },
    { type: 'task',     icon: '✅', label: 'Tarefa' },
    { type: 'question', icon: '❓', label: 'Pergunta' },
  ]

  const handleSend = async () => {
    const text = content.trim()
    if (msgType === 'vital' && (!vitalName || !vitalValue)) return
    if (msgType !== 'vital' && !text) return
    setSending(true)
    await onSend(msgType, text, msgType === 'vital' ? { vital_name: vitalName, vital_value: vitalValue } : undefined)
    setContent(''); setVitalName(''); setVitalValue(''); setSending(false)
    textRef.current?.focus()
  }

  return (
    <div style={{ borderTop: '2px solid var(--border)', padding: '12px 16px', background: 'white', flexShrink: 0 }}>
      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 6, marginBottom: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↩ A responder a {replyTo.author_name}</span>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, overflowX: 'auto' }}>
        {QUICK_TYPES.map(qt => (
          <button key={qt.type} onClick={() => setMsgType(qt.type)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: `1.5px solid ${msgType === qt.type ? MSG_TYPE[qt.type].color : 'var(--border)'}`, borderRadius: 6, background: msgType === qt.type ? MSG_TYPE[qt.type].bg : 'white', cursor: 'pointer', fontSize: 11, fontWeight: msgType === qt.type ? 700 : 400, color: msgType === qt.type ? MSG_TYPE[qt.type].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 0.1s' }}>
            <span>{qt.icon}</span>{qt.label}
          </button>
        ))}
      </div>

      {/* Vital input */}
      {msgType === 'vital' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
          <input value={vitalName} onChange={e => setVitalName(e.target.value)} placeholder="Parâmetro (ex: TA, FC, SpO2)"
            style={{ border: '1.5px solid #a5f3fc', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <input value={vitalValue} onChange={e => setVitalValue(e.target.value)} placeholder="Valor"
            style={{ border: '1.5px solid #a5f3fc', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>
      ) : null}

      {/* Main input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea ref={textRef} value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={msgType === 'vital' ? 'Nota adicional (opcional)' : `${MSG_TYPE[msgType].label}... (Enter para enviar)`}
          rows={2}
          style={{ flex: 1, border: `1.5px solid ${MSG_TYPE[msgType].border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
        <button onClick={handleSend} disabled={sending || (msgType !== 'vital' && !content.trim()) || (msgType === 'vital' && (!vitalName || !vitalValue))}
          style={{ padding: '9px 16px', background: MSG_TYPE[msgType].color, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', alignSelf: 'flex-end', opacity: (content.trim() || (msgType === 'vital' && vitalName && vitalValue)) && !sending ? 1 : 0.5 }}>
          {sending ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

// ─── Handover generator ───────────────────────────────────────────────────────

function HandoverPanel({ patients, messages, myName, myRole, supabase, user, orgId }: {
  patients: Patient[]; messages: Record<string, WardMessage[]>
  myName: string; myRole: string; supabase: any; user: any; orgId: string | null
}) {
  const [generating, setGenerating] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [shift, setShift] = useState<'manha' | 'tarde' | 'noite'>('manha')
  const [notes, setNotes] = useState('')

  const generate = async () => {
    setGenerating(true)
    const { data: sd } = await supabase.auth.getSession()
    // Build patient summaries from messages
    const patientSummaries = patients.map(p => {
      const msgs = messages[p.id] || []
      const alerts = msgs.filter((m: WardMessage) => m.type === 'alert' && !m.resolved).map((m: WardMessage) => m.content)
      const decisions = msgs.filter((m: WardMessage) => m.type === 'decision').slice(0, 3).map((m: WardMessage) => m.content)
      const openTasks = msgs.filter((m: WardMessage) => m.type === 'task' && !m.metadata?.task_done)
      return { patient_id: p.id, patient_name: p.name, patient_info: `${p.age || '?'}a, ${p.conditions || 'sem condições'}`, alerts, decisions, open_tasks: openTasks.length }
    })

    const res = await fetch('/api/ward/handover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ shift, patients: patientSummaries, from_name: myName, from_role: myRole, general_notes: notes }),
    })
    const data = await res.json()

    // Save to Supabase
    if (orgId) {
      await supabase.from('handovers').insert({
        org_id: orgId, from_user_id: user?.id,
        shift, date: new Date().toISOString().split('T')[0],
        patients_summary: data.patients_summary,
        general_notes: data.general_notes || notes,
        completed: false,
      }).catch(() => {})
    }

    setHandover(data)
    setGenerating(false)
  }

  const handlePrint = () => {
    if (!handover) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>Passagem de Turno</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;line-height:1.6;color:#111}h1{font-size:18px;font-family:Georgia,serif;font-weight:400}h2{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#888;font-family:monospace;margin:14px 0 6px}.patient{background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:10px;break-inside:avoid}.patient-name{font-size:14px;font-weight:700;margin-bottom:4px}.alert{color:#991b1b;font-weight:600}.action{color:#1d4ed8}.footer{margin-top:20px;padding-top:12px;border-top:1px solid #e0e0e0;font-size:10px;color:#aaa;font-family:monospace;display:flex;justify-content:space-between}</style>
    </head><body>
    <p style="font-size:10px;color:#888;font-family:monospace;margin-bottom:6px">PASSAGEM DE TURNO · ${SHIFT_LABELS[handover.shift]?.label || handover.shift} · Phlox Ward</p>
    <h1>Passagem de Turno — ${myName}</h1>
    <h2>Doentes (${handover.patients_summary?.length || 0})</h2>
    ${(handover.patients_summary || []).map((p: any) => `<div class="patient">
      <div class="patient-name">${p.patient_name}</div>
      <div>${p.status}</div>
      ${p.alerts?.length ? `<div class="alert">⚠️ ${p.alerts.join(' · ')}</div>` : ''}
      ${p.action_needed ? `<div class="action">→ ${p.action_needed}</div>` : ''}
    </div>`).join('')}
    ${handover.general_notes ? `<h2>Notas gerais</h2><p>${handover.general_notes}</p>` : ''}
    <div class="footer"><span>De: ${myName} (${myRole})</span><span>${new Date().toLocaleDateString('pt-PT', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Gerar passagem de turno</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['manha', 'tarde', 'noite'] as const).map(s => (
          <button key={s} onClick={() => setShift(s)}
            style={{ flex: 1, padding: '8px', border: `1.5px solid ${shift === s ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 7, background: shift === s ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: shift === s ? 700 : 400, color: shift === s ? '#1d4ed8' : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
            {SHIFT_LABELS[s].icon} {SHIFT_LABELS[s].label}
          </button>
        ))}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Notas gerais do turno (opcional)..."
        rows={2}
        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }} />

      <button onClick={generate} disabled={generating}
        style={{ width: '100%', padding: '11px', background: generating ? 'var(--bg-3)' : '#1d4ed8', color: generating ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 8, cursor: generating ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', marginBottom: 14 }}>
        {generating ? 'A gerar passagem...' : `🔄 Gerar passagem de ${SHIFT_LABELS[shift].label}`}
      </button>

      {handover && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {SHIFT_LABELS[handover.shift]?.icon} Turno {SHIFT_LABELS[handover.shift]?.label}
            </div>
            <button onClick={handlePrint}
              style={{ padding: '5px 10px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              🖨 Imprimir
            </button>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {(handover.patients_summary || []).map((p: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', background: 'white', borderRadius: 7, marginBottom: 7, border: p.alerts?.length > 0 ? '1px solid #fca5a5' : '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p.patient_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: p.alerts?.length ? 5 : 0 }}>{p.status}</div>
                {p.alerts?.map((a: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>⚠️ {a}</div>
                ))}
                {p.action_needed && <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>→ {p.action_needed}</div>}
              </div>
            ))}
            {handover.general_notes && (
              <div style={{ fontSize: 12, color: '#1d4ed8', fontStyle: 'italic', lineHeight: 1.6, marginTop: 8 }}>{handover.general_notes}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function WardPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [channels, setChannels] = useState<Record<string, string>>({}) // patientId → channelId
  const [messages, setMessages] = useState<Record<string, WardMessage[]>>({}) // patientId → messages
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<WardMessage | null>(null)
  const [tab, setTab] = useState<'feed' | 'pinned' | 'tasks' | 'handover'>('feed')
  const [myRole, setMyRole] = useState('Farmacêutico')
  const [showRolePicker, setShowRolePicker] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const plan = (user?.plan || 'free') as string
  const isPro = plan === 'pro' || plan === 'clinic'
  const orgId = (user as any)?.org_id || null

  const load = useCallback(async () => {
    if (!user || !isPro) { setLoading(false); return }
    const { data: ps } = await supabase.from('patients').select('id, name, age, conditions, sex').eq('user_id', user.id).order('updated_at', { ascending: false })
    setPatients(ps || [])
    if (ps?.length) setSelectedPatient(prev => prev || ps[0])
    setLoading(false)
  }, [user, supabase, isPro])

  useEffect(() => { load() }, [load])

  // Load messages for selected patient
  const loadMessages = useCallback(async (patient: Patient) => {
    if (!user) return
    // Get or create channel
    let channelId = channels[patient.id]
    if (!channelId) {
      const { data: existing } = await supabase.from('patient_channels').select('id').eq('patient_id', patient.id).maybeSingle()
      if (existing) {
        channelId = existing.id
      } else {
        const { data: newChannel } = await supabase.from('patient_channels').insert({
          patient_id: patient.id, org_id: orgId || '00000000-0000-0000-0000-000000000000'
        }).select().single()
        channelId = newChannel?.id
      }
      if (channelId) setChannels(prev => ({ ...prev, [patient.id]: channelId! }))
    }
    if (!channelId) return
    const { data: msgs } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(100)
    setMessages(prev => ({ ...prev, [patient.id]: msgs || [] }))
  }, [user, supabase, channels, orgId])

  useEffect(() => {
    if (selectedPatient) loadMessages(selectedPatient)
  }, [selectedPatient, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedPatient])

  const sendMessage = async (type: WardMessage['type'], content: string, meta?: any) => {
    if (!selectedPatient || !user) return
    const channelId = channels[selectedPatient.id]
    if (!channelId) return
    setSending(true)
    const { data: msg } = await supabase.from('channel_messages').insert({
      channel_id: channelId, user_id: user.id,
      author_name: user.name || user.email || 'Utilizador',
      author_role: myRole, type, content: content || '',
      pinned: false, resolved: false,
      reply_to: replyTo?.id || null,
      metadata: meta || null,
    }).select().single()
    if (msg) setMessages(prev => ({ ...prev, [selectedPatient.id]: [...(prev[selectedPatient.id] || []), msg] }))
    setReplyTo(null)
    setSending(false)
  }

  const togglePin = async (msg: WardMessage) => {
    await supabase.from('channel_messages').update({ pinned: !msg.pinned }).eq('id', msg.id)
    setMessages(prev => ({ ...prev, [selectedPatient!.id]: prev[selectedPatient!.id].map(m => m.id === msg.id ? { ...m, pinned: !m.pinned } : m) }))
  }
  const toggleResolve = async (msg: WardMessage) => {
    await supabase.from('channel_messages').update({ resolved: !msg.resolved }).eq('id', msg.id)
    setMessages(prev => ({ ...prev, [selectedPatient!.id]: prev[selectedPatient!.id].map(m => m.id === msg.id ? { ...m, resolved: !m.resolved } : m) }))
  }

  const patientMessages = selectedPatient ? (messages[selectedPatient.id] || []) : []
  const pinnedMsgs = patientMessages.filter(m => m.pinned)
  const openTasks = patientMessages.filter(m => m.type === 'task' && !m.metadata?.task_done)
  const alertsCount = patientMessages.filter(m => m.type === 'alert' && !m.resolved).length

  const filteredMessages = tab === 'pinned' ? pinnedMsgs : tab === 'tasks' ? patientMessages.filter(m => m.type === 'task') : patientMessages

  const tabStyle = (t: string) => ({
    padding: '8px 14px', background: 'none', border: 'none',
    borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontWeight: 700,
    color: tab === t ? '#1d4ed8' : 'var(--ink-4)',
    fontFamily: 'var(--font-sans)', letterSpacing: '0.04em',
    textTransform: 'uppercase' as const, marginBottom: -1, whiteSpace: 'nowrap' as const,
  })

  if (!isPro) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Header />
      <div className="page-container page-body" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: '48px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 14 }}>🏥</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Phlox Ward</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
            Ficha clínica colaborativa multi-utilizador. A equipa inteira colabora no mesmo doente — notas, alertas, decisões, passagem de turno. Pro e Institucional.
          </p>
          <Link href="/pricing" style={{ display: 'inline-block', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>
            Ver plano Pro →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Ward header */}
      <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', flexShrink: 0 }}>
        <div className="page-container" style={{ paddingTop: 16, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Phlox Ward · Ficha Clínica Colaborativa</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: '#f8fafc', fontWeight: 400 }}>
                {patients.length} doentes · {loading ? '...' : patientMessages.length} entradas no turno
              </div>
            </div>
            {/* Role picker */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowRolePicker(!showRolePicker)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                {ROLE_STYLE[myRole]?.label || myRole}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showRolePicker && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 180, zIndex: 100, overflow: 'hidden' }}>
                  {Object.entries(ROLE_STYLE).map(([role, s]) => (
                    <button key={role} onClick={() => { setMyRole(role); setShowRolePicker(false) }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: myRole === role ? s.bg : 'white', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', fontSize: 12, fontWeight: myRole === role ? 700 : 400, color: s.color, fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', flex: 1, overflow: 'hidden', height: 'calc(100vh - 120px)' }} className="ward-grid">
        {/* Patient list */}
        <div style={{ background: 'white', borderRight: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Doentes</div>
            <Link href="/patients" style={{ fontSize: 10, color: '#1d4ed8', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>+ Novo</Link>
          </div>
          {loading ? (
            <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 6 }} />)}
            </div>
          ) : patients.length === 0 ? (
            <div style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--ink-4)' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>👤</div>
              <div style={{ fontSize: 12 }}>Sem doentes</div>
              <Link href="/patients" style={{ fontSize: 11, color: '#1d4ed8', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'block', marginTop: 8 }}>
                Adicionar →
              </Link>
            </div>
          ) : patients.map(p => {
            const pMsgs = messages[p.id] || []
            const alerts = pMsgs.filter(m => m.type === 'alert' && !m.resolved).length
            const isSelected = selectedPatient?.id === p.id
            return (
              <button key={p.id} onClick={() => setSelectedPatient(p)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSelected ? '#eff6ff' : 'white', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? '#dbeafe' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#1d4ed8' : 'var(--ink-4)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {p.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#1d4ed8' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{p.age ? `${p.age}a` : '?'} · {pMsgs.length} entradas</div>
                </div>
                {alerts > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>{alerts}</span>}
              </button>
            )
          })}
        </div>

        {/* Patient feed */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
          {!selectedPatient ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--ink-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🏥</div>
                <div style={{ fontSize: 14 }}>Selecciona um doente</div>
              </div>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '10px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                      {[selectedPatient.age ? `${selectedPatient.age}a` : null, selectedPatient.sex, selectedPatient.conditions].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <Link href={`/patients/${selectedPatient.id}`}
                      style={{ padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      Perfil →
                    </Link>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--bg-3)', marginTop: 8, overflowX: 'auto' }}>
                  <button onClick={() => setTab('feed')} style={tabStyle('feed')}>Feed</button>
                  <button onClick={() => setTab('pinned')} style={tabStyle('pinned')}>Fixados {pinnedMsgs.length > 0 && `(${pinnedMsgs.length})`}</button>
                  <button onClick={() => setTab('tasks')} style={tabStyle('tasks')}>Tarefas {openTasks.length > 0 && `(${openTasks.length})`}</button>
                  <button onClick={() => setTab('handover')} style={tabStyle('handover')}>Passagem</button>
                </div>
              </div>

              {tab === 'handover' ? (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <HandoverPanel patients={patients} messages={messages} myName={user?.name || 'Profissional'} myRole={myRole} supabase={supabase} user={user} orgId={orgId} />
                </div>
              ) : (
                <>
                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                    {filteredMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
                        <div style={{ fontSize: 13 }}>{tab === 'pinned' ? 'Sem mensagens fixadas' : tab === 'tasks' ? 'Sem tarefas' : 'Ainda sem entradas. Começa por escrever uma nota.'}</div>
                      </div>
                    ) : filteredMessages.map(msg => (
                      <WardMsg key={msg.id} msg={msg} isMe={msg.user_id === user?.id}
                        onPin={() => togglePin(msg)} onResolve={() => toggleResolve(msg)} onReply={() => setReplyTo(msg)} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Compose */}
                  <ComposeBar onSend={sendMessage} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
                </>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@media(max-width:768px){.ward-grid{grid-template-columns:1fr!important;height:auto!important}}`}</style>
    </div>
  )
}