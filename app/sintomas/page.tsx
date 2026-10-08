'use client'

// Diário de Sintomas — registo diário rápido de bem-estar, por perfil (próprio/familiar).
// Grava AUTOMATICAMENTE no perfil ativo selecionado no topo.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import ProfileSelector from '@/components/ProfileSelector'
import { getActiveProfile, type ActiveProfile } from '@/lib/profileContext'
import Icon from '@/components/Icon'
import {
  Mesa, BarraDeTrabalho, BarraDeEstado, Painel, Botao, Seletor,
  Codigo, Vazio, ACarregar, Aviso, CAIXA, MONO, ROTULO, useLargo,
} from '@/components/ui/mesa'

interface Log {
  id: string; at: string; feeling: number | null; symptoms: string[] | null
  pain: number | null; temperature: number | null; notes: string | null
}

const FEELING = [
  { v: 1, emoji: '😣', label: 'Muito mal', color: 'var(--red)' },
  { v: 2, emoji: '😕', label: 'Mal', color: 'var(--amber)' },
  { v: 3, emoji: '😐', label: 'Assim-assim', color: 'var(--amber)' },
  { v: 4, emoji: '🙂', label: 'Bem', color: 'var(--green)' },
  { v: 5, emoji: '😄', label: 'Ótimo', color: 'var(--green)' },
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
  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: '16px 18px' }
  const canSave = feeling != null || symptoms.length > 0 || pain != null || !!temp || !!notes.trim()

  return (
        <Mesa
      altura="documento"
      barra={
        <BarraDeTrabalho>
          <span style={{
            ...MONO, fontSize: 'var(--t-micro)', letterSpacing: '.14em',
            textTransform: 'uppercase', color: 'var(--green)',
            fontWeight: 'var(--peso-forte)' as any,
          }}>Sintomas</span>
        </BarraDeTrabalho>
      }
    >
      <div style={{ background: 'var(--amber)', padding: '24px 24px 20px' }}>
        <div className="page-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>A minha saúde</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(21px,3vw,28px)', color: 'white', fontWeight: 'var(--peso-normal)' as any, margin: 0 }}>Diário de Sintomas</h1>
            <p style={{ fontSize: 'var(--t-dado)', color: 'rgba(255,255,255,0.9)', margin: '5px 0 0' }}>Como se sente hoje? Regista em segundos — fica guardado no perfil de <strong>{who}</strong>.</p>
          </div>
          <div style={{ background: 'white', borderRadius: 'var(--r-lg)', padding: 3 }}><ProfileSelector onChange={p => { setProfile(p); setLogs([]); setLoading(true) }} /></div>
        </div>
      </div>

      <div className="page-container page-body">
        {/* Registo rápido */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Como se sente?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            {FEELING.map(f => (
              <button key={f.v} onClick={() => setFeeling(feeling === f.v ? null : f.v)} title={f.label}
                style={{ flex: 1, padding: '10px 4px', borderRadius: 'var(--r-lg)', border: `2px solid ${feeling === f.v ? 'var(--amber)' : 'var(--border)'}`, background: feeling === f.v ? 'var(--badge-amber-bg)' : 'white', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <Icon name={f.emoji} size={22} />
                <span style={{ fontSize: 'var(--t-micro)', color: feeling === f.v ? 'var(--amber)' : 'var(--ink-5)', fontWeight: feeling === f.v ? 700 : 400 }}>{f.label}</span>
              </button>
            ))}
          </div>

          <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Sintomas</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {COMMON.map(s => {
              const on = symptoms.includes(s)
              return <button key={s} onClick={() => setSymptoms(p => on ? p.filter(x => x !== s) : [...p, s])}
                style={{ fontSize: 'var(--t-dado)', padding: '6px 12px', borderRadius: 'var(--r-xl)', border: `1.5px solid ${on ? 'var(--amber)' : 'var(--border)'}`, background: on ? 'var(--badge-amber-bg)' : 'white', color: on ? 'var(--amber)' : 'var(--ink-3)', fontWeight: on ? 700 : 400, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{on ? '✓ ' : ''}{s}</button>
            })}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>Dor (0-10): {pain ?? '—'}</label>
              <input type="range" min={0} max={10} value={pain ?? 0} onChange={e => setPain(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--amber)' }} />
            </div>
            <div>
              <label style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-corpo)' as any, color: 'var(--ink-4)', display: 'block', marginBottom: 6 }}>Temperatura (°C)</label>
              <input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)} placeholder="36.8" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '9px 12px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notas (opcional)…" style={{ width: '100%', border: '1.5px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '10px 12px', fontSize: 'var(--t-corpo)', fontFamily: 'var(--font-sans)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }} />
          <button onClick={save} disabled={!canSave || saving}
            style={{ width: '100%', padding: 13, background: canSave && !saving ? 'var(--amber)' : 'var(--bg-3)', color: canSave && !saving ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 'var(--r-lg)', fontSize: 'var(--t-corpo)', fontWeight: 'var(--peso-forte)' as any, cursor: canSave && !saving ? 'pointer' : 'default', fontFamily: 'var(--font-sans)' }}>
            {saving ? 'A guardar…' : `Registar para ${who}`}
          </button>
          {err && <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--badge-red-bg)', border: '1px solid var(--badge-red-border)', borderRadius: 'var(--r-md)', fontSize: 'var(--t-dado)', color: 'var(--red)' }}>{err}</div>}
        </div>

        {/* Mini-gráfico de bem-estar — últimos 14 registos (trazido do antigo /diary) */}
        {logs.filter(l => l.feeling).length >= 2 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 'var(--t-micro)', fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>
              Bem-estar — últimos {Math.min(logs.filter(l => l.feeling).length, 14)} registos
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 64 }}>
              {logs.filter(l => l.feeling).slice(0, 14).reverse().map(l => {
                const f = FEELING.find(x => x.v === l.feeling)
                return (
                  <div key={l.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${f?.label || ''} · ${new Date(l.at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}`}>
                    <div style={{ width: '100%', background: f?.color || 'var(--border)', borderRadius: '3px 3px 0 0', height: `${(l.feeling || 1) * 11}px`, minHeight: 4, transition: 'height 0.3s' }} />
                    <div style={{ fontSize: 'var(--t-micro)', color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{new Date(l.at).getDate()}</div>
                  </div>
                )
              })}
            </div>
            {(() => {
              // Tendência simples: média dos 3 mais recentes vs 3 anteriores (sem IA, sem diagnóstico).
              const withFeel = logs.filter(l => l.feeling).slice(0, 6)
              if (withFeel.length < 6) return null
              const recent = withFeel.slice(0, 3).reduce((a, l) => a + (l.feeling || 0), 0) / 3
              const before = withFeel.slice(3, 6).reduce((a, l) => a + (l.feeling || 0), 0) / 3
              const diff = recent - before
              const txt = diff >= 0.7 ? { t: 'Tens-te sentido melhor ultimamente 🙂', c: 'var(--green)' } : diff <= -0.7 ? { t: 'Tens-te sentido menos bem — se persistir, fala com o teu médico.', c: 'var(--amber)' } : null
              return txt ? <div style={{ marginTop: 12, fontSize: 'var(--t-meta)', color: txt.c, fontWeight: 'var(--peso-corpo)' as any }}>{txt.t}</div> : null
            })()}
          </div>
        )}

        {/* Histórico */}
        <div style={{ fontSize: 'var(--t-meta)', fontWeight: 'var(--peso-forte)' as any, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Histórico de {who}</div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-lg)' }} />)}</div>
        ) : logs.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 'var(--t-dado)' }}>Sem registos ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(l => {
              const f = FEELING.find(x => x.v === l.feeling)
              return (
                <div key={l.id} style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ fontSize: 'var(--t-destaque)', flexShrink: 0 }}>{f?.emoji || '📝'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-5)', marginBottom: 3 }}>{new Date(l.at).toLocaleString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    {l.symptoms?.length ? <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>{l.symptoms.map((s, i) => <span key={i} style={{ fontSize: 'var(--t-meta)', color: 'var(--amber)', background: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-border)', borderRadius: 'var(--r)', padding: '2px 8px' }}>{s}</span>)}</div> : null}
                    <div style={{ fontSize: 'var(--t-meta)', color: 'var(--ink-3)' }}>
                      {f ? f.label : ''}{l.pain != null && l.pain > 0 ? ` · dor ${l.pain}/10` : ''}{l.temperature ? ` · ${l.temperature}°C` : ''}
                    </div>
                    {l.notes && <div style={{ fontSize: 'var(--t-dado)', color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.5 }}>{l.notes}</div>}
                  </div>
                  <button aria-label="Eliminar" onClick={() => del(l.id)} style={{ background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 'var(--t-destaque)', flexShrink: 0 }}>×</button>                </div>
              )
            })}
          </div>
        )}
      </div>
    </Mesa>
  )
}
