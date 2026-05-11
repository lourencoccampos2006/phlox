'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface Patient { id: string; name: string; age: number | null; conditions: string | null; sex: string | null }
interface WardMessage {
  id: string; channel_id: string; user_id: string; author_name: string; author_role: string | null
  type: 'note' | 'alert' | 'handover' | 'decision' | 'question' | 'answer' | 'vital' | 'task'
  content: string; pinned: boolean; resolved: boolean
  created_at: string; reply_to: string | null
  metadata?: { priority?: 'high' | 'medium' | 'low'; task_done?: boolean; vital_name?: string; vital_value?: string }
}
interface Handover {
  id: string; shift: 'manha' | 'tarde' | 'noite'; date: string
  patients_summary: { patient_id: string; patient_name: string; status: string; alerts: string[]; action_needed: string }[]
  general_notes: string; from_name: string; completed: boolean
}

const MSG_TYPE = {
  note:     { label: 'Nota',      icon: '·',  color: '#374151', bg: 'var(--bg-2)', border: 'var(--border)' },
  alert:    { label: 'Alerta',    icon: '!',  color: '#991b1b', bg: '#fee2e2',     border: '#fca5a5' },
  handover: { label: 'Passagem',  icon: '⇄',  color: '#1d4ed8', bg: '#eff6ff',     border: '#bfdbfe' },
  decision: { label: 'Decisão',   icon: '✓',  color: '#0d6e42', bg: '#f0fdf5',     border: '#bbf7d0' },
  question: { label: 'Pergunta',  icon: '?',  color: '#7c3aed', bg: '#faf5ff',     border: '#e9d5ff' },
  answer:   { label: 'Resposta',  icon: '↩',  color: '#7c3aed', bg: '#faf5ff',     border: '#e9d5ff' },
  vital:    { label: 'Parâmetro', icon: '♥',  color: '#0891b2', bg: '#ecfeff',     border: '#a5f3fc' },
  task:     { label: 'Tarefa',    icon: '□',  color: '#65a30d', bg: '#f7fee7',     border: '#d9f99d' },
}

const ROLE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  'Médico':          { color: '#1d4ed8', bg: '#eff6ff', label: 'Médico' },
  'Farmacêutico':    { color: '#0d6e42', bg: '#f0fdf5', label: 'Farmacêutico' },
  'Enfermeiro':      { color: '#7c3aed', bg: '#faf5ff', label: 'Enfermeiro' },
  'Interno':         { color: '#d97706', bg: '#fffbeb', label: 'Interno' },
  'Auxiliar':        { color: '#374151', bg: 'var(--bg-2)', label: 'Auxiliar' },
  'Fisioterapeuta':  { color: '#0891b2', bg: '#ecfeff', label: 'Fisioterapeuta' },
}

const SHIFT_LABELS = {
  manha: { label: 'Manhã',  icon: '○' },
  tarde: { label: 'Tarde',  icon: '◑' },
  noite: { label: 'Noite',  icon: '●' },
}

// Quick reply templates por tipo de utilizador
const QUICK_TEMPLATES: Record<string, string[]> = {
  'Farmacêutico': [
    'Intervenção farmacêutica efectuada — dose ajustada.',
    'Reconciliação medicamentosa concluída. Ver registo.',
    'Alerta de interação comunicado ao prescritor.',
    'Genérico substituído por acordo com doente.',
    'Revisão de medicação completada — sem problemas identificados.',
  ],
  'Médico': [
    'Observado. Sem alterações ao plano actual.',
    'Prescrição actualizada. Ver nova ordem médica.',
    'Alta programada para amanhã se evolução favorável.',
    'Pedidos exames complementares.',
    'Referenciado para especialidade.',
  ],
  'Enfermeiro': [
    'Sinais vitais estáveis. Doente colaborante.',
    'Administração de medicação efectuada sem intercorrências.',
    'Doente com queixas. Médico notificado.',
    'Penso realizado. Ferida com boa evolução.',
    'Doente recusou medicação. Registado.',
  ],
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function WardMsg({ msg, onPin, onResolve, onReply, isMe, onTaskDone, supabase }: {
  msg: WardMessage; onPin: () => void; onResolve: () => void
  onReply: () => void; isMe: boolean; onTaskDone?: () => void; supabase: any
}) {
  const [hover, setHover] = useState(false)
  const t = MSG_TYPE[msg.type] || MSG_TYPE.note
  const role = msg.author_role ? ROLE_STYLE[msg.author_role] : null

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--bg-3)', position: 'relative' }}>
      {/* Left type indicator */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 4 }}>
        <div style={{ width: 20, height: 20, borderRadius: 4, background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: t.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
          {t.icon}
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{msg.author_name}</span>
          {role && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: role.color, background: role.bg, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em' }}>{role.label}</span>}
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: t.color, background: t.bg, border: `1px solid ${t.border}`, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.label}</span>
          {msg.pinned && <span style={{ fontSize: 9, color: '#d97706', fontFamily: 'var(--font-mono)' }}>fixado</span>}
          {msg.resolved && <span style={{ fontSize: 9, color: '#0d6e42', fontFamily: 'var(--font-mono)' }}>resolvido</span>}
          <span style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>{timeAgo(msg.created_at)}</span>
        </div>

        {msg.type === 'vital' && msg.metadata?.vital_name ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 8, padding: '8px 14px', display: 'flex', gap: 12, alignItems: 'baseline' }}>
              <span style={{ fontSize: 12, color: '#0891b2', fontFamily: 'var(--font-mono)' }}>{msg.metadata.vital_name}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0e7490' }}>{msg.metadata.vital_value}</span>
            </div>
            {msg.content && <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{msg.content}</span>}
          </div>
        ) : msg.type === 'task' ? (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <button onClick={onTaskDone}
              style={{ width: 18, height: 18, border: `2px solid ${msg.metadata?.task_done ? '#0d6e42' : '#d1d5db'}`, borderRadius: 3, background: msg.metadata?.task_done ? '#d1fae5' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer', padding: 0 }}>
              {msg.metadata?.task_done && <span style={{ fontSize: 10, color: '#0d6e42' }}>✓</span>}
            </button>
            <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5, textDecoration: msg.metadata?.task_done ? 'line-through' : 'none', opacity: msg.metadata?.task_done ? 0.5 : 1 }}>{msg.content}</span>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</p>
        )}
      </div>

      {/* Hover actions */}
      {hover && (
        <div style={{ position: 'absolute', top: 8, right: 0, display: 'flex', gap: 2, background: 'white', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 4px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', zIndex: 10 }}>
          <button onClick={onReply} title="Responder" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--ink-4)', padding: '2px 5px', borderRadius: 4, lineHeight: 1 }}>↩</button>
          <button onClick={onPin} title="Fixar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: msg.pinned ? '#d97706' : 'var(--ink-4)', padding: '2px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>fix</button>
          {(msg.type === 'question' || msg.type === 'task' || msg.type === 'alert') && (
            <button onClick={onResolve} title="Marcar resolvido" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: msg.resolved ? '#0d6e42' : 'var(--ink-4)', padding: '2px 5px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontWeight: 700, lineHeight: 1 }}>✓</button>
          )}
        </div>
      )}
    </div>
  )
}

function ComposeBar({ onSend, replyTo, onCancelReply, myRole, sendError }: {
  onSend: (type: WardMessage['type'], content: string, meta?: any) => Promise<void>
  replyTo: WardMessage | null; onCancelReply: () => void
  myRole: string; sendError: string
}) {
  const [msgType, setMsgType] = useState<WardMessage['type']>('note')
  const [content, setContent] = useState('')
  const [vitalName, setVitalName] = useState('')
  const [vitalValue, setVitalValue] = useState('')
  const [sending, setSending] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const QUICK_TYPES: { type: WardMessage['type']; icon: string; label: string }[] = [
    { type: 'note',     icon: '·',  label: 'Nota' },
    { type: 'alert',    icon: '!',  label: 'Alerta' },
    { type: 'decision', icon: '✓',  label: 'Decisão' },
    { type: 'vital',    icon: '♥',  label: 'Parâmetro' },
    { type: 'task',     icon: '□',  label: 'Tarefa' },
    { type: 'question', icon: '?',  label: 'Pergunta' },
  ]

  const handleSend = async () => {
    const text = content.trim()
    if (msgType === 'vital' && (!vitalName || !vitalValue)) return
    if (msgType !== 'vital' && !text) return
    setSending(true)
    await onSend(msgType, text, msgType === 'vital' ? { vital_name: vitalName, vital_value: vitalValue } : undefined)
    setContent(''); setVitalName(''); setVitalValue(''); setSending(false)
    setShowTemplates(false)
    textRef.current?.focus()
  }

  const templates = QUICK_TEMPLATES[myRole] || []

  return (
    <div style={{ borderTop: '2px solid var(--border)', padding: '10px 14px', background: 'white', flexShrink: 0 }}>
      {/* Error banner */}
      {sendError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#991b1b', fontFamily: 'var(--font-mono)' }}>
          Erro ao enviar: {sendError}
        </div>
      )}

      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-2)', borderRadius: 5, marginBottom: 8, border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ↩ A responder a {replyTo.author_name}: {replyTo.content.slice(0, 40)}...
          </span>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 8, overflowX: 'auto' }}>
        {QUICK_TYPES.map(qt => (
          <button key={qt.type} onClick={() => setMsgType(qt.type)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: `1.5px solid ${msgType === qt.type ? MSG_TYPE[qt.type].color : 'var(--border)'}`, borderRadius: 5, background: msgType === qt.type ? MSG_TYPE[qt.type].bg : 'white', cursor: 'pointer', fontSize: 11, fontWeight: msgType === qt.type ? 700 : 400, color: msgType === qt.type ? MSG_TYPE[qt.type].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', transition: 'all 0.1s', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{qt.icon}</span>{qt.label}
          </button>
        ))}

        {/* Templates */}
        {templates.length > 0 && (
          <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowTemplates(!showTemplates)}
              style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 5, background: 'white', cursor: 'pointer', fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
              Templates
            </button>
            {showTemplates && (
              <div style={{ position: 'absolute', right: 0, bottom: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', minWidth: 280, zIndex: 100, overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Respostas rápidas — {myRole}</div>
                {templates.map((t, i) => (
                  <button key={i} onClick={() => { setContent(t); setShowTemplates(false); textRef.current?.focus() }}
                    style={{ width: '100%', padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: i < templates.length - 1 ? '1px solid var(--bg-3)' : 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.4 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vital inputs */}
      {msgType === 'vital' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 8, marginBottom: 8 }}>
          <input value={vitalName} onChange={e => setVitalName(e.target.value)} placeholder="Parâmetro (ex: TA, FC, SpO2, Glicémia)"
            style={{ border: '1.5px solid #a5f3fc', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
          <input value={vitalValue} onChange={e => setVitalValue(e.target.value)} placeholder="Valor"
            style={{ border: '1.5px solid #a5f3fc', borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }} />
        </div>
      )}

      {/* Text + send */}
      <div style={{ display: 'flex', gap: 8 }}>
        <textarea ref={textRef} value={content} onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder={msgType === 'vital' ? 'Nota adicional (opcional)' : `${MSG_TYPE[msgType].label}... (Enter para enviar, Shift+Enter nova linha)`}
          rows={2}
          style={{ flex: 1, border: `1.5px solid ${MSG_TYPE[msgType].border}`, borderRadius: 7, padding: '8px 11px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
        <button onClick={handleSend}
          disabled={sending || (msgType !== 'vital' && !content.trim()) || (msgType === 'vital' && (!vitalName || !vitalValue))}
          style={{ padding: '9px 16px', background: (content.trim() || (msgType === 'vital' && vitalName && vitalValue)) && !sending ? MSG_TYPE[msgType].color : 'var(--bg-3)', color: (content.trim() || (msgType === 'vital' && vitalName && vitalValue)) && !sending ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', alignSelf: 'flex-end', transition: 'background 0.15s', minWidth: 64 }}>
          {sending ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}

function HandoverPanel({ patients, messages, myName, myRole, supabase, user, orgId }: {
  patients: Patient[]; messages: Record<string, WardMessage[]>
  myName: string; myRole: string; supabase: any; user: any; orgId: string | null
}) {
  const [generating, setGenerating] = useState(false)
  const [handover, setHandover] = useState<Handover | null>(null)
  const [shift, setShift] = useState<'manha' | 'tarde' | 'noite'>('tarde')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const generate = async () => {
    setGenerating(true); setError('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const patientSummaries = patients.map(p => {
        const msgs = messages[p.id] || []
        const alerts = msgs.filter((m: WardMessage) => m.type === 'alert' && !m.resolved).map((m: WardMessage) => m.content)
        const decisions = msgs.filter((m: WardMessage) => m.type === 'decision').slice(0, 3).map((m: WardMessage) => m.content)
        const openTasks = msgs.filter((m: WardMessage) => m.type === 'task' && !m.metadata?.task_done)
        return { patient_id: p.id, patient_name: p.name, patient_info: `${p.age || '?'}a, ${p.conditions || 'sem condições registadas'}`, alerts, decisions, open_tasks: openTasks.length }
      })

      const res = await fetch('/api/ward/handover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ shift, patients: patientSummaries, from_name: myName, from_role: myRole, general_notes: notes }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao gerar') }
      const data = await res.json()

      if (orgId) {
        await supabase.from('handovers').insert({
          org_id: orgId, from_user_id: user?.id,
          shift, date: new Date().toISOString().split('T')[0],
          patients_summary: data.patients_summary,
          general_notes: data.general_notes || notes,
          completed: false,
        }).catch((_e: any) => {})
      }

      setHandover(data)
    } catch (e: any) {
      setError(e.message || 'Erro ao gerar passagem.')
    } finally {
      setGenerating(false)
    }
  }

  const handlePrint = () => {
    if (!handover) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="pt-PT"><head><meta charset="utf-8"><title>Passagem de Turno — Phlox Ward</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;line-height:1.6;color:#111;max-width:800px;margin:0 auto}h1{font-size:18px;font-family:Georgia,serif;font-weight:400;margin:0 0 4px}h2{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#888;font-family:monospace;margin:16px 0 8px}.patient{background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:8px;break-inside:avoid}.patient-name{font-size:14px;font-weight:700;margin-bottom:4px}.alert{color:#991b1b;font-weight:600;margin-top:4px}.action{color:#1d4ed8;margin-top:4px}.footer{margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999;font-family:monospace;display:flex;justify-content:space-between}@media print{body{padding:12px}}</style>
    </head><body>
    <p style="font-size:10px;color:#888;font-family:monospace;margin-bottom:8px">PASSAGEM DE TURNO · ${SHIFT_LABELS[handover.shift]?.label?.toUpperCase()} · Phlox Ward</p>
    <h1>Passagem de Turno — ${myName}</h1>
    <p style="font-size:12px;color:#555;margin:4px 0 16px">${myRole} · ${new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <h2>Doentes (${handover.patients_summary?.length || 0})</h2>
    ${(handover.patients_summary || []).map((p: any) => `<div class="patient"><div class="patient-name">${p.patient_name}</div><div>${p.status}</div>${p.alerts?.length ? `<div class="alert">ALERTA: ${p.alerts.join(' · ')}</div>` : ''}${p.action_needed ? `<div class="action">→ ${p.action_needed}</div>` : ''}</div>`).join('')}
    ${handover.general_notes ? `<h2>Notas gerais do turno</h2><p>${handover.general_notes}</p>` : ''}
    <div class="footer"><span>De: ${myName} (${myRole})</span><span>Gerado por Phlox Ward · ${new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span></div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 300)
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Gerar passagem de turno com AI</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['manha', 'tarde', 'noite'] as const).map(s => (
          <button key={s} onClick={() => setShift(s)}
            style={{ flex: 1, padding: '8px', border: `1.5px solid ${shift === s ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 6, background: shift === s ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: shift === s ? 700 : 400, color: shift === s ? '#1d4ed8' : 'var(--ink-3)', fontFamily: 'var(--font-sans)' }}>
            {SHIFT_LABELS[s].icon} {SHIFT_LABELS[s].label}
          </button>
        ))}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Notas gerais do turno (ex: intercorrências, avisos para o turno seguinte)..."
        rows={2}
        style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }} />

      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '8px 12px', fontSize: 12, color: '#991b1b', marginBottom: 10 }}>{error}</div>}

      <button onClick={generate} disabled={generating}
        style={{ width: '100%', padding: '11px', background: generating ? 'var(--bg-3)' : '#1d4ed8', color: generating ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 7, cursor: generating ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-sans)', marginBottom: 14 }}>
        {generating ? 'A gerar passagem com AI...' : `Gerar passagem — ${SHIFT_LABELS[shift].label}`}
      </button>

      {handover && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {SHIFT_LABELS[handover.shift]?.icon} Turno {SHIFT_LABELS[handover.shift]?.label} · {patients.length} doentes
            </div>
            <button onClick={handlePrint}
              style={{ padding: '5px 12px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-sans)' }}>
              Imprimir
            </button>
          </div>
          <div style={{ padding: '12px 14px' }}>
            {(handover.patients_summary || []).map((p: any, i: number) => (
              <div key={i} style={{ padding: '10px 12px', background: 'white', borderRadius: 7, marginBottom: 7, border: p.alerts?.length > 0 ? '1px solid #fca5a5' : '1px solid #bfdbfe' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{p.patient_name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: p.alerts?.length ? 5 : 0 }}>{p.status}</div>
                {p.alerts?.map((a: string, j: number) => (
                  <div key={j} style={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>Alerta: {a}</div>
                ))}
                {p.action_needed && <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>→ {p.action_needed}</div>}
              </div>
            ))}
            {handover.general_notes && (
              <div style={{ fontSize: 12, color: '#1d4ed8', fontStyle: 'italic', lineHeight: 1.6, marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.6)', borderRadius: 5 }}>{handover.general_notes}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function WardPage() {
  const { user, supabase } = useAuth()
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [channels, setChannels] = useState<Record<string, string>>({})
  const [messages, setMessages] = useState<Record<string, WardMessage[]>>({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [replyTo, setReplyTo] = useState<WardMessage | null>(null)
  const [tab, setTab] = useState<'feed' | 'pinned' | 'tasks' | 'handover'>('feed')
  const [myRole, setMyRole] = useState('Farmacêutico')
  const [showRolePicker, setShowRolePicker] = useState(false)
  const [filterType, setFilterType] = useState<string>('todos')
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

  const loadMessages = useCallback(async (patient: Patient) => {
    if (!user) return
    let channelId = channels[patient.id]
    if (!channelId) {
      const { data: existing } = await supabase.from('patient_channels').select('id').eq('patient_id', patient.id).maybeSingle()
      if (existing) {
        channelId = existing.id
      } else {
        const { data: newChannel, error: chErr } = await supabase.from('patient_channels').insert({
          patient_id: patient.id, org_id: orgId || '00000000-0000-0000-0000-000000000000'
        }).select().single()
        if (chErr) { console.error('Channel create error:', chErr); return }
        channelId = newChannel?.id
      }
      if (channelId) setChannels(prev => ({ ...prev, [patient.id]: channelId! }))
    }
    if (!channelId) return
    const { data: msgs } = await supabase.from('channel_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(200)
    setMessages(prev => ({ ...prev, [patient.id]: msgs || [] }))
    return channelId
  }, [user, supabase, channels, orgId])

  useEffect(() => {
    if (!selectedPatient) return
    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null
    loadMessages(selectedPatient).then(channelId => {
      if (!channelId) return
      realtimeChannel = supabase
        .channel(`ward-${channelId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'channel_messages',
          filter: `channel_id=eq.${channelId}`
        }, (payload: any) => {
          const newMsg = payload.new as WardMessage
          setMessages(prev => {
            const existing = prev[selectedPatient.id] || []
            if (existing.find(m => m.id === newMsg.id)) return prev
            return { ...prev, [selectedPatient.id]: [...existing, newMsg] }
          })
        })
        .subscribe()
    })
    return () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel) }
  }, [selectedPatient?.id, supabase])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedPatient])

  // ─── BUG FIX: sendMessage com error handling completo ───────────────────────
  const sendMessage = async (type: WardMessage['type'], content: string, meta?: any) => {
    if (!selectedPatient || !user) return
    const channelId = channels[selectedPatient.id]
    if (!channelId) {
      setSendError('Canal não encontrado. Recarrega a página.')
      return
    }
    setSending(true)
    setSendError('')

    const { data: msg, error: insertError } = await supabase
      .from('channel_messages')
      .insert({
        channel_id: channelId,
        user_id: user.id,
        author_name: user.name || user.email || 'Utilizador',
        author_role: myRole,
        type,
        content: content || '',
        pinned: false,
        resolved: false,
        reply_to: replyTo?.id || null,
        metadata: meta || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Ward send error:', insertError)
      // Se o erro é de CHECK constraint no tipo, tentar com 'note' como fallback
      if (insertError.code === '23514' || insertError.message?.includes('check')) {
        const { data: fallback, error: fallbackErr } = await supabase
          .from('channel_messages')
          .insert({
            channel_id: channelId,
            user_id: user.id,
            author_name: user.name || user.email || 'Utilizador',
            author_role: myRole,
            type: 'note', // fallback seguro
            content: content || '',
            pinned: false,
            resolved: false,
            reply_to: replyTo?.id || null,
            metadata: meta || null,
          })
          .select()
          .single()
        if (fallbackErr) {
          setSendError(`Erro na base de dados: ${fallbackErr.message}. Corre a migração 007-fixes.sql.`)
        } else if (fallback) {
          setMessages(prev => ({ ...prev, [selectedPatient.id]: [...(prev[selectedPatient.id] || []), fallback] }))
        }
      } else {
        setSendError(insertError.message || 'Erro ao enviar. Verifica a tua ligação.')
      }
    } else if (msg) {
      setMessages(prev => ({ ...prev, [selectedPatient.id]: [...(prev[selectedPatient.id] || []), msg] }))
    } else {
      setSendError('Mensagem não foi guardada. Verifica as permissões RLS no Supabase.')
    }

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
  const toggleTaskDone = async (msg: WardMessage) => {
    const done = !msg.metadata?.task_done
    await supabase.from('channel_messages').update({ metadata: { ...msg.metadata, task_done: done } }).eq('id', msg.id)
    setMessages(prev => ({ ...prev, [selectedPatient!.id]: prev[selectedPatient!.id].map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, task_done: done } } : m) }))
  }

  const patientMessages = selectedPatient ? (messages[selectedPatient.id] || []) : []
  const pinnedMsgs = patientMessages.filter(m => m.pinned)
  const openTasks = patientMessages.filter(m => m.type === 'task' && !m.metadata?.task_done)
  const alertsCount = patientMessages.filter(m => m.type === 'alert' && !m.resolved).length

  const filteredMessages = tab === 'pinned' ? pinnedMsgs
    : tab === 'tasks' ? patientMessages.filter(m => m.type === 'task')
    : filterType !== 'todos' ? patientMessages.filter(m => m.type === filterType)
    : patientMessages

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
          <div style={{ width: 56, height: 56, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', marginBottom: 12 }}>Phlox Ward</div>
          <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, marginBottom: 24 }}>
            Ficha clínica colaborativa em tempo real. A equipa inteira — médicos, farmacêuticos, enfermeiros — colabora no mesmo doente. Notas, alertas, decisões, passagem de turno AI.
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
        <div className="page-container" style={{ paddingTop: 14, paddingBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#475569', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>Phlox Ward · Ficha Clínica Colaborativa</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#f8fafc', fontWeight: 400 }}>
                {patients.length} {patients.length === 1 ? 'doente' : 'doentes'} · {loading ? '...' : patientMessages.length} entradas
                {alertsCount > 0 && <span style={{ marginLeft: 10, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#fca5a5', fontWeight: 700 }}>{alertsCount} alerta{alertsCount > 1 ? 's' : ''} activo{alertsCount > 1 ? 's' : ''}</span>}
              </div>
            </div>
            {/* Role picker */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowRolePicker(!showRolePicker)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: ROLE_STYLE[myRole]?.color || '#94a3b8' }}>{ROLE_STYLE[myRole]?.label || myRole}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showRolePicker && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: 'white', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 180, zIndex: 200, overflow: 'hidden' }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', flex: 1, overflow: 'hidden', height: 'calc(100vh - 116px)' }} className="ward-grid">
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
              <div style={{ fontSize: 12, marginBottom: 8 }}>Sem doentes registados</div>
              <Link href="/patients" style={{ fontSize: 11, color: '#1d4ed8', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, display: 'block', marginTop: 8 }}>
                Adicionar doente →
              </Link>
            </div>
          ) : patients.map(p => {
            const pMsgs = messages[p.id] || []
            const alerts = pMsgs.filter(m => m.type === 'alert' && !m.resolved).length
            const tasks = pMsgs.filter(m => m.type === 'task' && !m.metadata?.task_done).length
            const isSelected = selectedPatient?.id === p.id
            return (
              <button key={p.id} onClick={() => setSelectedPatient(p)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isSelected ? '#eff6ff' : 'white', border: 'none', borderBottom: '1px solid var(--bg-3)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? '#dbeafe' : 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#1d4ed8' : 'var(--ink-4)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? '#1d4ed8' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{p.age ? `${p.age}a` : '?'}{p.sex ? ` · ${p.sex}` : ''} · {pMsgs.length}ent</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                  {alerts > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '1px 5px', borderRadius: 3 }}>{alerts}!</span>}
                  {tasks > 0 && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#65a30d', background: '#f7fee7', border: '1px solid #d9f99d', padding: '1px 5px', borderRadius: 3 }}>{tasks}T</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Patient feed */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
          {!selectedPatient ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--ink-4)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-4)' }}>Selecciona um doente</div>
              </div>
            </div>
          ) : (
            <>
              {/* Patient header */}
              <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '10px 16px', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{selectedPatient.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
                      {[selectedPatient.age ? `${selectedPatient.age}a` : null, selectedPatient.sex, selectedPatient.conditions].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {alertsCount > 0 && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#991b1b', background: '#fee2e2', border: '1px solid #fca5a5', padding: '2px 7px', borderRadius: 4 }}>
                        {alertsCount} alerta{alertsCount > 1 ? 's' : ''}
                      </span>
                    )}
                    <Link href={`/patients/${selectedPatient.id}`}
                      style={{ padding: '5px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 5, textDecoration: 'none', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      Perfil →
                    </Link>
                  </div>
                </div>
                {/* Tabs */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--bg-3)', marginTop: 2, overflowX: 'auto', gap: 0 }}>
                  <button onClick={() => { setTab('feed'); setFilterType('todos') }} style={tabStyle('feed')}>Feed</button>
                  <button onClick={() => setTab('pinned')} style={tabStyle('pinned')}>Fixados {pinnedMsgs.length > 0 && `(${pinnedMsgs.length})`}</button>
                  <button onClick={() => setTab('tasks')} style={tabStyle('tasks')}>Tarefas {openTasks.length > 0 && `(${openTasks.length})`}</button>
                  <button onClick={() => setTab('handover')} style={tabStyle('handover')}>Passagem AI</button>
                </div>

                {/* Feed filter by type */}
                {tab === 'feed' && (
                  <div style={{ display: 'flex', gap: 4, paddingTop: 8, overflowX: 'auto' }}>
                    {['todos', 'note', 'alert', 'decision', 'question', 'vital'].map(ft => (
                      <button key={ft} onClick={() => setFilterType(ft)}
                        style={{ padding: '3px 8px', border: `1px solid ${filterType === ft ? (ft === 'todos' ? '#374151' : MSG_TYPE[ft as keyof typeof MSG_TYPE]?.color || '#374151') : 'var(--border)'}`, borderRadius: 4, background: filterType === ft ? (ft === 'todos' ? '#f3f4f6' : MSG_TYPE[ft as keyof typeof MSG_TYPE]?.bg || '#f3f4f6') : 'white', cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: filterType === ft ? 700 : 400, color: filterType === ft ? (ft === 'todos' ? '#374151' : MSG_TYPE[ft as keyof typeof MSG_TYPE]?.color || '#374151') : 'var(--ink-5)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {ft === 'todos' ? 'Todos' : MSG_TYPE[ft as keyof typeof MSG_TYPE]?.label || ft}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {tab === 'handover' ? (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <HandoverPanel patients={patients} messages={messages} myName={user?.name || 'Profissional'} myRole={myRole} supabase={supabase} user={user} orgId={orgId} />
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
                    {filteredMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-4)' }}>
                        <div style={{ fontSize: 13 }}>
                          {tab === 'pinned' ? 'Sem mensagens fixadas' : tab === 'tasks' ? 'Sem tarefas' : filterType !== 'todos' ? `Sem entradas do tipo "${MSG_TYPE[filterType as keyof typeof MSG_TYPE]?.label || filterType}"` : 'Ainda sem entradas. Começa por escrever uma nota.'}
                        </div>
                      </div>
                    ) : filteredMessages.map(msg => (
                      <WardMsg key={msg.id} msg={msg} isMe={msg.user_id === user?.id}
                        onPin={() => togglePin(msg)}
                        onResolve={() => toggleResolve(msg)}
                        onReply={() => setReplyTo(msg)}
                        onTaskDone={() => toggleTaskDone(msg)}
                        supabase={supabase} />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <ComposeBar onSend={sendMessage} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} myRole={myRole} sendError={sendError} />
                </>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:768px){.ward-grid{grid-template-columns:1fr!important;height:auto!important}}
      `}</style>
    </div>
  )
}