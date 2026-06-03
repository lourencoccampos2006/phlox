'use client'

// /hospital/triagem — Triagem de Manchester (urgência hospitalar)
// Sistema oficial Manchester: 5 prioridades com tempos-alvo até observação médica.
// Requer triage.read; criar/observar exige triage.write.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import OrgPatientPicker, { type OrgPatient } from '@/components/OrgPatientPicker'

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

  async function admitFromTriage(triageId: string) {
    if (!confirm('Admitir este doente — criar episódio de urgência?')) return
    try {
      const headers = await authHeader()
      const r = await fetch('/api/hospital/triage/admit', { method: 'POST', headers, body: JSON.stringify({ triage_id: triageId }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      load()
      alert('Doente admitido. Vai a /hospital/camas para atribuir cama.')
    } catch (e: any) { setErr(e.message) }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  // Só bloqueia a UI completa no primeiro carregamento. Refreshes não fazem
  // unmount da página (e do modal aberto).
  const firstLoad = loading && queue.length === 0 && !err
  if (orgLoading || firstLoad) {
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

      {/* Painel de prioridades — auto-fit para mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: 6, marginBottom: 20 }}>
        {[1, 2, 3, 4, 5].map(p => {
          const meta = PRIORITY[p]
          const c = grouped[p].length
          return (
            <div key={p} style={{ padding: 10, background: meta.bg, borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: meta.color, fontWeight: 700, letterSpacing: 0.5 }}>{meta.label}</div>
              <div style={{ fontSize: 22, color: meta.color, fontWeight: 800, marginTop: 2 }}>{c}</div>
              <div style={{ fontSize: 9, color: meta.color, opacity: 0.8 }}>≤ {meta.target === 0 ? 'JÁ' : `${meta.target}m`}</div>
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
                background: 'white', borderRadius: 10, padding: 12, display: 'grid',
                gridTemplateColumns: '60px 1fr auto', gap: 10, alignItems: 'center',
                border: `1px solid ${overdue ? '#dc2626' : '#e5e7eb'}`,
                boxShadow: overdue ? '0 0 0 3px rgba(220,38,38,0.1)' : undefined,
              }}>
                {/* Prioridade */}
                <div style={{
                  background: meta.bg, color: meta.color, padding: '6px 4px', borderRadius: 8,
                  textAlign: 'center', fontWeight: 800,
                }}>
                  <div style={{ fontSize: 20 }}>{t.priority}</div>
                  <div style={{ fontSize: 8, marginTop: 1, lineHeight: 1.1 }}>{meta.label.split(' ')[0]}</div>
                </div>
                {/* Conteúdo */}
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.patient?.name || 'Sem registo'}
                  </div>
                  {t.flowchart && <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{t.flowchart}</div>}
                  <div style={{ fontSize: 12, color: '#374151', marginTop: 3, wordBreak: 'break-word' }}>{t.reason}</div>
                  {t.discriminator && <div style={{ fontSize: 11, color: meta.color, marginTop: 3, fontWeight: 600 }}>↳ {t.discriminator}</div>}
                  {t.pain_score != null && (
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3 }}>Dor: {t.pain_score}/10</div>
                  )}
                </div>
                {/* Tempos / acções */}
                <div style={{ textAlign: 'right', minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>espera</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: overdue ? '#dc2626' : '#111827' }}>
                    {waitMin}m
                  </div>
                  {overdue && <div style={{ fontSize: 9, color: '#dc2626', fontWeight: 700 }}>EXCEDIDO</div>}
                  {canWrite && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button onClick={() => markSeen(t.id)} style={{ ...btn('ghost'), fontSize: 10, padding: '3px 7px' }}>
                        Visto
                      </button>
                      {t.patient_id && (
                        <button onClick={() => admitFromTriage(t.id)} style={{ ...btn('primary'), fontSize: 10, padding: '3px 7px' }}>
                          Admitir →
                        </button>
                      )}
                    </div>
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

// ─── Sugestão de prioridade por palavras-chave ──────────────────────────
// A esmagadora maioria das triagens é prioridade 3. Subimos a 2 ou 1 quando
// detectamos palavras-chave de alarme. Descemos a 4/5 quando há indicadores
// de pouca urgência.
const RX_PRIO_1 = /(parag(em|ou)|pcr|inconsciente|n[aã]o responde|n[aã]o respira|convul[sç][aã]o activa|hemorragia exsanguinante|via a[eé]rea|anafilaxia|choque|dor torac.{0,15}irradi|estridor)/i
const RX_PRIO_2 = /(dispneia|dificuldade.{0,15}respir|dor torac|dor abdominal severa|hemorragia|trauma craniano|tens[aã]o.{0,10}(baixa|alta)|spo2 <|inconscien|sincop|febre.{0,10}3[89]|39|40|41|sangue|tonturas e nausea)/i
const RX_PRIO_4 = /(constipa[cç][aã]o|h[aá] (semana|dias)|dor ligeira|edema sem dor|tosse h[aá]|cronic[oa])/i
const RX_PRIO_5 = /(reavalia|pedir.{0,10}informa|consulta de rotina|receita|atestado)/i

function suggestPriority(text: string): 1|2|3|4|5 {
  if (!text) return 3
  if (RX_PRIO_1.test(text)) return 1
  if (RX_PRIO_2.test(text)) return 2
  if (RX_PRIO_5.test(text)) return 5
  if (RX_PRIO_4.test(text)) return 4
  return 3
}

function NewTriageModal({ orgId, onClose, onCreated, authHeader }: {
  orgId: string; onClose: () => void; onCreated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [priority, setPriority] = useState<1|2|3|4|5>(3)
  const [priorityManual, setPriorityManual] = useState(false)
  const [flowchart, setFlowchart] = useState('')
  const [reason, setReason] = useState('')
  const [pain, setPain] = useState<number | ''>('')
  const [patient, setPatient] = useState<OrgPatient | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Sugestão automática conforme o utilizador escreve o motivo
  const suggested = useMemo(() => suggestPriority(reason), [reason])
  useEffect(() => {
    if (!priorityManual && suggested !== priority) {
      setPriority(suggested)
    }
  }, [suggested, priorityManual]) // eslint-disable-line

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setErr('Motivo é obrigatório.'); return }
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const body: any = {
        org_id: orgId, priority,
        flowchart: flowchart || null,
        reason: reason.trim(),
        pain_score: pain === '' ? null : pain,
        patient_id: patient?.id || null,
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
        background: 'white', borderRadius: 14, padding: 18, maxWidth: 540, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nova triagem</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
          {err && <div style={errBox}>{err}</div>}

          {/* Motivo é a peça central — sempre o primeiro a preencher */}
          <Field label="Motivo / queixa principal *">
            <textarea
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              style={{ ...input, resize: 'vertical' }}
              placeholder="Ex: Dor abdominal há 2h, sem febre. OU: Dor torácica com sudorese a irradiar para braço esquerdo."
            />
            <p style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0' }}>
              A prioridade ajusta-se automaticamente conforme escreves.
            </p>
          </Field>

          {/* Prioridade — proeminente mas auto */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Prioridade</span>
              {priorityManual && (
                <button type="button" onClick={() => { setPriorityManual(false); setPriority(suggested) }}
                  style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                  ↻ Voltar a automático
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
              {[1, 2, 3, 4, 5].map(p => {
                const meta = PRIORITY[p]
                const active = priority === p
                const isSuggested = !priorityManual && suggested === p
                return (
                  <button key={p} type="button"
                    onClick={() => { setPriority(p as any); setPriorityManual(true) }}
                    style={{
                      padding: '8px 4px', border: 'none', borderRadius: 8, cursor: 'pointer',
                      background: active ? meta.color : meta.bg, color: active ? 'white' : meta.color,
                      fontWeight: 800, textAlign: 'center',
                      outline: isSuggested && !active ? `2px dashed ${meta.color}` : 'none',
                    }}>
                    <div style={{ fontSize: 18 }}>{p}</div>
                    <div style={{ fontSize: 8, marginTop: 1, lineHeight: 1.1 }}>{meta.label.split(' ')[0]}</div>
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '6px 0 0' }}>
              Alvo: {PRIORITY[priority].target === 0 ? 'IMEDIATO' : `≤ ${PRIORITY[priority].target} min`}
              {!priorityManual && ' · auto'}
            </p>
          </div>

          {/* Doente — picker com criação inline */}
          <OrgPatientPicker
            orgId={orgId}
            value={patient}
            onSelect={setPatient}
            label="Doente (opcional — útil para triagem rápida)"
            placeholder="Procurar ou criar como visita única…"
          />

          {/* Avançado: fluxograma + dor */}
          {!showAdvanced ? (
            <button type="button" onClick={() => setShowAdvanced(true)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: 0, textAlign: 'left' }}>
              + Adicionar fluxograma / escala de dor
            </button>
          ) : (
            <>
              <Field label="Fluxograma (opcional)">
                <select value={flowchart} onChange={e => setFlowchart(e.target.value)} style={input}>
                  <option value="">— Não aplicável —</option>
                  {FLOWCHARTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Dor (0-10)">
                <input type="number" min={0} max={10} value={pain} onChange={e => setPain(e.target.value === '' ? '' : parseInt(e.target.value))} style={input} />
              </Field>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
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
