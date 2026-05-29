'use client'

// Stock & validades — existências, ruturas e prazos de validade.
// Transversal: medicamentos, consumíveis, EPI, produtos de limpeza.
// Alertas de stock baixo e validade próxima — útil da farmácia ao lar e à clínica.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

interface Item {
  id: string; name: string; category: string; quantity: number; min_quantity: number
  unit?: string | null; expiry_date?: string | null; location?: string | null; updated_at: string
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
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', category: 'medicamento', quantity: '', min_quantity: '', unit: '', expiry: '', location: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const { data, error } = await supabase.from('stock_items').select('*').eq('user_id', user.id).order('name')
    if (error) { if (/relation .*stock_items.* does not exist/i.test(error.message)) setMissing(true); setItems([]) }
    else { setMissing(false); setItems(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'stock_items', userId: user?.id, onChange: load })

  async function add() {
    if (!form.name.trim()) { setErr('Indica o nome do produto.'); return }
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('stock_items').insert({
      user_id: user.id, name: form.name.trim(), category: form.category,
      quantity: Number(form.quantity) || 0, min_quantity: Number(form.min_quantity) || 0,
      unit: form.unit.trim() || null, expiry_date: form.expiry || null, location: form.location.trim() || null,
    }).select().single()
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
  const expiringSoon = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d <= 30 })
  const expired = items.filter(i => { const d = expiryDays(i.expiry_date); return d !== null && d < 0 })

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
          <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Produto</button>
        </div>

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Stock por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint32_institution_ops.sql</strong> no Supabase para ativar.</div>
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
              <button onClick={add} disabled={saving} style={{ padding: 12, background: '#2563eb', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : 'Adicionar produto'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
