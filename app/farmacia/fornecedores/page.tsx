'use client'

// /farmacia/fornecedores — Gestão de fornecedores (laboratórios, armazenistas)
// KPIs por fornecedor: nº encomendas, valor, lead time real.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import Link from 'next/link'

interface Supplier {
  id: string; name: string; short_name: string|null; kind: string
  vat_number: string|null; infarmed_code: string|null; edi_code: string|null
  contact_name: string|null; email: string|null; phone: string|null
  payment_terms: string|null; discount_pct: number; lead_time_days: number
  min_order_value: number|null; cutoff_time: string|null; city: string|null
}
interface Kpi {
  supplier_id: string; orders_count: number; total_value: number
  avg_lead_days: number|null; orders_received: number; orders_open: number
}

const KIND_LABELS: Record<string, string> = {
  wholesaler: 'Armazenista', laboratory: 'Laboratório', distributor: 'Distribuidor',
  direct: 'Directo', other: 'Outro',
}

const ACCENT = '#0d6e42'

export default function FornecedoresPage() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()

  const [list, setList] = useState<Supplier[]>([])
  const [kpis, setKpis] = useState<Record<string, Kpi>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)

  const canWrite = caps.includes('suppliers.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/suppliers?org_id=${org.id}&with_kpis=1`, { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setList(j.suppliers || [])
      const m: Record<string, Kpi> = {}
      for (const k of (j.kpis || [])) m[k.supplier_id] = k
      setKpis(m)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Fornecedores</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('suppliers.read')) return <main style={{ padding: 24 }}><h1>Fornecedores</h1><p>Sem permissão.</p></main>

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Fornecedores</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>{org.name} · {list.length} activos</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/farmacia/compras" style={{ ...btn('ghost'), textDecoration: 'none' }}>Ver encomendas</Link>
          {canWrite && <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Fornecedor</button>}
        </div>
      </div>

      {list.length === 0 ? (
        <div style={emptyCard}>
          <p style={{ margin: 0, color: '#6b7280' }}>Sem fornecedores. Adiciona laboratórios e armazenistas para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {list.map(s => {
            const k = kpis[s.id]
            return (
              <div key={s.id} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16,
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{s.name}</h3>
                    <span style={{ padding: '2px 8px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 11, fontWeight: 600 }}>
                      {KIND_LABELS[s.kind] || s.kind}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6b7280', flexWrap: 'wrap' }}>
                    {s.contact_name && <span>👤 {s.contact_name}</span>}
                    {s.email && <span>✉ {s.email}</span>}
                    {s.phone && <span>☎ {s.phone}</span>}
                    {s.city && <span>📍 {s.city}</span>}
                    {s.payment_terms && <span>💳 {s.payment_terms}</span>}
                    <span>⏱ {s.lead_time_days}d lead</span>
                    {s.cutoff_time && <span>⏰ até {s.cutoff_time.slice(0,5)}</span>}
                  </div>
                  {k && (
                    <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12 }}>
                      <Stat label="Encomendas" value={k.orders_count.toString()} />
                      <Stat label="Volume" value={`€${Number(k.total_value).toFixed(0)}`} />
                      {k.avg_lead_days != null && <Stat label="Lead real" value={`${Number(k.avg_lead_days).toFixed(1)}d`} highlight={k.avg_lead_days > s.lead_time_days + 1} />}
                      {k.orders_open > 0 && <Stat label="Pendentes" value={k.orders_open.toString()} highlight />}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {canWrite && <button onClick={() => setEditing(s)} style={btn('ghost')}>Editar</button>}
                  <Link href={`/farmacia/compras?supplier=${s.id}`} style={{ ...btn('ghost'), textDecoration: 'none' }}>Encomendas</Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showNew || editing) && (
        <SupplierModal
          orgId={org.id}
          supplier={editing}
          onClose={() => { setShowNew(false); setEditing(null) }}
          onSaved={() => { setShowNew(false); setEditing(null); load() }}
          authHeader={authHeader}
        />
      )}
    </main>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: highlight ? '#dc2626' : '#111827', marginTop: 1 }}>{value}</div>
    </div>
  )
}

function SupplierModal({ orgId, supplier, onClose, onSaved, authHeader }: {
  orgId: string; supplier: Supplier | null; onClose: () => void; onSaved: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [form, setForm] = useState({
    name: supplier?.name || '',
    short_name: supplier?.short_name || '',
    kind: supplier?.kind || 'wholesaler',
    vat_number: supplier?.vat_number || '',
    infarmed_code: supplier?.infarmed_code || '',
    edi_code: supplier?.edi_code || '',
    contact_name: supplier?.contact_name || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    city: supplier?.city || '',
    payment_terms: supplier?.payment_terms || '',
    discount_pct: supplier?.discount_pct ?? 0,
    lead_time_days: supplier?.lead_time_days ?? 1,
    cutoff_time: supplier?.cutoff_time || '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof typeof form, v: any) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const url = supplier ? `/api/pharmacy/suppliers/${supplier.id}` : '/api/pharmacy/suppliers'
      const method = supplier ? 'PATCH' : 'POST'
      const body = supplier ? form : { org_id: orgId, ...form }
      const r = await fetch(url, { method, headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={supplier ? `Editar ${supplier.name}` : 'Novo fornecedor'} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Nome"><input required value={form.name} onChange={e => set('name', e.target.value)} style={input} /></Field>
          <Field label="Sigla"><input value={form.short_name} onChange={e => set('short_name', e.target.value)} style={input} /></Field>
        </div>
        <Field label="Tipo">
          <select value={form.kind} onChange={e => set('kind', e.target.value)} style={input}>
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field label="NIF"><input value={form.vat_number} onChange={e => set('vat_number', e.target.value)} style={input} /></Field>
          <Field label="Código INFARMED"><input value={form.infarmed_code} onChange={e => set('infarmed_code', e.target.value)} style={input} /></Field>
          <Field label="Código EDI"><input value={form.edi_code} onChange={e => set('edi_code', e.target.value)} style={input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Pessoa de contacto"><input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} style={input} /></Field>
          <Field label="Cidade"><input value={form.city} onChange={e => set('city', e.target.value)} style={input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Email"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={input} /></Field>
          <Field label="Telefone"><input value={form.phone} onChange={e => set('phone', e.target.value)} style={input} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Field label="Pagamento"><input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} style={input} placeholder="ex: 30 dias" /></Field>
          <Field label="Desconto %"><input type="number" step="0.01" value={form.discount_pct} onChange={e => set('discount_pct', parseFloat(e.target.value) || 0)} style={input} /></Field>
          <Field label="Lead (dias)"><input type="number" value={form.lead_time_days} onChange={e => set('lead_time_days', parseInt(e.target.value) || 1)} style={input} /></Field>
          <Field label="Hora limite"><input type="time" value={form.cutoff_time} onChange={e => set('cutoff_time', e.target.value)} style={input} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy} style={btn('primary')}>{busy ? 'A guardar…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: 14, padding: 20, maxWidth: 720, width: '100%',
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
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
