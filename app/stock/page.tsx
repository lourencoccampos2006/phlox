'use client'

// Stock & validades — existências, ruturas e prazos de validade.
// Transversal: medicamentos, consumíveis, EPI, produtos de limpeza.
// Alertas de stock baixo e validade próxima — útil da farmácia ao lar e à clínica.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { buildProducts, type ImportedProduct } from '@/lib/productImport'
import { printDoc, type PrintRecord } from '@/lib/print'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'

interface Item {
  id: string; name: string; category: string; quantity: number; min_quantity: number
  unit?: string | null; expiry_date?: string | null; location?: string | null; updated_at: string
  barcode?: string | null; ref?: string | null; price?: number | null; tax_rate?: number | null
}

const CATS: Record<string, { label: string; icon: string; color: string }> = {
  medicamento: { label: 'Medicamento', icon: '💊', color: '#2563eb' },
  consumivel:  { label: 'Consumível',  icon: '🧴', color: '#0d9488' },
  epi:         { label: 'EPI',         icon: '🧤', color: '#7c3aed' },
  limpeza:     { label: 'Limpeza',     icon: '🧹', color: '#0891b2' },
  geral:       { label: 'Geral',       icon: '📦', color: '#64748b' },
}
const CAT_KEYS = Object.keys(CATS)
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

function expiryDays(d?: string | null) { return d ? Math.floor((new Date(d + 'T12:00').getTime() - Date.now()) / 86400000) : null }

export default function StockPage() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const { institution } = useClinicPrefs()
  const cfg = institutionConfig(institution)
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', category: 'medicamento', quantity: '', min_quantity: '', unit: '', expiry: '', location: '', barcode: '', ref: '', price: '', tax_rate: '23' }
  const [form, setForm] = useState<any>(blank)
  // Importação em massa
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<{ products: ImportedProduct[]; cols: string[] } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { products, columns } = buildProducts(String(reader.result || ''))
      setPreview({ products, cols: Object.keys(columns) })
      setImportMsg(products.length ? `${products.length} produto(s) detetado(s).` : 'Não consegui detetar produtos. Verifica o ficheiro.')
    }
    reader.readAsText(file, 'utf-8')
  }

  async function runImport() {
    if (!preview || !user || preview.products.length === 0) return
    setImportBusy(true); setImportMsg('A importar…')
    let ok = 0, fail = 0
    // mapa de barcodes existentes para decidir update vs insert
    const existingByBarcode: Record<string, string> = {}
    items.forEach(it => { if (it.barcode) existingByBarcode[it.barcode] = it.id })
    for (const p of preview.products) {
      const row: any = scope.stamp({
        name: p.name, category: p.category && CAT_KEYS.includes(p.category) ? p.category : 'medicamento',
        barcode: p.barcode || null, ref: p.ref || null,
        price: p.price ?? 0, cost: p.cost ?? 0, tax_rate: p.tax_rate ?? 23,
        quantity: p.quantity ?? 0, min_quantity: p.min_quantity ?? 0, unit: p.unit || null,
        updated_at: new Date().toISOString(),
      })
      let res
      if (p.barcode && existingByBarcode[p.barcode]) res = await supabase.from('stock_items').update(row).eq('id', existingByBarcode[p.barcode])
      else res = await supabase.from('stock_items').insert(row)
      if (res.error) fail++; else ok++
    }
    setImportMsg(`Importados ${ok}${fail ? ` · ${fail} falharam` : ''}.`)
    setImportBusy(false)
    setTimeout(() => { setImporting(false); setPreview(null); setImportMsg(''); load() }, 1200)
  }

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const { data, error } = await scope.filter(supabase.from('stock_items').select('*')).order('name')
    if (error) { if (/relation .*stock_items.* does not exist/i.test(error.message)) setMissing(true); setItems([]) }
    else { setMissing(false); setItems(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'stock_items', userId: scope.liveFilterValue || user?.id, onChange: load })

  async function add() {
    if (!form.name.trim()) { setErr('Indica o nome do produto.'); return }
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('stock_items').insert(scope.stamp({
      name: form.name.trim(), category: form.category,
      quantity: Number(form.quantity) || 0, min_quantity: Number(form.min_quantity) || 0,
      unit: form.unit.trim() || null, expiry_date: form.expiry || null, location: form.location.trim() || null,
      barcode: form.barcode.trim() || null, ref: form.ref.trim() || null,
      price: parseFloat(form.price) || 0, tax_rate: parseFloat(form.tax_rate) || 0,
    })).select().single()
    if (!error && data) { setItems(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name))); setShowForm(false); setForm(blank) }
    else setErr(error?.message || 'Erro')
    setSaving(false)
  }
  async function adjust(it: Item, delta: number) {
    const q = Math.max(0, Number(it.quantity) + delta)
    await supabase.from('stock_items').update({ quantity: q, updated_at: new Date().toISOString() }).eq('id', it.id)
    setItems(p => p.map(x => x.id === it.id ? { ...x, quantity: q } : x))
  }
  async function del(id: string) {
    await supabase.from('stock_items').delete().eq('id', id)
    setItems(p => p.filter(x => x.id !== id))
  }

  const shown = filter === 'all' ? items : items.filter(i => i.category === filter)
  const low = items.filter(i => i.min_quantity > 0 && i.quantity <= i.min_quantity)
  const expiringSoon = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d >= 0 && d <= 30 })
  const expired = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d < 0 })

  // Relatório profissional (A4): ruturas para encomendar + validades a expirar +
  // produtos fora de validade. É o documento de ordem de compra / auditoria.
  function printStockReport() {
    const fmtQty = (i: Item) => `${i.quantity}${i.unit ? ' ' + i.unit : ''}`
    const sections = []
    if (low.length) sections.push({
      heading: `Ruturas — repor (${low.length})`,
      records: low.map<PrintRecord>(i => ({
        title: i.name,
        meta: i.location ? `Local: ${i.location}` : '',
        tags: [{ label: i.quantity === 0 ? 'ESGOTADO' : 'Stock baixo', color: '#b91c1c' }],
        fields: [{ label: 'Em stock', value: fmtQty(i) }, { label: 'Mínimo', value: String(i.min_quantity) }, { label: 'A repor', value: String(Math.max(0, i.min_quantity - i.quantity)) }, { label: 'Categoria', value: i.category || '—' }],
      })),
    })
    if (expired.length) sections.push({
      heading: `Fora de validade — retirar (${expired.length})`,
      records: expired.map<PrintRecord>(i => ({
        title: i.name,
        tags: [{ label: 'EXPIRADO', color: '#7f1d1d' }],
        fields: [{ label: 'Validade', value: i.expiry_date || '—' }, { label: 'Quantidade', value: fmtQty(i) }, { label: 'Local', value: i.location || '—' }],
      })),
    })
    if (expiringSoon.length) sections.push({
      heading: `Validade a expirar (≤30 dias) — ${expiringSoon.length}`,
      records: expiringSoon.map<PrintRecord>(i => {
        const d = expiryDays(i.expiry_date)
        return {
          title: i.name,
          tags: [{ label: `${d} dias`, color: '#b45309' }],
          fields: [{ label: 'Validade', value: i.expiry_date || '—' }, { label: 'Quantidade', value: fmtQty(i) }, { label: 'Local', value: i.location || '—' }],
        }
      }),
    })
    if (!sections.length) sections.push({ heading: 'Tudo em ordem', records: [{ title: 'Sem ruturas nem validades a expirar', body: 'Não há produtos em rutura, expirados ou a expirar nos próximos 30 dias.' }] })

    printDoc({
      docTitle: 'Relatório de Stock & Validades',
      docSubtitle: new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      institution: cfg.unitNoun,
      author: (user as any)?.name || user?.email || '',
      meta: [
        { label: 'Produtos', value: String(items.length) },
        { label: 'Ruturas', value: String(low.length) },
        { label: 'A expirar', value: String(expiringSoon.length) },
        { label: 'Expirados', value: String(expired.length) },
      ],
      sections,
      footerNote: 'Relatório gerado pelo Phlox · Verificado por: __________________',
    })
  }

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 940 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Operações</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Stock & validades</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Existências, ruturas e prazos — de medicamentos a EPI e produtos de limpeza.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={printStockReport} title="Relatório A4 de ruturas e validades — para encomendas e auditoria"
              style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>🖨 Relatório</button>
            <button onClick={() => { setImporting(true); setPreview(null); setImportMsg('') }} style={{ padding: '10px 14px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'var(--font-sans)' }}>Importar CSV</button>
            <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Produto</button>
          </div>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Indisponível de momento</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {[
                { n: items.length, l: 'Produtos', c: '#0b1120', bg: '#f9fafb', bd: '#e5e7eb' },
                { n: low.length, l: 'Stock baixo', c: low.length ? '#dc2626' : '#16a34a', bg: low.length ? '#fef2f2' : '#f0fdf4', bd: low.length ? '#fecaca' : '#bbf7d0' },
                { n: expiringSoon.length, l: 'Validade ≤30d', c: expiringSoon.length ? '#d97706' : '#16a34a', bg: expiringSoon.length ? '#fffbeb' : '#f0fdf4', bd: expiringSoon.length ? '#fde68a' : '#bbf7d0' },
                { n: expired.length, l: 'Expirados', c: expired.length ? '#dc2626' : '#16a34a', bg: expired.length ? '#fef2f2' : '#f0fdf4', bd: expired.length ? '#fecaca' : '#bbf7d0' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 110px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setFilter('all')} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${filter === 'all' ? '#0b1120' : 'var(--border)'}`, background: filter === 'all' ? '#0b112010' : 'white', color: filter === 'all' ? '#0b1120' : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>Todos</button>
              {CAT_KEYS.map(k => (
                <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${filter === k ? CATS[k].color : 'var(--border)'}`, background: filter === k ? CATS[k].color + '12' : 'white', color: filter === k ? CATS[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{CATS[k].icon} {CATS[k].label}</button>
              ))}
            </div>
            {err && !missing && <div style={{ marginBottom: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#991b1b', fontSize: 13, padding: '12px 16px' }}>{err}</div>}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>
            ) : shown.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem produtos. Adiciona o primeiro com “+ Produto”.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {shown.map(it => {
                  const cat = CATS[it.category] || CATS.geral
                  const isLow = it.min_quantity > 0 && it.quantity <= it.min_quantity
                  const d = expiryDays(it.expiry_date)
                  const expColor = d === null ? null : d < 0 ? '#dc2626' : d <= 30 ? '#d97706' : '#16a34a'
                  return (
                    <div key={it.id} style={{ ...card, padding: '11px 15px', borderLeft: `3px solid ${isLow ? '#dc2626' : cat.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0b1120' }}>{cat.icon} {it.name}</span>
                            {isLow && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', padding: '1px 6px', borderRadius: 4 }}>Stock baixo</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-5)', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {it.price ? <span style={{ color: '#0d6e42', fontWeight: 700 }}>{(Math.round(it.price * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2 })}€</span> : null}
                            {it.barcode && <span>▮ {it.barcode}</span>}
                            {it.location && <span>📍 {it.location}</span>}
                            {it.min_quantity > 0 && <span>mín. {it.min_quantity}{it.unit ? ` ${it.unit}` : ''}</span>}
                            {d !== null && <span style={{ color: expColor!, fontWeight: 600 }}>{d < 0 ? `expirado há ${-d}d` : `validade em ${d}d`}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => adjust(it, -1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)' }}>−</button>
                          <span style={{ minWidth: 48, textAlign: 'center', fontSize: 15, fontWeight: 800, color: isLow ? '#dc2626' : '#0b1120' }}>{it.quantity}{it.unit ? <span style={{ fontSize: 10, fontWeight: 500, color: '#9ca3af' }}> {it.unit}</span> : ''}</span>
                          <button onClick={() => adjust(it, 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)' }}>+</button>
                          <button onClick={() => del(it.id)} style={{ fontSize: 16, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 2 }}>×</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Novo produto</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>Nome</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Luvas nitrilo M, Paracetamol 1g…" style={inp} autoFocus /></div>
              <div>
                <span style={lbl}>Categoria</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CAT_KEYS.map(k => <button key={k} onClick={() => setForm({ ...form, category: k })} style={{ padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.category === k ? CATS[k].color : 'var(--border)'}`, background: form.category === k ? CATS[k].color + '12' : 'white', color: form.category === k ? CATS[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{CATS[k].icon} {CATS[k].label}</button>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Quantidade</span><input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Mínimo</span><input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Unidade</span><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="cx, un…" style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Validade</span><input type="date" value={form.expiry} onChange={e => setForm({ ...form, expiry: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Localização</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ex: Armário A2" style={inp} /></div>
              </div>
              {/* Venda / POS — código de barras e preço */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 2 }}>
                <span style={{ ...lbl, marginBottom: 8 }}>Venda (Ponto de Venda)</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div><span style={lbl}>Código de barras (EAN/CNP)</span><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="560..." data-pos-scan style={inp} /></div>
                  <div><span style={lbl}>Referência / SKU</span><input value={form.ref} onChange={e => setForm({ ...form, ref: e.target.value })} placeholder="Interna" style={inp} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div><span style={lbl}>PVP (€)</span><input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="0.00" style={inp} /></div>
                  <div><span style={lbl}>IVA %</span><input type="number" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: e.target.value })} style={inp} /></div>
                </div>
              </div>
              <button onClick={add} disabled={saving} style={{ padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : 'Adicionar produto'}</button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget && !importBusy) setImporting(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Importar produtos (CSV)</h2>
              <button onClick={() => !importBusy && setImporting(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, margin: '0 0 14px' }}>Aceita exports de <strong>Sifarma</strong>, ERP genéricos ou Excel guardado como CSV. Deteta automaticamente as colunas (CNP/EAN, designação, PVP, IVA, stock). Atualiza por código de barras; novos são criados.</p>

            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: 14, border: '1.5px dashed var(--border)', borderRadius: 10, background: 'var(--bg-2)', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#374151', fontFamily: 'var(--font-sans)' }}>
              📄 Escolher ficheiro CSV
            </button>

            {importMsg && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: importMsg.includes('Não') || importMsg.includes('falharam') ? '#dc2626' : '#16a34a' }}>{importMsg}</div>}

            {preview && preview.products.length > 0 && (
              <>
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-5)' }}>Colunas detetadas: {preview.cols.join(', ') || 'posicional'}</div>
                <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                  {preview.products.slice(0, 30).map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 12px', borderBottom: '1px solid var(--bg-2)', fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, color: 'var(--ink-2)' }}>{p.name}{p.barcode ? <span style={{ color: 'var(--ink-5)' }}> · {p.barcode}</span> : ''}</span>
                      <span style={{ flexShrink: 0, fontWeight: 700, color: '#0d6e42' }}>{p.price != null ? `${p.price.toFixed(2)}€` : '—'}</span>
                    </div>
                  ))}
                  {preview.products.length > 30 && <div style={{ padding: '7px 12px', fontSize: 11.5, color: 'var(--ink-5)', textAlign: 'center' }}>+{preview.products.length - 30} mais</div>}
                </div>
                <button onClick={runImport} disabled={importBusy} style={{ width: '100%', marginTop: 14, padding: 13, background: importBusy ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: importBusy ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {importBusy ? 'A importar…' : `Importar ${preview.products.length} produto(s)`}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
