'use client'

// /painel-dono — Painel do Dono (só owner/admin da organização).
// Mostra a linha do tempo de "quem fez o quê a quem" na instituição: medicação
// dada, registos do dia, ocorrências — com nome de quem fez, utente, data e hora.
// Os funcionários NÃO veem esta página (a API valida o papel; aqui escondemos).

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#0d9488'

interface Ev { kind: string; icon: string; at: string; who: string; patient: string; detail: string; shift?: string; severity?: string }

export default function PainelDonoPage() {
  const { user, supabase } = useAuth() as any
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [events, setEvents] = useState<Ev[]>([])
  const [byStaff, setByStaff] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState({ meds: 0, care: 0, incidents: 0 })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    try {
      const { data: sd } = await supabase.auth.getSession()
      const r = await fetch(`/api/org/audit?date=${date}`, { headers: { Authorization: `Bearer ${sd?.session?.access_token}` } })
      const d = await r.json()
      if (!r.ok) { setErr(d.error || 'Sem acesso.'); setEvents([]); setLoading(false); return }
      setEvents(d.events || []); setByStaff(d.byStaff || {}); setTotals(d.totals || { meds: 0, care: 0, incidents: 0 })
    } catch (e: any) { setErr(e.message) }
    setLoading(false)
  }, [user, supabase, date])

  useEffect(() => { load() }, [load])

  if (!user) return null

  const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 14, padding: '18px 20px' }
  const staffRows = Object.entries(byStaff).sort((a, b) => b[1] - a[1])

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px clamp(14px,3vw,28px) 70px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Painel do dono</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 400, color: '#0b1120', margin: 0, letterSpacing: '-0.02em' }}>Registo de tudo</h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '6px 0 0', maxWidth: 540, lineHeight: 1.5 }}>Quem deu a medicação a quem, e todos os registos da equipa — com data e hora. Fica tudo registado.</p>
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: 9, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
        </div>

        {err && (
          <div style={{ ...card, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}>
            {err} {err.includes('dono') && <Link href="/equipa" style={{ color: '#991b1b', fontWeight: 700 }}>· Voltar à equipa</Link>}
          </div>
        )}

        {!err && (
          <>
            {/* Resumo do dia */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 16 }}>
              {[
                { n: totals.meds, l: 'tomas de medicação', c: '#dc2626' },
                { n: totals.care, l: 'registos do dia', c: ACCENT },
                { n: totals.incidents, l: 'ocorrências', c: '#b45309' },
              ].map(s => (
                <div key={s.l} style={{ ...card, borderLeft: `3px solid ${s.c}` }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#0b1120', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Por funcionário */}
            {staffRows.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>Atividade por funcionário</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffRows.map(([name, n]) => (
                    <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#f0fdfa', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{(name || '?')[0].toUpperCase()}</span>
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#0b1120' }}>{name}</span>
                      <span style={{ fontSize: 12.5, color: '#64748b' }}>{n} {n === 1 ? 'registo' : 'registos'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Linha do tempo */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>Linha do tempo</div>
              {loading ? <div style={{ color: '#94a3b8', fontSize: 13 }}>A carregar…</div>
              : events.length === 0 ? <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Sem registos neste dia.</div>
              : <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {events.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '11px 0', borderBottom: i < events.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{e.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, color: '#0b1120', lineHeight: 1.5 }}>
                          <strong>{e.who}</strong> {e.detail} {e.kind !== 'care' && <>a <strong>{e.patient}</strong></>}{e.kind === 'care' && <> de <strong>{e.patient}</strong></>}
                          {e.severity && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: e.severity === 'high' || e.severity === 'grave' ? '#dc2626' : '#b45309' }}>· {e.severity}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {e.at ? new Date(e.at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'}{e.shift ? ` · turno ${e.shift}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>}
            </div>

            <p style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 14, lineHeight: 1.6 }}>
              Este registo serve a responsabilidade do serviço e a segurança dos utentes. O acesso é exclusivo do dono e administradores da instituição (RGPD — responsável pelo tratamento).
            </p>
          </>
        )}
      </div>
    </div>
  )
}
