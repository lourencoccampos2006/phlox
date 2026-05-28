'use client'

// Phlox Health Pass — lado do DOENTE. Ativa uma partilha (escolhe secções), mostra QR + PIN
// ao profissional, vê o histórico de visitas e as devoluções (medicação/consultas/notas).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface Session { id: string; token: string; pin: string; sections: string[]; expires_at: string }
interface Visit { id: string; at: string; professional_name?: string; institution?: string; reason?: string; notes?: string }
interface Ret { id: string; kind: string; payload: any; from_professional?: string }

const SECTIONS = [
  { k: 'allergies', label: 'Alergias', always: true },
  { k: 'meds', label: 'Medicação atual', always: true },
  { k: 'conditions', label: 'Condições / diagnósticos' },
  { k: 'symptoms', label: 'Sintomas recentes' },
  { k: 'vitals', label: 'Sinais vitais' },
  { k: 'visits', label: 'Visitas anteriores' },
]

export default function HealthPassPage() {
  const { user, supabase } = useAuth() as any
  const [profile, setProfile] = useState<ActiveProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [returns, setReturns] = useState<Ret[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [chosen, setChosen] = useState<string[]>(['allergies', 'meds', 'conditions', 'vitals', 'visits'])
  const [minutes, setMinutes] = useState(15)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => { setProfile(getActiveProfile()) }, [])
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const { data: sd } = await supabase.auth.getSession()
    const pp = profile?.type === 'family' ? `?profile_id=${profile.id}` : ''
    const res = await fetch(`/api/health-pass/session${pp}`, { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
    const d = await res.json()
    if (!res.ok) { setErr(d.error || 'Erro'); setLoading(false); return }
    setSession(d.session); setVisits(d.visits || []); setReturns(d.returns || [])
    setLoading(false)
  }, [user, supabase, profile])

  useEffect(() => { load() }, [load])

  async function create() {
    setCreating(true)
    const { data: sd } = await supabase.auth.getSession()
    const body: any = { sections: chosen, minutes }
    if (profile?.type === 'family') body.profile_id = profile.id
    const res = await fetch('/api/health-pass/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify(body) })
    const d = await res.json()
    if (res.ok) setSession(d); else setErr(d.error || 'Erro')
    setCreating(false)
  }
  async function revoke() {
    if (!session) return
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/health-pass/session', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ revoke: session.id }) })
    setSession(null)
  }
  async function dismiss(id: string) {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/health-pass/session', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ dismissReturn: id }) })
    setReturns(p => p.filter(r => r.id !== id)); load()
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = session ? `${origin}/hp/${session.token}` : ''
  const minsLeft = session ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - now) / 60000)) : 0
  const secsLeft = session ? Math.max(0, Math.floor((new Date(session.expires_at).getTime() - now) / 1000) % 60) : 0
  const expired = session && new Date(session.expires_at).getTime() < now

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const toggle = (k: string) => setChosen(p => p.includes(k) ? p.filter(x => x !== k) : [...p, k])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', padding: '24px 24px 20px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox · Health Pass</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(21px,3vw,28px)', color: 'white', fontWeight: 400, margin: 0 }}>O meu QR de saúde</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.85)', margin: '5px 0 0', maxWidth: 520 }}>Mostra este código na farmácia, clínica ou centro de saúde. O profissional vê o que escolheres — sem precisar de conta.</p>
          </div>
          <div style={{ background: 'white', borderRadius: 10, padding: 3 }}><ProfileSelector onChange={p => { setProfile(p); setSession(null) }} /></div>
        </div>
      </div>

      <div className="page-container page-body" style={{ maxWidth: 760 }}>
        {err && <div style={{ ...card, marginBottom: 14, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e', fontSize: 13 }}>{err}</div>}

        {/* Devoluções pendentes */}
        {returns.length > 0 && (
          <div style={{ ...card, marginBottom: 14, borderColor: '#bfdbfe', background: '#eff6ff' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 10 }}>📥 O profissional enviou-te {returns.length} item(s)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {returns.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, background: 'white', border: '1px solid #bfdbfe', borderRadius: 9, padding: '9px 12px' }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    <strong>{r.kind === 'medication' ? '💊 Medicação' : r.kind === 'appointment' ? '📅 Consulta' : '📝 Nota'}</strong>
                    {r.from_professional ? ` · ${r.from_professional}` : ''}
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>{r.payload?.text || r.payload?.name || JSON.stringify(r.payload)}</div>
                  </div>
                  <button onClick={() => dismiss(r.id)} style={{ flexShrink: 0, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>Arquivar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessão ativa OU criar */}
        {session && !expired ? (
          <div style={{ ...card, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-block', background: 'white', padding: 10, borderRadius: 12, border: '1px solid var(--border)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`} alt="QR" style={{ width: 200, height: 200, display: 'block' }} />
            </div>
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Código para o profissional</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: '#0f172a', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>{session.pin}</div>
            <div style={{ fontSize: 13, color: minsLeft <= 2 ? '#dc2626' : 'var(--ink-4)', marginTop: 4 }}>Expira em {minsLeft}:{String(secsLeft).padStart(2, '0')}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => navigator.clipboard?.writeText(`${url}`)} style={{ padding: '9px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--ink-2)' }}>Copiar link</button>
              <button onClick={revoke} style={{ padding: '9px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>Terminar partilha</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 12 }}>A partilhar: {session.sections.map(s => SECTIONS.find(x => x.k === s)?.label || s).join(' · ')}</div>
          </div>
        ) : (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>O que queres partilhar?</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginBottom: 12 }}>Alergias e medicação vão sempre. Escolhe o resto.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {SECTIONS.map(s => {
                const on = s.always || chosen.includes(s.k)
                return (
                  <button key={s.k} onClick={() => !s.always && toggle(s.k)} disabled={s.always}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: `1.5px solid ${on ? '#0d6e42' : 'var(--border)'}`, background: on ? '#eef6f1' : 'white', cursor: s.always ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: on ? '#0d6e42' : 'white', border: `1.5px solid ${on ? '#0d6e42' : 'var(--border)'}`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>{on ? '✓' : ''}</span>
                    <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: on ? 600 : 400 }}>{s.label}</span>
                    {s.always && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-5)', textTransform: 'uppercase' }}>sempre</span>}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Expira em</span>
              {[15, 30, 60].map(m => <button key={m} onClick={() => setMinutes(m)} style={{ padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${minutes === m ? '#0d6e42' : 'var(--border)'}`, background: minutes === m ? '#eef6f1' : 'white', color: minutes === m ? '#0d6e42' : 'var(--ink-4)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{m} min</button>)}
            </div>
            <button onClick={create} disabled={creating} style={{ width: '100%', padding: 14, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{creating ? 'A gerar…' : 'Gerar QR de partilha'}</button>
          </div>
        )}

        {/* Histórico de visitas */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '4px 0 8px' }}>Histórico de visitas</div>
        {loading ? <div className="skeleton" style={{ height: 60, borderRadius: 10 }} /> : visits.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem visitas registadas. Quando um profissional abrir o teu QR e registar a visita, aparece aqui.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visits.map(v => (
              <div key={v.id} style={{ ...card, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{v.reason || 'Consulta'}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>{new Date(v.at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>{[v.institution, v.professional_name].filter(Boolean).join(' · ')}</div>
                {v.notes && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5, background: 'var(--bg-2)', borderRadius: 8, padding: '8px 11px' }}>{v.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
