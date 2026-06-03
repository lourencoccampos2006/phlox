'use client'

// /hospital/camas — Mapa de camas
// Vista por ala com ocupação em tempo real. Admite, transfere e dá alta.
// Requer capability beds.read; mutações exigem beds.write.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import OrgPatientPicker, { type OrgPatient } from '@/components/OrgPatientPicker'
import Link from 'next/link'

interface Ward {
  id: string; name: string; code: string|null; kind: string
  floor: string|null; capacity: number; active: boolean
}
interface WardOccupancy {
  ward_id: string; total_beds: number; occupied: number; free: number
  cleaning: number; out_of_service: number; occupancy_pct: number|null
}
interface Bed {
  id: string; label: string; bed_type: string; status: string
  occupied_since: string|null; notes: string|null
  ward_id: string; current_episode_id: string|null
  current_patient_id: string|null
  patient: { id: string; name: string } | null
}

const STATUS_COLORS: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  free:        { bg: '#ecfdf5', fg: '#065f46', border: '#a7f3d0', label: 'Livre' },
  occupied:    { bg: '#fef2f2', fg: '#991b1b', border: '#fecaca', label: 'Ocupada' },
  cleaning:    { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', label: 'Limpeza' },
  maintenance: { bg: '#f3f4f6', fg: '#374151', border: '#d1d5db', label: 'Manutenção' },
  reserved:    { bg: '#eff6ff', fg: '#1e40af', border: '#bfdbfe', label: 'Reservada' },
  blocked:     { bg: '#f3f4f6', fg: '#374151', border: '#d1d5db', label: 'Bloqueada' },
}

const KIND_LABELS: Record<string, string> = {
  internamento: 'Internamento', urgencia: 'Urgência', uci: 'UCI', uciped: 'UCI Pediátrica',
  pediatria: 'Pediatria', obstetricia: 'Obstetrícia', psiquiatria: 'Psiquiatria',
  oncologia: 'Oncologia', ambulatorio: 'Ambulatório', outro: 'Outro',
}

const ACCENT = '#0d6e42'

export default function HospitalCamasPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [wards, setWards] = useState<Ward[]>([])
  const [occ, setOcc] = useState<Record<string, WardOccupancy>>({})
  const [beds, setBeds] = useState<Bed[]>([])
  const [selectedWard, setSelectedWard] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [showNewWard, setShowNewWard] = useState(false)
  const [showNewBed, setShowNewBed] = useState(false)
  const [bedDetail, setBedDetail] = useState<Bed | null>(null)

  const canWrite = caps.includes('beds.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const loadWards = useCallback(async () => {
    if (!org) return
    const headers = await authHeader()
    const res = await fetch(`/api/hospital/wards?org_id=${org.id}`, { headers })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Erro a carregar alas'); return }
    setWards(j.wards || [])
    const map: Record<string, WardOccupancy> = {}
    for (const o of (j.occupancy || [])) map[o.ward_id] = o
    setOcc(map)
    if (!selectedWard && (j.wards || []).length > 0) setSelectedWard(j.wards[0].id)
  }, [org, authHeader, selectedWard])

  const loadBeds = useCallback(async () => {
    if (!selectedWard) { setBeds([]); return }
    const headers = await authHeader()
    const res = await fetch(`/api/hospital/beds?ward_id=${selectedWard}`, { headers })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Erro a carregar camas'); return }
    setBeds(j.beds || [])
  }, [selectedWard, authHeader])

  useEffect(() => {
    if (!user || orgLoading) return
    setLoading(true)
    loadWards().finally(() => setLoading(false))
  }, [user, org, orgLoading, loadWards])

  useEffect(() => { loadBeds() }, [loadBeds])

  // ─── Render ───────────────────────────────────────────────────────────────
  if (orgLoading || loading) {
    return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  }

  if (!org) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Mapa de Camas</h1>
        <p style={{ color: '#6b7280' }}>Seleciona uma organização para ver o mapa de camas.</p>
      </main>
    )
  }

  if (!caps.includes('beds.read')) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Mapa de Camas</h1>
        <p style={{ color: '#6b7280' }}>Não tens permissão para ver camas nesta organização.</p>
      </main>
    )
  }

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1600, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Mapa de Camas</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name}</p>
        </div>
        {canWrite && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowNewWard(true)} style={btn('ghost')}>+ Nova ala</button>
            {selectedWard && <button onClick={() => setShowNewBed(true)} style={btn('primary')}>+ Nova cama</button>}
          </div>
        )}
      </div>

      {/* Resumo por ala */}
      {wards.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ margin: 0, color: '#6b7280' }}>Ainda não existem alas configuradas.</p>
          {canWrite && <button onClick={() => setShowNewWard(true)} style={{ ...btn('primary'), marginTop: 12 }}>Criar primeira ala</button>}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginBottom: 24 }}>
            {wards.map(w => {
              const o = occ[w.id]
              const pct = o?.occupancy_pct ?? 0
              const active = w.id === selectedWard
              return (
                <button key={w.id} onClick={() => setSelectedWard(w.id)} style={{
                  textAlign: 'left', cursor: 'pointer', padding: 14,
                  background: active ? ACCENT + '14' : 'white',
                  border: `1px solid ${active ? ACCENT : '#e5e7eb'}`,
                  borderRadius: 12,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {KIND_LABELS[w.kind] || w.kind}{w.floor ? ` · ${w.floor}` : ''}
                      </div>
                    </div>
                    <div style={{
                      padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: pct >= 90 ? '#fee2e2' : pct >= 70 ? '#fef3c7' : '#dcfce7',
                      color: pct >= 90 ? '#991b1b' : pct >= 70 ? '#92400e' : '#065f46',
                    }}>{Math.round(pct)}%</div>
                  </div>
                  {o && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, fontSize: 11, color: '#374151' }}>
                      <span><b style={{ color: '#991b1b' }}>{o.occupied}</b> ocup.</span>
                      <span><b style={{ color: '#065f46' }}>{o.free}</b> livre</span>
                      {o.cleaning > 0 && <span><b style={{ color: '#92400e' }}>{o.cleaning}</b> limp.</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Grelha de camas */}
          {selectedWard && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700 }}>
                Camas — {wards.find(w => w.id === selectedWard)?.name}
              </h2>
              {beds.length === 0 ? (
                <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem camas nesta ala.</p></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {beds.map(b => {
                    const c = STATUS_COLORS[b.status] || STATUS_COLORS.free
                    const since = b.occupied_since ? minutesSince(b.occupied_since) : null
                    return (
                      <button key={b.id} onClick={() => setBedDetail(b)} style={{
                        textAlign: 'left', cursor: 'pointer', padding: 12,
                        background: c.bg, color: c.fg, border: `1.5px solid ${c.border}`,
                        borderRadius: 10,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{b.label}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{c.label.toUpperCase()}</div>
                        </div>
                        {b.patient ? (
                          <>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{b.patient.name}</div>
                            {since != null && <div style={{ fontSize: 11, opacity: 0.75 }}>há {fmtMinutes(since)}</div>}
                          </>
                        ) : (
                          <div style={{ fontSize: 12, opacity: 0.7, fontStyle: 'italic' }}>{b.bed_type === 'isolation' ? 'isolamento' : b.bed_type}</div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Modals */}
      {showNewWard && (
        <NewWardModal orgId={org.id} onClose={() => setShowNewWard(false)} onCreated={() => { setShowNewWard(false); loadWards() }} authHeader={authHeader} />
      )}
      {showNewBed && selectedWard && (
        <NewBedModal orgId={org.id} wardId={selectedWard} onClose={() => setShowNewBed(false)} onCreated={() => { setShowNewBed(false); loadBeds(); loadWards() }} authHeader={authHeader} />
      )}
      {bedDetail && (
        <BedDetailModal bed={bedDetail} canWrite={canWrite}
          orgId={org.id}
          onClose={() => setBedDetail(null)}
          onUpdated={() => { setBedDetail(null); loadBeds(); loadWards() }}
          authHeader={authHeader}
        />
      )}
    </main>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Modals
// ────────────────────────────────────────────────────────────────────────────

function NewWardModal({ orgId, onClose, onCreated, authHeader }: { orgId: string; onClose: () => void; onCreated: () => void; authHeader: () => Promise<Record<string, string>> }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [kind, setKind] = useState('internamento')
  const [floor, setFloor] = useState('')
  const [capacity, setCapacity] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/hospital/wards', { method: 'POST', headers, body: JSON.stringify({ org_id: orgId, name, code, kind, floor, capacity }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} title="Nova ala / serviço">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Nome"><input required value={name} onChange={e => setName(e.target.value)} style={input} /></Field>
        <Field label="Código (opcional)"><input value={code} onChange={e => setCode(e.target.value)} style={input} placeholder="ex: MED2, CIR1, UCI" /></Field>
        <Field label="Tipo">
          <select value={kind} onChange={e => setKind(e.target.value)} style={input}>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Piso (opcional)"><input value={floor} onChange={e => setFloor(e.target.value)} style={input} /></Field>
          <Field label="Capacidade alvo"><input type="number" value={capacity} onChange={e => setCapacity(parseInt(e.target.value) || 0)} style={input} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !name} style={btn('primary')}>{busy ? 'A criar…' : 'Criar ala'}</button>
        </div>
      </form>
    </Modal>
  )
}

function NewBedModal({ orgId, wardId, onClose, onCreated, authHeader }: { orgId: string; wardId: string; onClose: () => void; onCreated: () => void; authHeader: () => Promise<Record<string, string>> }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState('standard')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/hospital/beds', { method: 'POST', headers, body: JSON.stringify({ org_id: orgId, ward_id: wardId, label, bed_type: type }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal onClose={onClose} title="Nova cama">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Identificador"><input required value={label} onChange={e => setLabel(e.target.value)} style={input} placeholder="ex: 203-A, Box 4" /></Field>
        <Field label="Tipo">
          <select value={type} onChange={e => setType(e.target.value)} style={input}>
            <option value="standard">Padrão</option>
            <option value="isolation">Isolamento</option>
            <option value="intensive">Intensiva</option>
            <option value="pediatric">Pediátrica</option>
            <option value="maternity">Maternidade</option>
            <option value="psychiatric">Psiquiátrica</option>
            <option value="observation">Observação</option>
            <option value="other">Outra</option>
          </select>
        </Field>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !label} style={btn('primary')}>{busy ? 'A criar…' : 'Criar cama'}</button>
        </div>
      </form>
    </Modal>
  )
}

function BedDetailModal({ bed, canWrite, onClose, onUpdated, authHeader, orgId }: {
  bed: Bed; canWrite: boolean; onClose: () => void; onUpdated: () => void
  authHeader: () => Promise<Record<string, string>>; orgId: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<'view' | 'admit'>('view')
  const [patient, setPatient] = useState<OrgPatient | null>(null)
  const [episodeKind, setEpisodeKind] = useState('internamento')
  const [complaint, setComplaint] = useState('')

  async function action(body: any) {
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/hospital/beds/${bed.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onUpdated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const c = STATUS_COLORS[bed.status] || STATUS_COLORS.free

  return (
    <Modal onClose={onClose} title={`Cama ${bed.label}`}>
      {err && <div style={errBox}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 12, fontWeight: 700, border: `1px solid ${c.border}` }}>
          {c.label.toUpperCase()}
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>
          {bed.bed_type}
        </span>
      </div>

      {bed.patient && (
        <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>Doente</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{bed.patient.name}</div>
          {bed.occupied_since && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              ocupada desde {new Date(bed.occupied_since).toLocaleString('pt-PT')}
            </div>
          )}
          <Link href={`/patients/${bed.patient.id}`} style={{ display: 'inline-block', marginTop: 8, fontSize: 13, color: ACCENT, textDecoration: 'none' }}>
            Abrir ficha do doente →
          </Link>
        </div>
      )}

      {canWrite && (
        <>
          {bed.status === 'free' || bed.status === 'reserved' ? (
            <>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 12 }}>
                <button onClick={() => setTab(tab === 'admit' ? 'view' : 'admit')} style={btn('primary')}>
                  {tab === 'admit' ? 'Cancelar' : 'Admitir doente'}
                </button>
              </div>
              {tab === 'admit' && (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <OrgPatientPicker
                    orgId={orgId}
                    value={patient}
                    onSelect={setPatient}
                    label="Doente"
                    placeholder="Procurar por nome ou criar novo…"
                  />
                  <Field label="Tipo de admissão">
                    <select value={episodeKind} onChange={e => setEpisodeKind(e.target.value)} style={input}>
                      <option value="internamento">Internamento</option>
                      <option value="urgencia">Urgência</option>
                      <option value="uci">UCI</option>
                      <option value="domiciliario">Domiciliário</option>
                      <option value="outro">Outro</option>
                    </select>
                  </Field>
                  <Field label="Queixa principal (opcional)">
                    <input value={complaint} onChange={e => setComplaint(e.target.value)} style={input} placeholder="ex: descompensação cardíaca" />
                  </Field>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                    Um novo episódio aberto será criado automaticamente para este doente.
                  </p>
                  <button disabled={busy || !patient} onClick={() => action({
                    action: 'admit',
                    patient_id: patient?.id,
                    episode_kind: episodeKind,
                    primary_complaint: complaint || null,
                  })} style={btn('primary')}>
                    {busy ? 'A admitir…' : `Admitir ${patient?.name || ''}`}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
              {bed.status === 'occupied' && (
                <button onClick={() => action({ action: 'discharge' })} disabled={busy} style={btn('primary')}>
                  Dar alta (vai p/ limpeza)
                </button>
              )}
              <button onClick={() => action({ action: 'set_status', status: 'free' })} disabled={busy} style={btn('ghost')}>Marcar livre</button>
              <button onClick={() => action({ action: 'set_status', status: 'cleaning' })} disabled={busy} style={btn('ghost')}>Limpeza</button>
              <button onClick={() => action({ action: 'set_status', status: 'maintenance' })} disabled={busy} style={btn('ghost')}>Manutenção</button>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Pequenos helpers visuais
// ────────────────────────────────────────────────────────────────────────────

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 500, width: '100%',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#9ca3af', padding: 0, lineHeight: 1 }}>×</button>
        </div>
        {children}
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

function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
}
function fmtMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${m % 60 ? ` ${m % 60}m` : ''}`
  const d = Math.floor(h / 24)
  return `${d}d ${h % 24}h`
}
