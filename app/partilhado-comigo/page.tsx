'use client'

// /partilhado-comigo — Convite de Visualização, lado do VIEWER (item B9 da
// auditoria). Resgatar um código de outra pessoa (dono do perfil) e ver, só em
// leitura, medicação/vitais/sintomas dela — sem precisar de ser Pro para ver
// (só o dono precisa de Pro para convidar).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const ACCENT = '#1d4ed8'
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

interface Shared { profile_id: string; name: string; relation: string | null }
interface ViewData {
  profile: { name: string; relation?: string; age?: number; sex?: string; conditions?: string; allergies?: string; notes?: string }
  meds: { name: string; dose?: string; frequency?: string }[]
  vitals: { recorded_at: string; bp_sys?: number; bp_dia?: number; hr?: number; weight?: number; glucose?: number }[]
  symptoms: { at: string; symptoms?: string[]; pain?: number; notes?: string }[]
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

export default function PartilhadoComigoPage() {
  const { user, supabase } = useAuth() as any
  const [shared, setShared] = useState<Shared[] | null>(null)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [err, setErr] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [viewData, setViewData] = useState<Record<string, ViewData>>({})

  async function auth() { const { data } = await supabase.auth.getSession(); return data?.session?.access_token || '' }

  const load = useCallback(async () => {
    if (!user) return
    const res = await fetch('/api/family-share/mine', { headers: { Authorization: `Bearer ${await auth()}` } })
    if (res.ok) { const j = await res.json(); setShared(j.shared || []) }
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  async function redeem() {
    if (!code.trim()) return
    setRedeeming(true); setErr('')
    try {
      const res = await fetch('/api/family-share/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await auth()}` },
        body: JSON.stringify({ code: code.trim() }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Código inválido')
      setCode('')
      load()
    } catch (e: any) { setErr(e.message || 'Erro ao resgatar o código.') }
    finally { setRedeeming(false) }
  }

  async function expand(profileId: string) {
    if (expanded === profileId) { setExpanded(null); return }
    setExpanded(profileId)
    if (!viewData[profileId]) {
      const res = await fetch(`/api/family-share/view?profile_id=${profileId}`, { headers: { Authorization: `Bearer ${await auth()}` } })
      if (res.ok) { const j = await res.json(); setViewData(prev => ({ ...prev, [profileId]: j })) }
    }
  }

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <a href="/login" style={{ color: ACCENT, fontWeight: 700 }}>Iniciar sessão →</a>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ background: `linear-gradient(135deg, ${ACCENT}, #1e3a8a)`, padding: '26px 24px 22px' }}>
        <div className="page-container">
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'white', fontWeight: 400, margin: 0 }}>Partilhado comigo</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: '6px 0 0', maxWidth: 560, lineHeight: 1.5 }}>Perfis de família que outra pessoa te deu acesso a ver — medicação, vitais e sintomas, só em leitura.</p>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Tens um código de convite?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: A1B2C3D4"
              style={{ flex: 1, border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={redeem} disabled={redeeming} style={{ padding: '9px 18px', background: ACCENT, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: redeeming ? 'wait' : 'pointer' }}>
              {redeeming ? '…' : 'Resgatar'}
            </button>
          </div>
          {err && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8 }}>{err}</div>}
        </div>

        {shared === null ? (
          <div className="skeleton" style={{ height: 100, borderRadius: 12 }} />
        ) : shared.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Ainda ninguém partilhou um perfil contigo.</div>
        ) : (
          shared.map(s => {
            const vd = viewData[s.profile_id]
            const isOpen = expanded === s.profile_id
            return (
              <div key={s.profile_id} style={card}>
                <button onClick={() => expand(s.profile_id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{s.name}</div>
                    {s.relation && <div style={{ fontSize: 11.5, color: ACCENT, fontWeight: 700, textTransform: 'uppercase' }}>{s.relation}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{isOpen ? '▲ Fechar' : '▼ Ver'}</span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: '1px solid var(--bg-3)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {!vd ? (
                      <div className="skeleton" style={{ height: 60, borderRadius: 8 }} />
                    ) : (
                      <>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                          {vd.profile.age && <span>{vd.profile.age} anos · </span>}
                          {vd.profile.allergies && <span style={{ color: '#dc2626' }}>⚠ Alergias: {vd.profile.allergies} · </span>}
                          {vd.profile.conditions && <span>Condições: {vd.profile.conditions}</span>}
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>💊 Medicação ({vd.meds.length})</div>
                          {vd.meds.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--ink-4)' }}>Sem medicação registada.</div> :
                            vd.meds.map((m, i) => <div key={i} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {m.name}{m.dose ? ` — ${m.dose}` : ''}{m.frequency ? ` (${m.frequency})` : ''}</div>)}
                        </div>
                        {vd.vitals.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>📈 Vitais recentes</div>
                            {vd.vitals.slice(0, 5).map((v, i) => (
                              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                                <span style={{ color: 'var(--ink-4)', minWidth: 60 }}>{timeAgo(v.recorded_at)}</span>
                                {v.bp_sys != null && <span>🩸 {v.bp_sys}/{v.bp_dia ?? '—'}</span>}
                                {v.weight != null && <span>⚖️ {v.weight}kg</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        {vd.symptoms.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', marginBottom: 6 }}>📝 Sintomas recentes</div>
                            {vd.symptoms.slice(0, 5).map((sm, i) => (
                              <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                                <span style={{ color: 'var(--ink-4)' }}>{timeAgo(sm.at)}: </span>
                                {sm.symptoms?.length ? sm.symptoms.join(', ') : 'sem sintomas descritos'}
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
