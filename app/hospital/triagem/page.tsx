'use client'

// /hospital/triagem — Triagem de Manchester (urgência hospitalar)
// Sistema oficial Manchester: 5 prioridades com tempos-alvo até observação médica.
// Requer triage.read; criar/observar exige triage.write.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'

interface Triage {
  id: string
  priority: 1 | 2 | 3 | 4 | 5
  flowchart: string|null
  discriminator: string|null
  reason: string
  vitals: any
  pain_score: number|null
  notes: string|null
  target_minutes: number
  seen_at: string|null
  created_at: string
  patient_id: string|null
  episode_id: string|null
  patient: { id: string; name: string } | null
}

const PRIORITY: Record<number, { label: string; color: string; bg: string; target: number }> = {
  1: { label: 'EMERGENTE',     color: '#7f1d1d', bg: '#fecaca', target: 0 },
  2: { label: 'MUITO URGENTE', color: '#9a3412', bg: '#fed7aa', target: 10 },
  3: { label: 'URGENTE',       color: '#854d0e', bg: '#fef08a', target: 60 },
  4: { label: 'POUCO URGENTE', color: '#166534', bg: '#bbf7d0', target: 120 },
  5: { label: 'NÃO URGENTE',   color: '#1e40af', bg: '#bfdbfe', target: 240 },
}

// Fluxogramas mais comuns de Manchester (lista reduzida — referencial)
const FLOWCHARTS = [
  'Dor torácica', 'Dispneia', 'Cefaleia', 'Dor abdominal', 'Dor lombar',
  'Trauma craniano', 'Trauma membros', 'Convulsões', 'Estado mental alterado',
  'Hemorragia digestiva', 'Vómitos/diarreia', 'Febre no adulto', 'Criança com febre',
  'Problemas dermatológicos', 'Tonturas', 'Sintomas urinários', 'Ferida',
  'Queixa psiquiátrica', 'Indisposição em adulto', 'Outro',
]

// Discriminadores principais por nível (apoio rápido)
const DISCRIMINATORS_BY_PRIORITY: Record<number, string[]> = {
  1: ['Choque', 'Via aérea comprometida', 'Convulsão activa', 'Não responde', 'Hemorragia exsanguinante'],
  2: ['Dor severa', 'Hemorragia incontrolada', 'História de inconsciência', 'TA sistólica < 90', 'SpO2 < 92%', 'Glicemia < 60'],
  3: ['Dor moderada', 'Vómitos persistentes', 'Febre alta (≥ 39)', 'História recente de inconsciência', 'Sinais inflamatórios localizados'],
  4: ['Dor ligeira', 'Edema sem dor', 'Sintomas há > 7 dias', 'Sintomas crónicos'],
  5: ['Sem sinais alarme', 'Reavaliação', 'Pedido de informação'],
}

const ACCENT = '#0d6e42'

export default function TriagemHospitalPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [queue, setQueue] = useState<Triage[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [now, setNow] = useState(Date.now())

  const canWrite = caps.includes('triage.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/hospital/triage?org_id=${org.id}`, { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro a carregar fila')
      setQueue(j.queue || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  // Tempo real: refresca relógio a cada 15 s para tempos de espera
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  // Refresca a fila a cada 30 s
  useEffect(() => {
    if (!org) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [org, load])

  async function markSeen(id: string) {
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/hospital/triage/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ action: 'see' }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      load()
    } catch (e: any) { setErr(e.message) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (orgLoading || loading) {
    return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  }
  if (!org) {
    return <main style={{ padding: 24 }}><h1>Triagem Manchester</h1><p>Seleciona uma organização.</p></main>
  }
  if (!caps.includes('triage.read')) {
    return <main style={{ padding: 24 }}><h1>Triagem Manchester</h1><p>Sem permissão para ver a fila de triagem.</p></main>
  }

  const grouped: Record<number, Triage[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] }
  for (const t of queue) grouped[t.priority]?.push(t)

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1600, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Triagem Manchester</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name} · {queue.length} na fila</p>
        </div>
        {canWrite && (
          <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Nova triagem</button>
        )}
      </div>

      {/* Painel de prioridades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5].map(p => {
          const meta = PRIORITY[p]
          const c = grouped[p].length
          return (
            <div key={p} style={{ padding: 10, background: meta.bg, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: 0.5 }}>{meta.label}</div>
              <div style={{ fontSize: 26, color: meta.color, fontWeight: 800, marginTop: 2 }}>{c}</div>
              <div style={{ fontSize: 10, color: meta.color, opacity: 0.8 }}>≤ {meta.target === 0 ? 'IMEDIATO' : `${meta.target}min`}</div>
            </div>
          )
        })}
      </div>

      {/* Lista da fila */}
      {queue.length === 0 ? (
        <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Fila vazia.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {queue.map(t => {
            const meta = PRIORITY[t.priority]
            const waitMin = Math.floor((now - new Date(t.created_at).getTime()) / 60_000)
            const overdue = waitMin > t.target_minutes
            return (
              <div key={t.id} style={{
                background: 'white', borderRadius: 10, padding: 14, display: 'grid',
                gridTemplateColumns: '80px 1fr auto', gap: 14, alignItems: 'center',
                border: `1px solid ${overdue ? '#dc2626' : '#e5e7eb'}`,
                boxShadow: overdue ? '0 0 0 3px rgba(220,38,38,0.1)' : undefined,
              }}>
                {/* Prioridade */}
                <div style={{
                  background: meta.bg, color: meta.color, padding: '8px 6px', borderRadius: 8,
                  textAlign: 'center', fontWeight: 800,
                }}>
                  <div style={{ fontSize: 22 }}>{t.priority}</div>
                  <div style={{ fontSize: 9, marginTop: 2 }}>{meta.label.split(' ')[0]}</div>
                </div>
                {/* Conteúdo */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                    {t.patient?.name || 'Doente sem registo'}
                    {t.flowchart && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280', fontWeight: 500 }}>· {t.flowchart}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>{t.reason}</div>
                  {t.discriminator && <div style={{ fontSize: 12, color: meta.color, marginTop: 4, fontWeight: 600 }}>↳ {t.discriminator}</div>}
                  {t.pain_score != null && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Dor: {t.pain_score}/10</div>
                  )}
                </div>
                {/* Tempos / acções */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>espera</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: overdue ? '#dc2626' : '#111827' }}>
                    {waitMin}min
                  </div>
                  {overdue && <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>EXCEDIDO</div>}
                  {canWrite && (
                    <button onClick={() => markSeen(t.id)} style={{ ...btn('ghost'), marginTop: 6, fontSize: 12, padding: '4px 10px' }}>
                      Visto
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewTriageModal orgId={org.id} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} authHeader={authHeader} />
      )}
    </main>
  )
}

function NewTriageModal({ orgId, onClose, onCreated, authHeader }: {
  orgId: string; onClose: () => void; onCreated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [priority, setPriority] = useState<1|2|3|4|5>(3)
  const [flowchart, setFlowchart] = useState('Dor torácica')
  const [discriminator, setDiscriminator] = useState('')
  const [reason, setReason] = useState('')
  const [pain, setPain] = useState<number | ''>('')
  const [patientName, setPatientName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const body: any = {
        org_id: orgId, priority, flowchart,
        discriminator: discriminator || null,
        reason: reason || (flowchart + (discriminator ? ` · ${discriminator}` : '')),
        pain_score: pain === '' ? null : pain,
        notes: patientName ? `Doente: ${patientName}` : null,
      }
      const r = await fetch('/api/hospital/triage', { method: 'POST', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 600, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Nova triagem Manchester</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          {err && <div style={errBox}>{err}</div>}

          {/* Selector de prioridade */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Prioridade</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(p => {
                const meta = PRIORITY[p]
                const active = priority === p
                return (
                  <button key={p} type="button" onClick={() => setPriority(p as any)} style={{
                    padding: 10, border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: active ? meta.color : meta.bg, color: active ? 'white' : meta.color,
                    fontWeight: 800, textAlign: 'center',
                    outline: active ? `2px solid ${meta.color}` : 'none',
                  }}>
                    <div style={{ fontSize: 20 }}>{p}</div>
                    <div style={{ fontSize: 9, marginTop: 2, opacity: active ? 1 : 0.85 }}>{meta.label}</div>
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
              Tempo alvo até observação: {PRIORITY[priority].target === 0 ? 'IMEDIATO' : `${PRIORITY[priority].target} min`}
            </p>
          </div>

          <Field label="Doente (nome opcional)"><input value={patientName} onChange={e => setPatientName(e.target.value)} style={input} placeholder="Ex: Maria Silva" /></Field>

          <Field label="Fluxograma">
            <select value={flowchart} onChange={e => setFlowchart(e.target.value)} style={input}>
              {FLOWCHARTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </Field>

          <Field label="Discriminador (para esta prioridade)">
            <select value={discriminator} onChange={e => setDiscriminator(e.target.value)} style={input}>
              <option value="">— Selecionar —</option>
              {DISCRIMINATORS_BY_PRIORITY[priority]?.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>

          <Field label="Motivo / queixa principal">
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }}
              placeholder="Descrição livre do motivo de vinda à urgência" />
          </Field>

          <Field label="Dor (0-10)">
            <input type="number" min={0} max={10} value={pain} onChange={e => setPain(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} />
          </Field>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
            <button type="submit" disabled={busy} style={btn('primary')}>{busy ? 'A registar…' : 'Registar triagem'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  )
}

const input: React.CSSProperties = {
  width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box',
}
const errBox: React.CSSProperties = {
  background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8,
}
const emptyCard: React.CSSProperties = {
  background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center',
}

function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') {
    return {
      padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
      background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14,
    }
  }
  return {
    padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
    background: 'white', color: '#374151', fontWeight: 600, fontSize: 14,
  }
}
