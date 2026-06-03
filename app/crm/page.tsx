'use client'

// /crm — Pipeline e contactos não-clínicos da organização
// Lista por estado (new → qualified → contacted → proposal → won/lost)
// Search por nome/empresa/email. Drawer de detalhe com actividades.

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'

interface Contact {
  id: string; kind: string; name: string; email: string|null; phone: string|null
  company: string|null; stage: string; value_eur: number|null
  expected_close: string|null; tags: string[]|null
  owner_user_id: string|null; last_contact_at: string|null; next_followup_at: string|null
  created_at: string; source: string|null
}
interface PipelineRow { stage: string; deals: number; total_value: number; avg_value: number }
interface Activity {
  id: string; kind: string; subject: string|null; body: string|null
  due_at: string|null; done: boolean; done_at: string|null; created_at: string
}

const STAGE_META: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Novo',        color: '#374151', bg: '#f3f4f6' },
  qualified: { label: 'Qualificado', color: '#1e40af', bg: '#dbeafe' },
  contacted: { label: 'Contactado',  color: '#7c3aed', bg: '#ede9fe' },
  proposal:  { label: 'Proposta',    color: '#b45309', bg: '#fef3c7' },
  won:       { label: 'Ganho',       color: '#065f46', bg: '#d1fae5' },
  lost:      { label: 'Perdido',     color: '#991b1b', bg: '#fee2e2' },
  dormant:   { label: 'Dormente',    color: '#6b7280', bg: '#f3f4f6' },
}
const KIND_LABELS: Record<string, string> = {
  lead: 'Lead', prospect: 'Prospecto', customer: 'Cliente', partner: 'Parceiro',
  supplier_contact: 'Contacto Fornec.', other: 'Outro',
}
const ACCENT = '#0d6e42'

export default function CRMPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [contacts, setContacts] = useState<Contact[]>([])
  const [pipeline, setPipeline] = useState<Record<string, PipelineRow>>({})
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Contact | null>(null)

  const canWrite = caps.includes('crm.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const url = new URL('/api/crm/contacts', window.location.origin)
      url.searchParams.set('org_id', org.id)
      if (stageFilter) url.searchParams.set('stage', stageFilter)
      if (search) url.searchParams.set('q', search)
      const r = await fetch(url.toString(), { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setContacts(j.contacts || [])
      const m: Record<string, PipelineRow> = {}
      for (const p of (j.pipeline || [])) m[p.stage] = p
      setPipeline(m)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, search, stageFilter, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>CRM</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('crm.read')) return <main style={{ padding: 24 }}><h1>CRM</h1><p>Sem permissão.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>CRM</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name} · {contacts.length} contactos</p>
        </div>
        {canWrite && <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Novo contacto</button>}
      </div>

      {/* Pipeline */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 16 }}>
        {['new','qualified','contacted','proposal','won','lost','dormant'].map(s => {
          const meta = STAGE_META[s]
          const p = pipeline[s]
          return (
            <button key={s} onClick={() => setStageFilter(stageFilter === s ? '' : s)} style={{
              padding: 10, background: meta.bg, color: meta.color, border: stageFilter === s ? `2px solid ${meta.color}` : 'none',
              borderRadius: 8, textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>{meta.label.toUpperCase()}</div>
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{p?.deals || 0}</div>
              {p && p.total_value > 0 && (
                <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>€{Number(p.total_value).toFixed(0)}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Procurar por nome, email ou empresa…"
        style={{ ...input, marginBottom: 12 }} />

      {contacts.length === 0 ? (
        <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem contactos. Adiciona o primeiro.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 6 }}>
          {contacts.map(c => {
            const meta = STAGE_META[c.stage] || STAGE_META.new
            return (
              <div key={c.id} onClick={() => setSelected(c)} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12,
                cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 120px 110px', gap: 14, alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>
                    {c.name}
                    {c.company && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280', fontWeight: 500 }}>· {c.company}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {c.email && <span>✉ {c.email}</span>}
                    {c.phone && <span>☎ {c.phone}</span>}
                    <span>{KIND_LABELS[c.kind] || c.kind}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Valor</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                    {c.value_eur ? `€${Number(c.value_eur).toFixed(0)}` : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 11, fontWeight: 700 }}>
                    {meta.label.toUpperCase()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && org && (
        <NewContactModal orgId={org.id} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} authHeader={authHeader} />
      )}
      {selected && org && (
        <ContactDrawer contactId={selected.id} canWrite={canWrite}
          onClose={() => setSelected(null)} onUpdated={() => { setSelected(null); load() }} authHeader={authHeader} />
      )}
    </main>
  )
}

function NewContactModal({ orgId, onClose, onSaved, authHeader }: {
  orgId: string; onClose: () => void; onSaved: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const [form, setForm] = useState({
    kind: 'lead', name: '', email: '', phone: '', company: '',
    stage: 'new', value_eur: '', source: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/crm/contacts', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, ...form,
        value_eur: form.value_eur ? parseFloat(form.value_eur) : null,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <Modal onClose={onClose} title="Novo contacto">
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Nome"><input required value={form.name} onChange={e => set('name', e.target.value)} style={input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Tipo">
            <select value={form.kind} onChange={e => set('kind', e.target.value)} style={input}>
              {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
          <Field label="Estado">
            <select value={form.stage} onChange={e => set('stage', e.target.value)} style={input}>
              {Object.entries(STAGE_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Empresa"><input value={form.company} onChange={e => set('company', e.target.value)} style={input} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={input} /></Field>
          <Field label="Telefone"><input value={form.phone} onChange={e => set('phone', e.target.value)} style={input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Valor estimado (€)"><input type="number" step="0.01" value={form.value_eur} onChange={e => set('value_eur', e.target.value)} style={input} /></Field>
          <Field label="Fonte"><input value={form.source} onChange={e => set('source', e.target.value)} style={input} placeholder="ex: feira, referência" /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !form.name} style={btn('primary')}>{busy ? 'A criar…' : 'Criar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function ContactDrawer({ contactId, canWrite, onClose, onUpdated, authHeader }: {
  contactId: string; canWrite: boolean; onClose: () => void; onUpdated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [contact, setContact] = useState<any>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [newAct, setNewAct] = useState({ kind: 'note', subject: '', body: '' })

  const load = useCallback(async () => {
    const headers = await authHeader()
    const r = await fetch(`/api/crm/contacts/${contactId}`, { headers })
    const j = await r.json()
    if (r.ok) { setContact(j.contact); setActivities(j.activities || []) }
  }, [contactId, authHeader])

  useEffect(() => { load() }, [load])

  async function changeStage(stage: string) {
    setBusy(true)
    const headers = await authHeader()
    await fetch(`/api/crm/contacts/${contactId}`, { method: 'PATCH', headers, body: JSON.stringify({ stage }) })
    await load()
    setBusy(false)
  }

  async function addActivity(e: React.FormEvent) {
    e.preventDefault()
    if (!newAct.subject && !newAct.body) return
    setBusy(true)
    const headers = await authHeader()
    await fetch('/api/crm/activities', { method: 'POST', headers, body: JSON.stringify({
      org_id: contact.org_id, contact_id: contactId, ...newAct, done: true,
    }) })
    setNewAct({ kind: 'note', subject: '', body: '' })
    await load()
    setBusy(false)
  }

  if (!contact) return null
  const meta = STAGE_META[contact.stage] || STAGE_META.new

  return (
    <Modal onClose={onClose} title={contact.name} wide>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: meta.bg, color: meta.color, fontSize: 12, fontWeight: 700 }}>
          {meta.label.toUpperCase()}
        </span>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>
          {KIND_LABELS[contact.kind] || contact.kind}
        </span>
        {contact.company && <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>{contact.company}</span>}
      </div>

      <div style={{ background: '#f9fafb', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
        {contact.email && <div>✉ {contact.email}</div>}
        {contact.phone && <div>☎ {contact.phone}</div>}
        {contact.value_eur && <div>💰 €{Number(contact.value_eur).toFixed(2)}</div>}
        {contact.source && <div>📍 fonte: {contact.source}</div>}
        {contact.notes && <div style={{ marginTop: 6 }}><b>Notas:</b> {contact.notes}</div>}
      </div>

      {canWrite && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Mudar estado</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(STAGE_META).map(([k, m]) => (
              <button key={k} disabled={busy || contact.stage === k} onClick={() => changeStage(k)} style={{
                padding: '5px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                background: contact.stage === k ? m.color : m.bg, color: contact.stage === k ? 'white' : m.color,
                opacity: busy && contact.stage !== k ? 0.5 : 1,
              }}>{m.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Histórico ({activities.length})</div>
        {activities.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>Sem interacções.</p>
        ) : (
          <div style={{ display: 'grid', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {activities.map(a => (
              <div key={a.id} style={{ background: '#f9fafb', padding: 8, borderRadius: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{a.kind.toUpperCase()}{a.subject ? ` — ${a.subject}` : ''}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(a.created_at).toLocaleString('pt-PT')}</span>
                </div>
                {a.body && <div style={{ marginTop: 4, color: '#374151' }}>{a.body}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {canWrite && (
        <form onSubmit={addActivity} style={{ display: 'grid', gap: 8, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
            <select value={newAct.kind} onChange={e => setNewAct(a => ({ ...a, kind: e.target.value }))} style={input}>
              <option value="note">Nota</option>
              <option value="call">Chamada</option>
              <option value="email">Email</option>
              <option value="meeting">Reunião</option>
              <option value="visit">Visita</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="task">Tarefa</option>
            </select>
            <input value={newAct.subject} onChange={e => setNewAct(a => ({ ...a, subject: e.target.value }))} placeholder="Assunto" style={input} />
          </div>
          <textarea rows={2} value={newAct.body} onChange={e => setNewAct(a => ({ ...a, body: e.target.value }))} placeholder="Detalhes" style={{ ...input, resize: 'vertical' }} />
          <button type="submit" disabled={busy} style={btn('primary')}>{busy ? 'A guardar…' : 'Adicionar'}</button>
        </form>
      )}
    </Modal>
  )
}

function Modal({ children, onClose, title, wide }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: wide ? 700 : 500, width: '100%',
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
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const errBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8 }
const emptyCard: React.CSSProperties = { background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
