'use client'

// /equipa-mural — Comunicação da equipa (institucional).
// Mural por organização com canais: Geral, Doentes, Stock, Avisos. Cada
// funcionário escreve, todos veem em tempo real, e os outros recebem push.
// Avisos/pedidos podem ser marcados como resolvidos (ex.: stock encomendado).

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

export default function EquipaMuralPage() {
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
      // marca como lido
      fetch('/api/team-messages', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ markRead: true }) }).catch(() => {})
    } catch { setErr('Não foi possível carregar.') }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { load() }, [load])

  // Tempo real: qualquer nova mensagem da org aparece a todos sem recarregar.
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

  const curCh = CHANNELS.find(c => c.id === channel)!
  const openCount = (c: Channel) => msgs.filter(m => m.channel === c && (c === 'stock' || c === 'avisos') && !m.resolved).length

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '22px clamp(14px,3vw,26px) 40px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Equipa</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,4vw,30px)', fontWeight: 400, color: '#0b1120', margin: '0 0 4px' }}>Mural da equipa</h1>
        <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 18px' }}>Todos veem, todos escrevem. Os outros recebem aviso no telemóvel.</p>

        {needsSetup && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '11px 15px', fontSize: 13, color: '#92400e', marginBottom: 14 }}>Corre o <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint105_team_comms.sql</code> no Supabase para ativar o mural.</div>}
        {err && !needsSetup && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}

        {/* Canais */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
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
        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>{curCh.hint}</div>

        {/* Lista */}
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

        {/* Compor */}
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
    </div>
  )
}
