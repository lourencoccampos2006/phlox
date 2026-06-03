'use client'

// /farmacia/compras — Encomendas a fornecedores + recepção de mercadoria
// Vista unificada: lista de POs (draft/sent/partial/received) com modal de detalhe
// e modal de recepção (cria goods_receipt + linhas com lote/validade).

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useActiveOrg } from '@/lib/orgContext'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Supplier { id: string; name: string; short_name: string|null; lead_time_days: number }
interface PO {
  id: string; number: string; status: 'draft'|'sent'|'partial'|'received'|'cancelled'
  ordered_at: string|null; expected_at: string|null; received_at: string|null
  total_qty: number; total_lines: number; total_amount: number; notes: string|null
  created_at: string
  supplier: { id: string; name: string; short_name: string|null } | null
}
interface POItem {
  id: string; product_name: string; ean: string|null; cnpem: string|null
  qty: number; unit_price: number; discount_pct: number; vat_rate: number
  qty_received: number
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: 'Rascunho',  color: '#374151', bg: '#f3f4f6' },
  sent:     { label: 'Enviada',   color: '#1e40af', bg: '#dbeafe' },
  partial:  { label: 'Parcial',   color: '#92400e', bg: '#fef3c7' },
  received: { label: 'Recebida',  color: '#065f46', bg: '#d1fae5' },
  cancelled:{ label: 'Cancelada', color: '#991b1b', bg: '#fee2e2' },
}

const ACCENT = '#0d6e42'

export default function ComprasPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>}>
      <ComprasInner />
    </Suspense>
  )
}

function ComprasInner() {
  const { user, supabase } = useAuth() as any
  const { org, caps, loading: orgLoading } = useActiveOrg()
  const params = useSearchParams()
  const filterSupplier = params.get('supplier')

  const [list, setList] = useState<PO[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [detail, setDetail] = useState<PO | null>(null)
  const [receive, setReceive] = useState<PO | null>(null)

  const canBuy = caps.includes('stock.purchase')
  const canReceive = caps.includes('stock.write')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    if (!org) return
    setLoading(true); setErr(null)
    try {
      const headers = await authHeader()
      const url = new URL('/api/pharmacy/purchase-orders', window.location.origin)
      url.searchParams.set('org_id', org.id)
      if (statusFilter) url.searchParams.set('status', statusFilter)
      if (filterSupplier) url.searchParams.set('supplier_id', filterSupplier)
      const r = await fetch(url.toString(), { headers })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      setList(j.orders || [])

      const sr = await fetch(`/api/pharmacy/suppliers?org_id=${org.id}`, { headers })
      const sj = await sr.json()
      setSuppliers(sj.suppliers || [])
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }, [org, statusFilter, filterSupplier, authHeader])

  useEffect(() => { if (user && !orgLoading) load() }, [user, orgLoading, load])

  if (orgLoading || loading) return <main style={{ padding: 24 }}><p style={{ color: '#6b7280' }}>A carregar…</p></main>
  if (!org) return <main style={{ padding: 24 }}><h1>Compras</h1><p>Seleciona uma organização.</p></main>
  if (!caps.includes('stock.read')) return <main style={{ padding: 24 }}><h1>Compras</h1><p>Sem permissão.</p></main>

  const totals = list.reduce((acc, p) => ({
    open: acc.open + (p.status === 'sent' || p.status === 'partial' ? 1 : 0),
    drafts: acc.drafts + (p.status === 'draft' ? 1 : 0),
    value: acc.value + (Number(p.total_amount) || 0),
  }), { open: 0, drafts: 0, value: 0 })

  return (
    <main style={{ padding: '20px clamp(16px, 4vw, 32px)', maxWidth: 1400, margin: '0 auto' }}>
      {err && <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 8, marginBottom: 16 }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700 }}>Compras</h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
            {org.name} · {totals.drafts} rascunhos · {totals.open} pendentes · €{totals.value.toFixed(2)} em volume
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/farmacia/fornecedores" style={{ ...btn('ghost'), textDecoration: 'none' }}>Fornecedores</Link>
          {canBuy && <button onClick={() => setShowNew(true)} style={btn('primary')}>+ Nova encomenda</button>}
        </div>
      </div>

      {/* Filtro de estado */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <FilterChip active={!statusFilter} onClick={() => setStatusFilter('')}>Todos</FilterChip>
        {Object.entries(STATUS_META).map(([k, m]) => (
          <FilterChip key={k} active={statusFilter === k} onClick={() => setStatusFilter(k)} color={m.color} bg={m.bg}>{m.label}</FilterChip>
        ))}
      </div>

      {list.length === 0 ? (
        <div style={emptyCard}><p style={{ margin: 0, color: '#6b7280' }}>Sem encomendas.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {list.map(p => {
            const m = STATUS_META[p.status] || STATUS_META.draft
            return (
              <div key={p.id} onClick={() => setDetail(p)} style={{
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12,
                cursor: 'pointer', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
              }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#111827', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{p.number}</div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.supplier?.name || '—'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                    {p.total_lines} linha{p.total_lines === 1 ? '' : 's'} · {Number(p.total_qty).toFixed(0)} un
                    {p.expected_at && ` · prev. ${new Date(p.expected_at).toLocaleDateString('pt-PT')}`}
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', flexShrink: 0 }}>
                  €{Number(p.total_amount || 0).toFixed(2)}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.color, fontSize: 10, fontWeight: 700 }}>
                    {m.label.toUpperCase()}
                  </span>
                  {canReceive && (p.status === 'sent' || p.status === 'partial') && (
                    <button onClick={e => { e.stopPropagation(); setReceive(p) }} style={{ ...btn('ghost'), fontSize: 11, padding: '4px 8px' }}>
                      Receber
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewPOModal orgId={org.id} suppliers={suppliers} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} authHeader={authHeader} />}
      {detail && <PODetailModal po={detail} canBuy={canBuy} onClose={() => setDetail(null)} onUpdated={() => { setDetail(null); load() }} authHeader={authHeader} />}
      {receive && <ReceiveModal orgId={org.id} po={receive} onClose={() => setReceive(null)} onSaved={() => { setReceive(null); load() }} authHeader={authHeader} />}
    </main>
  )
}

function FilterChip({ children, active, onClick, color, bg }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string; bg?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
      background: active ? (color || ACCENT) : (bg || '#f3f4f6'),
      color: active ? 'white' : (color || '#374151'),
    }}>{children}</button>
  )
}

function NewPOModal({ orgId, suppliers, onClose, onCreated, authHeader }: {
  orgId: string; suppliers: Supplier[]; onClose: () => void; onCreated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [supplierId, setSupplierId] = useState('')
  const [expected, setExpected] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<{ product_name: string; qty: number; unit_price: number; ean: string }[]>([
    { product_name: '', qty: 1, unit_price: 0, ean: '' },
  ])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0)

  function setItem(idx: number, k: keyof typeof items[0], v: any) {
    setItems(arr => arr.map((it, i) => i === idx ? { ...it, [k]: v } : it))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch('/api/pharmacy/purchase-orders', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId, supplier_id: supplierId,
        expected_at: expected || null, notes: notes || null,
        items: items.filter(i => i.product_name).map(i => ({
          product_name: i.product_name, qty: i.qty, unit_price: i.unit_price,
          ean: i.ean || undefined,
        })),
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onCreated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Nova encomenda" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <Field label="Fornecedor">
          <select required value={supplierId} onChange={e => setSupplierId(e.target.value)} style={input}>
            <option value="">— Selecionar —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.lead_time_days ? ` (${s.lead_time_days}d lead)` : ''}</option>)}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <Field label="Entrega prevista"><input type="date" value={expected} onChange={e => setExpected(e.target.value)} style={input} /></Field>
          <Field label="Notas"><input value={notes} onChange={e => setNotes(e.target.value)} style={input} placeholder="ex: urgente" /></Field>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Linhas ({items.length})</div>
            <button type="button" onClick={() => setItems(arr => [...arr, { product_name: '', qty: 1, unit_price: 0, ean: '' }])} style={{ ...btn('ghost'), padding: '4px 10px', fontSize: 12 }}>+ Linha</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {items.map((it, idx) => (
              <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, position: 'relative' }}>
                <button type="button" onClick={() => setItems(arr => arr.filter((_, i) => i !== idx))}
                  style={{ position: 'absolute', top: 4, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, lineHeight: 1 }}>×</button>
                <input placeholder="Produto" value={it.product_name} onChange={e => setItem(idx, 'product_name', e.target.value)} style={{ ...input, marginBottom: 6 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
                  <input placeholder="EAN" value={it.ean} onChange={e => setItem(idx, 'ean', e.target.value)} style={input} />
                  <input type="number" step="0.01" placeholder="Preço €" value={it.unit_price} onChange={e => setItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} style={input} />
                  <input type="number" placeholder="Quantidade" value={it.qty} onChange={e => setItem(idx, 'qty', parseFloat(e.target.value) || 0)} style={input} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'right', marginTop: 8, fontSize: 14, fontWeight: 700 }}>
            Total: €{total.toFixed(2)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy || !supplierId} style={btn('primary')}>{busy ? 'A criar…' : 'Criar rascunho'}</button>
        </div>
      </form>
    </Modal>
  )
}

function PODetailModal({ po, canBuy, onClose, onUpdated, authHeader }: {
  po: PO; canBuy: boolean; onClose: () => void; onUpdated: () => void
  authHeader: () => Promise<Record<string, string>>
}) {
  const [items, setItems] = useState<POItem[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/purchase-orders/${po.id}`, { headers })
      const j = await r.json()
      if (r.ok) setItems(j.items || [])
    })()
  }, [po.id, authHeader])

  async function action(body: any) {
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/purchase-orders/${po.id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onUpdated()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  const m = STATUS_META[po.status] || STATUS_META.draft

  return (
    <Modal title={`Encomenda ${po.number}`} onClose={onClose}>
      {err && <div style={errBox}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <span style={{ padding: '4px 10px', borderRadius: 999, background: m.bg, color: m.color, fontSize: 12, fontWeight: 700 }}>{m.label.toUpperCase()}</span>
        {po.supplier && <span style={{ padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', color: '#374151', fontSize: 12 }}>{po.supplier.name}</span>}
      </div>
      <div style={{ background: '#f9fafb', padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13, color: '#374151' }}>
        {po.ordered_at && <div>Enviada: {new Date(po.ordered_at).toLocaleString('pt-PT')}</div>}
        {po.expected_at && <div>Prevista: {new Date(po.expected_at).toLocaleDateString('pt-PT')}</div>}
        {po.received_at && <div>Recebida: {new Date(po.received_at).toLocaleString('pt-PT')}</div>}
        {po.notes && <div style={{ marginTop: 4 }}><b>Notas:</b> {po.notes}</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>LINHAS ({items.length})</div>
        <div style={{ display: 'grid', gap: 4 }}>
          {items.map(it => {
            const pct = it.qty > 0 ? Math.round(100 * it.qty_received / it.qty) : 0
            return (
              <div key={it.id} style={{ background: 'white', border: '1px solid #f3f4f6', padding: 10, borderRadius: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{it.product_name}</span>
                  <span style={{ color: '#374151' }}>{Number(it.qty_received)}/{Number(it.qty)} · €{(it.qty * it.unit_price).toFixed(2)}</span>
                </div>
                {it.qty_received > 0 && (
                  <div style={{ marginTop: 4, height: 4, background: '#f3f4f6', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 100 ? '#10b981' : '#f59e0b', borderRadius: 2 }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'right', marginTop: 8, fontSize: 14, fontWeight: 700 }}>
          Total: €{Number(po.total_amount || 0).toFixed(2)}
        </div>
      </div>

      {canBuy && po.status === 'draft' && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid #e5e7eb' }}>
          <button onClick={() => { if (confirm('Cancelar este rascunho?')) action({ action: 'cancel' }) }} disabled={busy} style={btn('ghost')}>Cancelar</button>
          <button onClick={() => action({ action: 'send' })} disabled={busy} style={btn('primary')}>Enviar ao fornecedor</button>
        </div>
      )}
    </Modal>
  )
}

function ReceiveModal({ orgId, po, onClose, onSaved, authHeader }: {
  orgId: string; po: PO; onClose: () => void; onSaved: () => void; authHeader: () => Promise<Record<string, string>>
}) {
  const [items, setItems] = useState<POItem[]>([])
  const [received, setReceived] = useState<Record<string, { qty: number; batch: string; expiry: string }>>({})
  const [invoice, setInvoice] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const headers = await authHeader()
      const r = await fetch(`/api/pharmacy/purchase-orders/${po.id}`, { headers })
      const j = await r.json()
      if (r.ok) {
        setItems(j.items || [])
        const init: Record<string, any> = {}
        for (const it of (j.items || [])) {
          init[it.id] = { qty: Math.max(0, it.qty - it.qty_received), batch: '', expiry: '' }
        }
        setReceived(init)
      }
    })()
  }, [po.id, authHeader])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const headers = await authHeader()
      const rows = items
        .filter(it => (received[it.id]?.qty || 0) > 0)
        .map(it => ({
          purchase_order_item_id: it.id,
          product_name: it.product_name,
          qty: received[it.id].qty,
          unit_price: it.unit_price,
          ean: it.ean || undefined,
          batch_number: received[it.id].batch || undefined,
          expiry_date: received[it.id].expiry || undefined,
        }))
      if (rows.length === 0) throw new Error('Indica pelo menos uma quantidade recebida')
      const r = await fetch('/api/pharmacy/receipts', { method: 'POST', headers, body: JSON.stringify({
        org_id: orgId,
        supplier_id: po.supplier?.id,
        purchase_order_id: po.id,
        invoice_number: invoice || null,
        invoice_date: invoiceDate || null,
        items: rows,
      }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro')
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title={`Receber ${po.number}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        {err && <div style={errBox}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Nº de factura"><input value={invoice} onChange={e => setInvoice(e.target.value)} style={input} /></Field>
          <Field label="Data factura"><input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} style={input} /></Field>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Linhas a receber</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {items.map(it => {
              const pending = Math.max(0, it.qty - it.qty_received)
              return (
                <div key={it.id} style={{ background: '#f9fafb', padding: 10, borderRadius: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{it.product_name}</span>
                    <span style={{ color: '#6b7280' }}>pendente: {pending}/{it.qty}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 140px 140px', gap: 6 }}>
                    <input type="number" min={0} max={pending} value={received[it.id]?.qty ?? 0}
                      onChange={e => setReceived(r => ({ ...r, [it.id]: { ...r[it.id], qty: parseFloat(e.target.value) || 0 } }))} style={input} />
                    <input placeholder="Lote" value={received[it.id]?.batch || ''}
                      onChange={e => setReceived(r => ({ ...r, [it.id]: { ...r[it.id], batch: e.target.value } }))} style={input} />
                    <input type="date" placeholder="Validade" value={received[it.id]?.expiry || ''}
                      onChange={e => setReceived(r => ({ ...r, [it.id]: { ...r[it.id], expiry: e.target.value } }))} style={input} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" onClick={onClose} style={btn('ghost')}>Cancelar</button>
          <button type="submit" disabled={busy} style={btn('primary')}>{busy ? 'A receber…' : 'Confirmar recepção'}</button>
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
  return <label style={{ display: 'block' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>{children}</label>
}
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: 'white', boxSizing: 'border-box' }
const errBox: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 8 }
const emptyCard: React.CSSProperties = { background: 'white', border: '1px dashed #d1d5db', padding: 28, borderRadius: 12, textAlign: 'center' }
function btn(kind: 'primary' | 'ghost'): React.CSSProperties {
  if (kind === 'primary') return { padding: '8px 14px', border: 'none', borderRadius: 8, cursor: 'pointer', background: ACCENT, color: 'white', fontWeight: 600, fontSize: 14 }
  return { padding: '8px 14px', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', background: 'white', color: '#374151', fontWeight: 600, fontSize: 14 }
}
