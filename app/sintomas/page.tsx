'use client'

// Diário de Sintomas — registo diário rápido de bem-estar, por perfil (próprio/familiar).
// Grava AUTOMATICAMENTE no perfil ativo selecionado no topo.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'

interface Log {
  id: string; at: string; feeling: number | null; symptoms: string[] | null
  pain: number | null; temperature: number | null; notes: string | null
}

const FEELING = [
  { v: 1, emoji: '😣', label: 'Muito mal' },
  { v: 2, emoji: '😕', label: 'Mal' },
  { v: 3, emoji: '😐', label: 'Assim-assim' },
  { v: 4, emoji: '🙂', label: 'Bem' },
  { v: 5, emoji: '😄', label: 'Ótimo' },
]
const COMMON = ['Dor de cabeça', 'Febre', 'Tosse', 'Cansaço', 'Náuseas', 'Tonturas', 'Dor', 'Falta de ar', 'Insónia', 'Sem apetite']

export default function SintomasPage() {
  const { user, supabase } = useAuth() as any
  const [profile, setProfile] = useState<ActiveProfile | null>(null)
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [feeling, setFeeling] = useState<number | null>(null)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [pain, setPain] = useState<number | null>(null)
  const [temp, setTemp] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setProfile(getActiveProfile()) }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const { data: sd } = await supabase.auth.getSession()
    const pp = profile?.type === 'family' ? `?profile_id=${profile.id}` : ''
    const res = await fetch(`/api/sintomas${pp}`, { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Erro'); setLogs([]) }
    else setLogs(data.logs || [])
    setLoading(false)
  }, [user, supabase, profile])

  useEffect(() => { load() }, [load])

  function reset() { setFeeling(null); setSymptoms([]); setPain(null); setTemp(''); setNotes('') }

  async function save() {
    if (!user || (feeling == null && symptoms.length === 0 && pain == null && !temp && !notes.trim())) return
    setSaving(true); setErr('')
    const { data: sd } = await supabase.auth.getSession()
    const body: any = { feeling, symptoms, pain, temperature: temp || null, notes: notes.trim() || null }
    if (profile?.type === 'family') body.profile_id = profile.id
    const res = await fetch('/api/sintomas', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error || 'Erro ao guardar') }
    else { setLogs(p => [data, ...p]); reset() }
    setSaving(false)
  }

  async function del(id: string) {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/sintomas', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ id }) })
    setLogs(p => p.filter(l => l.id !== id))
  }

  const who = profile?.type === 'family' ? profile.name : 'mim'
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }
  const canSave = feeling != null || symptoms.length > 0 || pain != null || !!temp || !!notes.trim()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)', paddingTop: 56 }}>
      <div style={{ background: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)', padding: '24px 24px 20px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(21px,3vw,28px)', color: 'white', fontWeight: 400, margin: 0 }}>Diário de Sintomas</h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.9)', margin: '5px 0 0' }}>Como se sente hoje? Regista em segundos — fica guardado no perfil de <strong>{who}</strong>.</p>
          </div>
          <div style={{ background: 'white', borderRadius: 10, padding: 3 }}><ProfileSelector onChange={p => { setProfile(p); setLogs([]); setLoading(true) }} /></div>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Registo rápido */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Como se sente?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {FEELING.map(f => (
              <button key={f.v} onClick={() => setFeeling(feeling === f.v ? null : f.v)} title={f.label}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 10, border: `2px solid ${feeling === f.v ? '#d97706' : 'var(--border)'}`, background: feeling === f.v ? '#fffbeb' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 22 }}>{f.emoji}</span>
                <span style={{ fontSize: 9, color: feeling === f.v ? '#b45309' : 'var(--ink-5)', fontWeight: feeling === f.v ? 700 : 400 }}>{f.label}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sintomas</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {COMMON.map(s => {
              const on = symptoms.includes(s)
              return <button key={s} onClick={() => setSymptoms(p => on ? p.filter(x => x !== s) : [...p, s])}
                style={{ fontSize: 13, padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${on ? '#d97706' : 'var(--border)'}`, background: on ? '#fffbeb' : 'white', color: on ? '#b45309' : 'var(--ink-3)', fontWeight: on ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{on ? '✓ ' : ''}{s}</button>
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>Dor (0-10): {pain ?? '—'}</label>
              <input type="range" min={0} max={10} value={pain ?? 0} onChange={e => setPain(Number(e.target.value))} style={{ width: '100%', accentColor: '#d97706' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>Temperatura (°C)</label>
              <input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)} placeholder="36.8" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '9px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)…" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={save} disabled={!canSave || saving}
            style={{ width: '100%', padding: 13, background: canSave && !saving ? '#d97706' : 'var(--bg-3)', color: canSave && !saving ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: canSave && !saving ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            {saving ? 'A guardar…' : `Registar para ${who}`}
          </button>
          {err && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>{err}</div>}
        </div>

        {/* Histórico */}
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Histórico de {who}</div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>
        ) : logs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem registos ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(l => {
              const f = FEELING.find(x => x.v === l.feeling)
              return (
                <div key={l.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{f?.emoji || '📝'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--ink-5)', marginBottom: 3 }}>{new Date(l.at).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    {l.symptoms?.length ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>{l.symptoms.map((s, i) => <span key={i} style={{ fontSize: 11.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 8px' }}>{s}</span>)}</div> : null}
                    <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                      {f ? f.label : ''}{l.pain != null && l.pain > 0 ? ` · dor ${l.pain}/10` : ''}{l.temperature ? ` · ${l.temperature}°C` : ''}
                    </div>
                    {l.notes && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>{l.notes}</div>}
                  </div>
                  <button onClick={() => del(l.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
