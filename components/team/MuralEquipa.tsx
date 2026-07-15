'use client'

// Mural da equipa — era a página própria /equipa-mural, agora um separador
// dentro de /equipa. Ganhou a "Passagem de turno" (era do Phlox Ward /teams,
// que não sobrevive como página própria) — aqui adaptada ao nível da equipa
// (sem o feed clínico por doente do Ward, que dependia de outra tabela).

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'

const ACCENT = '#0d9488'
type Channel = 'geral' | 'doentes' | 'stock' | 'avisos'
interface Msg { id: string; author_id: string; author_name: string; channel: Channel; body: string; priority: 'normal' | 'importante' | 'urgente'; resolved: boolean; patient_id?: string | null; created_at: string }

const CHANNELS: { id: Channel; label: string; icon: string; hint: string }[] = [
  { id: 'geral',   label: 'Geral',    icon: '💬', hint: 'Conversa e coordenação da equipa' },
  { id: 'doentes', label: 'Doentes',  icon: '🧑‍🤝‍🧑', hint: 'Recados sobre quem cuidamos' },
  { id: 'stock',   label: 'Stock',    icon: '📦', hint: 'Falta material, pedidos de compra' },
  { id: 'avisos',  label: 'Avisos',   icon: '📣', hint: 'Informações e recados importantes' },
]
const PRIO = { normal: { l: 'Normal', c: '#64748b' }, importante: { l: 'Importante', c: '#d97706' }, urgente: { l: 'Urgente', c: '#dc2626' } }
const SHIFT_LABELS = { manha: { label: 'Manhã', icon: '☀️' }, tarde: { label: 'Tarde', icon: '🌤' }, noite: { label: 'Noite', icon: '🌙' } }

export default function MuralEquipa() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [channel, setChannel] = useState<Channel>('geral')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<'normal' | 'importante' | 'urgente'>('normal')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [showHandover, setShowHandover] = useState(false)
  const [handoverShift, setHandoverShift] = useState<'manha' | 'tarde' | 'noite'>('manha')
  const [handoverNotes, setHandoverNotes] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  const auth = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/team-messages', { headers: await auth() }).then(r => r.json())
      if (r.error?.includes('sprint105')) { setNeedsSetup(true); setMsgs([]) }
      else if (r.error) setErr(r.error)
      else { setMsgs(r.messages || []); setNeedsSetup(false) }
      fetch('/api/team-messages', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ markRead: true }) }).catch(() => {})
    } catch { setErr('Não foi possível carregar.') }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('team_messages_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_messages' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user, supabase, load])

  const shown = msgs.filter(m => m.channel === channel)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [shown.length, channel])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const body = text.trim()
    const r = await fetch('/api/team-messages', { method: 'POST', headers: await auth(), body: JSON.stringify({ body, channel, priority }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setSending(false)
    if (r.error) { setErr(r.error); return }
    setText(''); setPriority('normal'); load()
  }
  async function toggleResolved(m: Msg) {
    setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, resolved: !x.resolved } : x))
    await fetch('/api/team-messages', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ id: m.id, resolved: !m.resolved }) })
  }

  // Passagem de turno — publica um resumo estruturado no canal Avisos, com o que
  // ficou em aberto (avisos e stock por resolver) + notas de quem sai.
  async function publishHandover() {
    const openAvisos = msgs.filter(m => m.channel === 'avisos' && !m.resolved)
    const openStock = msgs.filter(m => m.channel === 'stock' && !m.resolved)
    const lines = [
      `🔄 PASSAGEM DE TURNO — ${SHIFT_LABELS[handoverShift].label}`,
      openAvisos.length ? `\nAvisos em aberto (${openAvisos.length}):\n` + openAvisos.map(m => `• ${m.body}`).join('\n') : '',
      openStock.length ? `\nStock por resolver (${openStock.length}):\n` + openStock.map(m => `• ${m.body}`).join('\n') : '',
      handoverNotes.trim() ? `\nNotas de quem sai:\n${handoverNotes.trim()}` : '',
    ].filter(Boolean).join('\n')
    setSending(true)
    const r = await fetch('/api/team-messages', { method: 'POST', headers: await auth(), body: JSON.stringify({ body: lines, channel: 'avisos', priority: 'importante' }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setSending(false)
    if (r.error) { setErr(r.error); return }
    setHandoverNotes(''); setShowHandover(false); setChannel('avisos'); load()
  }

  function printHandover() {
    const esc = (s: string) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const openAvisos = msgs.filter(m => m.channel === 'avisos' && !m.resolved)
    const openStock = msgs.filter(m => m.channel === 'stock' && !m.resolved)
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Passagem de Turno</title>
      <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px;line-height:1.6;color:#111}h1{font-size:18px;font-family:Georgia,serif;font-weight:400}h2{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#888;font-family:monospace;margin:14px 0 6px}.item{background:#f5f5f5;padding:8px 12px;border-radius:4px;margin-bottom:6px}</style></head><body>
      <p style="font-size:10px;color:#888;font-family:monospace">PASSAGEM DE TURNO · ${esc(SHIFT_LABELS[handoverShift].label)} · Phlox</p>
      <h1>Passagem de Turno</h1>
      <h2>Avisos em aberto (${openAvisos.length})</h2>
      ${openAvisos.map(m => `<div class="item">${esc(m.body)}</div>`).join('') || '<p>Nenhum.</p>'}
      <h2>Stock por resolver (${openStock.length})</h2>
      ${openStock.map(m => `<div class="item">${esc(m.body)}</div>`).join('') || '<p>Nenhum.</p>'}
      ${handoverNotes.trim() ? `<h2>Notas</h2><p>${esc(handoverNotes.trim())}</p>` : ''}
      </body></html>`)
    w.document.close(); setTimeout(() => { w.focus(); w.print() }, 300)
  }

  const curCh = CHANNELS.find(c => c.id === channel)!
  const openCount = (c: Channel) => msgs.filter(m => m.channel === c && (c === 'stock' || c === 'avisos') && !m.resolved).length

  return (
    <div>
      {needsSetup && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 15px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>Corre o <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint105_team_comms.sql</code> no Supabase para ativar o mural.</div>}
      {err && !needsSetup && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHANNELS.map(c => {
            const n = openCount(c.id)
            return (
              <button key={c.id} onClick={() => setChannel(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 9, border: `1.5px solid ${channel === c.id ? ACCENT : '#e2e8f0'}`, background: channel === c.id ? '#f0fdfa' : 'white', color: channel === c.id ? ACCENT : '#475569', fontSize: 13, fontWeight: channel === c.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                <span>{c.icon}</span>{c.label}
                {n > 0 && <span style={{ background: '#dc2626', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{n}</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => setShowHandover(s => !s)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 9, border: '1.5px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          🔄 Passagem de turno
        </button>
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{curCh.hint}</div>

      {showHandover && (
        <div style={{ background: 'white', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', marginBottom: 10 }}>Gerar passagem de turno</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['manha', 'tarde', 'noite'] as const).map(s => (
              <button key={s} onClick={() => setHandoverShift(s)}
                style={{ flex: 1, padding: 8, border: `1.5px solid ${handoverShift === s ? '#1d4ed8' : 'var(--border)'}`, borderRadius: 7, background: handoverShift === s ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: handoverShift === s ? 700 : 400, color: handoverShift === s ? '#1d4ed8' : '#475569' }}>
                {SHIFT_LABELS[s].icon} {SHIFT_LABELS[s].label}
              </button>
            ))}
          </div>
          <textarea value={handoverNotes} onChange={e => setHandoverNotes(e.target.value)} rows={2} placeholder="Notas de quem sai (opcional)…"
            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '9px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={publishHandover} disabled={sending} style={{ flex: 1, padding: '9px 14px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Publicar em Avisos</button>
            <button onClick={printHandover} style={{ padding: '9px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: '#374151' }}>🖨 Imprimir</button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 14, minHeight: 300, maxHeight: '52vh', overflowY: 'auto', padding: 14, marginBottom: 12 }}>
        {loading ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 30 }}>A carregar…</div>
        : shown.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 40 }}>Sem mensagens em {curCh.label}. Escreve a primeira.</div>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...shown].reverse().map(m => {
              const mine = m.author_id === user?.id
              const canResolve = (m.channel === 'stock' || m.channel === 'avisos')
              return (
                <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ background: mine ? '#f0fdfa' : '#f8fafc', border: `1px solid ${m.priority === 'urgente' ? '#fecaca' : m.priority === 'importante' ? '#fde68a' : '#eceef0'}`, borderRadius: 12, padding: '10px 13px', opacity: m.resolved ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#0b1120' }}>{m.author_name || 'Equipa'}</span>
                      {m.priority !== 'normal' && <span style={{ fontSize: 10, fontWeight: 700, color: PRIO[m.priority].c }}>{PRIO[m.priority].l}</span>}
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{new Date(m.created_at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      {m.resolved && <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700 }}>✓ resolvido</span>}
                    </div>
                    <div style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    {canResolve && <button onClick={() => toggleResolved(m)} style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: m.resolved ? '#94a3b8' : ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{m.resolved ? 'reabrir' : 'marcar resolvido'}</button>}
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>}
      </div>

      <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 12, padding: 12 }}>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
          placeholder={channel === 'stock' ? 'Ex: Fraldas quase a acabar — faltam para 2 dias' : channel === 'doentes' ? `Recado sobre ${cfg.personNounIndef}…` : 'Escreve à equipa…'}
          style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['normal', 'importante', 'urgente'] as const).map(p => (
              <button key={p} onClick={() => setPriority(p)} style={{ padding: '5px 11px', borderRadius: 20, border: `1.5px solid ${priority === p ? PRIO[p].c : '#e2e8f0'}`, background: priority === p ? PRIO[p].c + '12' : 'white', color: priority === p ? PRIO[p].c : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{PRIO[p].l}</button>
            ))}
          </div>
          <button onClick={send} disabled={!text.trim() || sending} style={{ marginLeft: 'auto', padding: '9px 20px', background: text.trim() ? ACCENT : '#e2e8f0', color: text.trim() ? 'white' : '#94a3b8', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{sending ? 'A enviar…' : 'Enviar'}</button>
        </div>
      </div>
    </div>
  )
}
