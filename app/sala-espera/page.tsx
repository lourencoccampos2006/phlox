'use client'

// Sala de espera / fila — para quem chega à instituição, MESMO sem conta Phlox.
// A secretaria/receção faz o check-in em segundos; a equipa chama, atende e fecha.
// Resolve o problema das instituições sem doentes fixos: dá valor a cada visita ocasional.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

interface W {
  id: string; name: string; reason?: string | null; priority: 'urgente' | 'prioritario' | 'normal'
  status: 'waiting' | 'called' | 'in_service' | 'done' | 'left'; professional?: string | null
  arrived_at: string; called_at?: string | null; done_at?: string | null; patient_id?: string | null
}

const PRI: Record<string, { label: string; color: string; bg: string; rank: number }> = {
  urgente:     { label: 'Urgente',     color: '#dc2626', bg: '#fef2f2', rank: 0 },
  prioritario: { label: 'Prioritário', color: '#d97706', bg: '#fffbeb', rank: 1 },
  normal:      { label: 'Normal',      color: '#2563eb', bg: '#eff6ff', rank: 2 },
}
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

function waitMin(from: string) { return Math.max(0, Math.round((Date.now() - new Date(from).getTime()) / 60000)) }

// Fundido no "Balcão" (/balcao) como aba "Sala de espera" (SalaEsperaTool reutilizado).
export default function SalaEsperaRedirect() {
  const r = useRouter()
  useEffect(() => { r.replace('/balcao?tab=sala') }, [r])
  return null
}

export function SalaEsperaTool() {
  const { user, supabase } = useAuth() as any
  const [rows, setRows] = useState<W[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', reason: '', priority: 'normal' as const }
  const [form, setForm] = useState<any>(blank)
  const [, setTick] = useState(0) // re-render para tempos de espera

  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t) }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { data, error } = await supabase.from('waiting_room').select('*').eq('user_id', user.id)
      .gte('arrived_at', todayStart.toISOString()).order('arrived_at', { ascending: true })
    if (error) { if (/relation .*waiting_room.* does not exist/i.test(error.message)) setMissing(true); setRows([]) }
    else { setMissing(false); setRows(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'waiting_room', userId: user?.id, onChange: load })

  async function add() {
    if (!form.name.trim()) { setErr('Indica o nome de quem chegou.'); return }
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('waiting_room').insert({
      user_id: user.id, name: form.name.trim(), reason: form.reason.trim() || null, priority: form.priority, status: 'waiting',
    }).select().single()
    if (!error && data) { setRows(p => [...p, data]); setShowForm(false); setForm(blank) }
    else setErr(error?.message || 'Erro')
    setSaving(false)
  }
  async function setStatus(r: W, status: W['status']) {
    const patch: any = { status }
    if (status === 'called') patch.called_at = new Date().toISOString()
    if (status === 'done' || status === 'left') patch.done_at = new Date().toISOString()
    if (status === 'called') patch.professional = user?.name || null
    await supabase.from('waiting_room').update(patch).eq('id', r.id)
    setRows(p => p.map(x => x.id === r.id ? { ...x, ...patch } : x))
  }
  async function del(id: string) {
    await supabase.from('waiting_room').delete().eq('id', id)
    setRows(p => p.filter(x => x.id !== id))
  }

  const active = rows.filter(r => r.status === 'waiting' || r.status === 'called' || r.status === 'in_service')
    .sort((a, b) => (PRI[a.priority].rank - PRI[b.priority].rank) || (new Date(a.arrived_at).getTime() - new Date(b.arrived_at).getTime()))
  const waiting = active.filter(r => r.status === 'waiting')
  const inService = active.filter(r => r.status === 'called' || r.status === 'in_service')
  const closed = rows.filter(r => r.status === 'done' || r.status === 'left')
  const avgWait = closed.length ? Math.round(closed.reduce((s, r) => s + (r.called_at ? (new Date(r.called_at).getTime() - new Date(r.arrived_at).getTime()) / 60000 : 0), 0) / closed.length) : 0

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 920 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Receção</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Sala de espera</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Faz o check-in de quem chega — mesmo sem conta Phlox. A equipa chama por prioridade e ordem de chegada.</p>
          </div>
          <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Check-in</button>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Sala de espera por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint32_institution_ops.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { n: waiting.length, l: 'A aguardar', c: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe' },
                { n: inService.length, l: 'A ser atendidos', c: '#0d9488', bg: '#f0fdfa', bd: '#99f6e4' },
                { n: closed.length, l: 'Concluídos hoje', c: '#16a34a', bg: '#f0fdf4', bd: '#bbf7d0' },
                { n: avgWait ? `${avgWait}m` : '—', l: 'Espera média', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 120px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {err && !missing && <div style={{ ...card, marginBottom: 12, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', fontSize: 13 }}>{err}</div>}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}</div>
            ) : active.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sala de espera vazia. Faz o primeiro check-in com “+ Check-in”.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {active.map(r => {
                  const pri = PRI[r.priority]
                  const inServ = r.status === 'called' || r.status === 'in_service'
                  return (
                    <div key={r.id} style={{ ...card, padding: '12px 16px', borderLeft: `3px solid ${pri.color}`, background: inServ ? '#f0fdfa' : 'white' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: pri.color, background: pri.bg, padding: '2px 8px', borderRadius: 5 }}>{pri.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{r.name}</span>
                            {inServ && <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0d9488' }}>● a ser atendido{r.professional ? ` · ${r.professional}` : ''}</span>}
                          </div>
                          {r.reason && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>{r.reason}</div>}
                          <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>chegou às {new Date(r.arrived_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} · espera {waitMin(r.arrived_at)} min</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {r.status === 'waiting' && <button onClick={() => setStatus(r, 'called')} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#0d9488', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' }}>Chamar</button>}
                          {inServ && <button onClick={() => setStatus(r, 'done')} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: '#16a34a', border: 'none', borderRadius: 7, padding: '6px 12px', cursor: 'pointer' }}>Concluir</button>}
                          <button onClick={() => setStatus(r, 'left')} title="Desistiu / saiu" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-4)', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', cursor: 'pointer' }}>Saiu</button>
                          <button onClick={() => del(r.id)} style={{ fontSize: 16, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {closed.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', marginBottom: 8 }}>Concluídos hoje ({closed.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {closed.slice().reverse().slice(0, 12).map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, color: 'var(--ink-3)', padding: '6px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                      <span>{r.name}{r.reason ? ` · ${r.reason}` : ''}{r.status === 'left' ? ' · saiu' : ''}</span>
                      <span style={{ color: '#9ca3af' }}>{r.done_at ? new Date(r.done_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 18, textAlign: 'center' }}>
              Quem chega tem conta Phlox? Pede o <Link href="/health-pass" style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>Health Pass</Link> para ver o histórico de saúde.
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 460, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Check-in</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>Nome</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome de quem chegou" style={inp} autoFocus /></div>
              <div><span style={lbl}>Motivo (opcional)</span><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Ex: consulta, medição de TA, dúvida…" style={inp} /></div>
              <div>
                <span style={lbl}>Prioridade</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['urgente', 'prioritario', 'normal'] as const).map(k => (
                    <button key={k} onClick={() => setForm({ ...form, priority: k })} style={{ flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${form.priority === k ? PRI[k].color : 'var(--border)'}`, background: form.priority === k ? PRI[k].bg : 'white', color: form.priority === k ? PRI[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{PRI[k].label}</button>
                  ))}
                </div>
              </div>
              <button onClick={add} disabled={saving} style={{ padding: 12, background: '#0d9488', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : 'Adicionar à fila'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
