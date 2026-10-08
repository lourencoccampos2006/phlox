'use client'

// Mural da equipa — era a página própria /equipa-mural, agora um separador
// dentro de /equipa. Ganhou a "Passagem de turno" (era do Phlox Ward /teams,
// que não sobrevive como página própria) — aqui adaptada ao nível da equipa
// (sem o feed clínico por doente do Ward, que dependia de outra tabela).

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { useOrgScope } from '@/lib/orgScope'
import MuralPedidos from './MuralPedidos'
import AvisoDeSetup from '@/components/AvisoDeSetup'
import Icon from '@/components/Icon'

const ACCENT = 'var(--green-3)'
type Channel = 'geral' | 'doentes' | 'pedidos' | 'stock' | 'avisos'
interface Msg { id: string; author_id: string; author_name: string; channel: Channel; body: string; priority: 'normal' | 'importante' | 'urgente'; resolved: boolean; patient_id?: string | null; created_at: string; para_ids?: string[] | null; visto_por?: { id: string; nome: string }[] }
/** Um colega, para o seletor de destinatarios. */
interface Colega { user_id: string; nome: string }

const CHANNELS: { id: Channel; label: string; icon: string; hint: string }[] = [
  { id: 'geral',   label: 'Geral',    icon: 'chat', hint: 'Conversa e coordenação da equipa' },
  { id: 'doentes', label: 'Doentes',  icon: 'users', hint: 'Recados sobre quem cuidamos' },
  { id: 'pedidos', label: 'Pedidos',  icon: 'user', hint: 'Pedidos e observações de todos os utentes, registados nas fichas' },
  { id: 'stock',   label: 'Stock',    icon: 'package', hint: 'Falta material, pedidos de compra' },
  { id: 'avisos',  label: 'Avisos',   icon: 'megaphone', hint: 'Informações e recados importantes' },
]
const PRIO = { normal: { l: 'Normal', c: 'var(--ink-4)' }, importante: { l: 'Importante', c: 'var(--amber)' }, urgente: { l: 'Urgente', c: 'var(--red)' } }

export default function MuralEquipa() {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const scope = useOrgScope()
  const [channel, setChannel] = useState<Channel>('geral')
  const [msgs, setMsgs] = useState<Msg[]>([])
  // Quantas pessoas da casa ja abriram o mural alguma vez. E o denominador:
  // «2 viram» sem ele tanto pode ser toda a gente como quase ninguem.
  const [equipa, setEquipa] = useState(0)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [priority, setPriority] = useState<'normal' | 'importante' | 'urgente'>('normal')
  const [sending, setSending] = useState(false)
  // ── Recados dirigidos (sprint156) ────────────────────────────────────────
  // Vazio = para a casa toda, que e o que o mural sempre foi. Escolher pessoas
  // torna o recado privado: so elas e quem o escreveu o leem, e so elas
  // recebem a notificacao. Quem garante isso e a politica `tm_dirigido` na
  // base de dados, nao este ecra.
  const [colegas, setColegas] = useState<Colega[]>([])
  const [para, setPara] = useState<string[]>([])
  const [aEscolherPara, setAEscolherPara] = useState(false)
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
      else { setMsgs(r.messages || []); setEquipa(r.equipa || 0); setNeedsSetup(false) }
      fetch('/api/team-messages', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ markRead: true }) }).catch(() => {})
    } catch { setErr('Não foi possível carregar.') }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { load() }, [load])

  // Os colegas, para o seletor de destinatarios. So os nomes — ver
  // app/api/org/colegas. Carrega uma vez; uma equipa nao muda a meio da tarde.
  useEffect(() => {
    if (!scope.orgId) return
    let vivo = true
    ;(async () => {
      try {
        const r = await fetch(`/api/org/colegas?org=${encodeURIComponent(scope.orgId!)}`, { headers: await auth() })
        if (!r.ok) return
        const j = await r.json()
        if (vivo) setColegas(j.colegas || [])
      } catch { /* sem lista, o mural continua a funcionar para a casa toda */ }
    })()
    return () => { vivo = false }
  }, [scope.orgId, auth])

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
    const r = await fetch('/api/team-messages', { method: 'POST', headers: await auth(), body: JSON.stringify({ body, channel, priority, para_ids: para }) }).then(r => r.json()).catch(() => ({ error: 'falhou' }))
    setSending(false)
    if (r.error) { setErr(r.error); return }
    setText(''); setPriority('normal'); setPara([]); setAEscolherPara(false); load()
  }
  async function toggleResolved(m: Msg) {
    setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, resolved: !x.resolved } : x))
    await fetch('/api/team-messages', { method: 'PATCH', headers: await auth(), body: JSON.stringify({ id: m.id, resolved: !m.resolved }) })
  }



  const curCh = CHANNELS.find(c => c.id === channel)!
  const openCount = (c: Channel) => msgs.filter(m => m.channel === c && (c === 'stock' || c === 'avisos') && !m.resolved).length

  return (
    <div>
      {needsSetup && <AvisoDeSetup codigo="PHX-D6" oQue="O mural da equipa ainda não está disponível nesta conta." />}
      {err && !needsSetup && <div style={{ background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', color: 'var(--red)', borderRadius: 'var(--r-lg)', padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CHANNELS.map(c => {
            const n = openCount(c.id)
            return (
              <button key={c.id} onClick={() => setChannel(c.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 'var(--r-lg)', border: `1.5px solid ${channel === c.id ? ACCENT : 'var(--border)'}`, background: channel === c.id ? 'var(--green-light)' : 'white', color: channel === c.id ? ACCENT : 'var(--ink-3)', fontSize: 13, fontWeight: channel === c.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                <span><Icon name={c.icon} size={16} /></span>{c.label}
                {n > 0 && <span style={{ background: 'var(--red)', color: 'white', borderRadius: 'var(--r-lg)', padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{n}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-5)', marginBottom: 12 }}>{curCh.hint}</div>

      {channel === 'pedidos' ? (
        <MuralPedidos />
      ) : (
        <>
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', minHeight: 300, maxHeight: '52vh', overflowY: 'auto', padding: 14, marginBottom: 12 }}>
            {loading ? <div style={{ color: 'var(--ink-5)', fontSize: 13, textAlign: 'center', padding: 30 }}>A carregar…</div>
            : shown.length === 0 ? <div style={{ color: 'var(--ink-5)', fontSize: 13, textAlign: 'center', padding: 40 }}>Sem mensagens em {curCh.label}. Escreve a primeira.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[...shown].reverse().map(m => {
                  const mine = m.author_id === user?.id
                  const canResolve = (m.channel === 'stock' || m.channel === 'avisos')
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ background: mine ? 'var(--green-light)' : 'var(--bg-2)', border: `1px solid ${m.priority === 'urgente' ? 'var(--badge-red-border)' : m.priority === 'importante' ? 'var(--badge-amber-border)' : 'var(--bg-3)'}`, borderRadius: 'var(--r-xl)', padding: '10px 13px', opacity: m.resolved ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{m.author_name || 'Equipa'}</span>
                          {m.priority !== 'normal' && <span style={{ fontSize: 10, fontWeight: 700, color: PRIO[m.priority].c }}>{PRIO[m.priority].l}</span>}
                          <span style={{ fontSize: 10.5, color: 'var(--ink-5)' }}>{new Date(m.created_at).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          {m.resolved && <span style={{ fontSize: 10.5, color: 'var(--green)', fontWeight: 700 }}>✓ resolvido</span>}
                          {/* Quem escreve um recado dirigido tem de VER que ele
                              e dirigido. Sem isto, alguem escreve para uma
                              colega a achar que a casa toda leu — ou o
                              contrario, que e pior. */}
                          {m.para_ids && m.para_ids.length > 0 && (
                            <span style={{
                              fontSize: 10, fontWeight: 700, color: ACCENT,
                              background: ACCENT + '14', borderRadius: 'var(--r-xl)', padding: '2px 8px',
                            }}>
                              só para {m.para_ids
                                .map(id => id === user?.id ? 'ti' : (colegas.find(c => c.user_id === id)?.nome || '').split(' ')[0])
                                .filter(Boolean).join(', ') || `${m.para_ids.length} pessoas`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                        {/* Quem ja abriu o mural depois disto.
                            Diz «viram» e nunca «leram»: o que ha na base de
                            dados e UMA marca por pessoa — a hora a que abriu o
                            mural pela ultima vez — e nao um registo por
                            mensagem. Daqui sabe-se que a pessoa esteve ca
                            depois; nao se sabe que leu. Chamar-lhe «leu» seria
                            dar a casa uma certeza que o Phlox nao tem.
                            Para quando e preciso mesmo saber, ha a passagem de
                            turno, com botao e uma linha por pessoa. */}
                        {mine && m.visto_por && m.visto_por.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--ink-5)', lineHeight: 1.45 }}>
                            Viram: {m.visto_por.map(v => v.nome.split(' ')[0]).join(', ')}
                            {equipa > 1 && ` (${m.visto_por.length} de ${equipa - 1})`}
                          </div>
                        )}
                        {mine && m.visto_por && m.visto_por.length === 0 && (
                          <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--ink-5)' }}>
                            Ainda ninguem abriu o mural depois disto.
                          </div>
                        )}
                        {canResolve && <button onClick={() => toggleResolved(m)} style={{ marginTop: 6, fontSize: 11.5, fontWeight: 700, color: m.resolved ? 'var(--ink-5)' : ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>{m.resolved ? 'reabrir' : 'marcar resolvido'}</button>}
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>}
          </div>

          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 12 }}>
            {/* Para quem. Fechado por omissao: a esmagadora maioria dos recados
                e para a casa toda, e um seletor sempre aberto so acrescenta um
                passo a cada mensagem. */}
            {colegas.length > 0 && (
              <div style={{ marginBottom: 9 }}>
                <button
                  onClick={() => setAEscolherPara(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px',
                    borderRadius: 'var(--r-xl)', minHeight: 32, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${para.length ? ACCENT : 'var(--border)'}`,
                    background: para.length ? ACCENT + '12' : 'white',
                    color: para.length ? ACCENT : 'var(--ink-4)', fontSize: 12, fontWeight: 600,
                  }}>
                  {para.length === 0
                    ? 'Para: toda a equipa'
                    : para.length === 1
                      ? `Para: ${colegas.find(c => c.user_id === para[0])?.nome || '1 pessoa'}`
                      : `Para: ${para.length} pessoas`}
                  <span style={{ fontSize: 10, opacity: 0.7 }}>{aEscolherPara ? '▲' : '▼'}</span>
                </button>

                {para.length > 0 && (
                  <span style={{ marginLeft: 9, fontSize: 11.5, color: 'var(--ink-4)' }}>
                    Só estas pessoas veem este recado.
                  </span>
                )}

                {aEscolherPara && (
                  <div style={{
                    marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
                    background: 'var(--bg-2)', maxHeight: 190, overflowY: 'auto',
                  }}>
                    <button
                      onClick={() => setPara([])}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '7px 9px',
                        borderRadius: 'var(--r-md)', minHeight: 36, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1.5px solid ${para.length === 0 ? ACCENT : 'transparent'}`,
                        background: para.length === 0 ? 'white' : 'transparent',
                        fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 4,
                      }}>Toda a equipa</button>
                    {colegas.map(c => {
                      const escolhido = para.includes(c.user_id)
                      return (
                        <button key={c.user_id}
                          onClick={() => setPara(p => escolhido ? p.filter(x => x !== c.user_id) : [...p, c.user_id])}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                            padding: '7px 9px', borderRadius: 'var(--r-md)', minHeight: 36, cursor: 'pointer',
                            fontFamily: 'inherit', border: 'none',
                            background: escolhido ? ACCENT + '12' : 'transparent',
                            fontSize: 13, fontWeight: escolhido ? 700 : 500, color: 'var(--ink)',
                          }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: 'var(--r)', flexShrink: 0,
                            border: `1.5px solid ${escolhido ? ACCENT : 'var(--border-2)'}`,
                            background: escolhido ? ACCENT : 'white',
                            color: 'white', fontSize: 11, lineHeight: '13px', textAlign: 'center',
                          }}>{escolhido ? '✓' : ''}</span>
                          {c.nome}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <textarea value={text} onChange={e => setText(e.target.value)} rows={2}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send() }}
              placeholder={channel === 'stock' ? 'Ex: Fraldas quase a acabar — faltam para 2 dias' : channel === 'doentes' ? `Recado sobre ${cfg.personNounIndef}…` : 'Escreve à equipa…'}
              style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['normal', 'importante', 'urgente'] as const).map(p => (
                  <button key={p} onClick={() => setPriority(p)} style={{ padding: '5px 11px', borderRadius: 'var(--r-xl)', border: `1.5px solid ${priority === p ? PRIO[p].c : 'var(--border)'}`, background: priority === p ? PRIO[p].c + '12' : 'white', color: priority === p ? PRIO[p].c : 'var(--ink-4)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{PRIO[p].l}</button>
                ))}
              </div>
              <button onClick={send} disabled={!text.trim() || sending} style={{ marginLeft: 'auto', padding: '9px 20px', background: text.trim() ? ACCENT : 'var(--border)', color: text.trim() ? 'white' : 'var(--ink-5)', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 14, fontWeight: 700, cursor: text.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>{sending ? 'A enviar…' : 'Enviar'}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
