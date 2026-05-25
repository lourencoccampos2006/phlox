'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

type Cat = 'medicamento' | 'penso' | 'material' | 'suplemento' | 'outro'
interface Item {
  id: string; name: string; category: Cat; quantity: number; unit: string
  min_quantity?: number | null; expiry_date?: string | null; location?: string | null; notes?: string | null
}

const CATS: Record<Cat, string> = { medicamento: 'Medicamento', penso: 'Penso', material: 'Material', suplemento: 'Suplemento', outro: 'Outro' }
const CAT_KEYS = Object.keys(CATS) as Cat[]
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const todayStr = () => new Date().toISOString().slice(0, 10)
const daysTo = (d?: string | null) => d ? Math.round((new Date(d).getTime() - Date.now()) / 86400000) : null

export default function StockSection() {
  const { user, supabase } = useAuth() as any
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'alerts'>('all')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const blank = { name: '', category: 'medicamento' as Cat, quantity: '', unit: 'un', min_quantity: '', expiry_date: '', location: '', notes: '' }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('stock_items').select('*').eq('user_id', user.id).order('expiry_date', { nullsFirst: false })
    if (error) { setTableMissing(true); setItems([]) } else { setTableMissing(false); setItems(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'stock_items', userId: user?.id, onChange: load })

  function openNew() { setForm(blank); setEditId(null); setShowForm(true) }
  function openEdit(it: Item) { setForm({ name: it.name, category: it.category, quantity: String(it.quantity), unit: it.unit, min_quantity: it.min_quantity != null ? String(it.min_quantity) : '', expiry_date: it.expiry_date || '', location: it.location || '', notes: it.notes || '' }); setEditId(it.id); setShowForm(true) }
  async function save() {
    if (!user || !form.name.trim()) return
    setSaving(true)
    const payload = { user_id: user.id, name: form.name.trim(), category: form.category, quantity: parseFloat(form.quantity) || 0, unit: form.unit || 'un', min_quantity: form.min_quantity ? parseFloat(form.min_quantity) : 0, expiry_date: form.expiry_date || null, location: form.location || null, notes: form.notes || null, updated_at: new Date().toISOString() }
    if (editId) await supabase.from('stock_items').update(payload).eq('id', editId).eq('user_id', user.id)
    else await supabase.from('stock_items').insert(payload)
    setSaving(false); setShowForm(false); load()
  }
  async function adjust(it: Item, delta: number) {
    const q = Math.max(0, it.quantity + delta)
    await supabase.from('stock_items').update({ quantity: q }).eq('id', it.id).eq('user_id', user.id)
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, quantity: q } : x))
  }
  async function remove(it: Item) { if (!confirm(`Eliminar ${it.name}?`)) return; await supabase.from('stock_items').delete().eq('id', it.id).eq('user_id', user.id); load() }

  function flag(it: Item): { label: string; color: string; bg: string } | null {
    const d = daysTo(it.expiry_date)
    if (d != null && d < 0) return { label: 'Expirado', color: '#dc2626', bg: '#fef2f2' }
    if (d != null && d <= 30) return { label: `Expira em ${d}d`, color: '#d97706', bg: '#fffbeb' }
    if ((it.min_quantity || 0) > 0 && it.quantity <= (it.min_quantity || 0)) return { label: 'Stock baixo', color: '#b45309', bg: '#fffbeb' }
    return null
  }

  const enriched = items.map(it => ({ it, fl: flag(it) }))
  const filtered = enriched.filter(({ it, fl }) => (filter === 'all' || fl) && (!search || it.name.toLowerCase().includes(search.toLowerCase())))
  filtered.sort((a, b) => (a.fl ? 0 : 1) - (b.fl ? 0 : 1) || (a.it.expiry_date || '9999').localeCompare(b.it.expiry_date || '9999'))

  const expired = enriched.filter(({ it }) => { const d = daysTo(it.expiry_date); return d != null && d < 0 }).length
  const expiring = enriched.filter(({ it }) => { const d = daysTo(it.expiry_date); return d != null && d >= 0 && d <= 30 }).length
  const low = enriched.filter(({ it }) => (it.min_quantity || 0) > 0 && it.quantity <= (it.min_quantity || 0)).length

  if (tableMissing) {
    return <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Stock por configurar</div>
      <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint21_stock.sql</strong> no Supabase para ativar o stock.</div>
    </div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { n: expired, l: 'Expirados', c: '#dc2626', bg: '#fef2f2', bd: '#fca5a5' },
          { n: expiring, l: 'Expiram ≤30d', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
          { n: low, l: 'Stock baixo', c: '#b45309', bg: '#fffbeb', bd: '#fde68a' },
          { n: items.length, l: 'Artigos', c: '#0b1120', bg: 'white', bd: 'var(--border)' },
        ].map(s => (
          <div key={s.l} style={{ flex: '1 1 120px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['all', 'alerts'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 13px', borderRadius: 8, border: `1.5px solid ${filter === f ? '#0d6e42' : 'var(--border)'}`, background: filter === f ? '#eef6f1' : 'white', color: filter === f ? '#0d6e42' : 'var(--ink-4)', fontSize: 12, fontWeight: filter === f ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{f === 'all' ? 'Todos' : 'Só alertas'}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." style={{ ...inp, width: 180, flex: '0 1 180px' }} />
        <button onClick={openNew} style={{ marginLeft: 'auto', padding: '8px 14px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Artigo</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 36, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          {items.length === 0 ? 'Sem artigos em stock. Adiciona o primeiro.' : 'Sem resultados.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(({ it, fl }) => (
            <div key={it.id} style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${fl ? fl.color : 'var(--border)'}`, borderRadius: 10, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{it.name}</span>
                  {fl && <span style={{ fontSize: 10, fontWeight: 700, color: fl.color, background: fl.bg, padding: '1px 7px', borderRadius: 5 }}>{fl.label}</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>
                  {CATS[it.category]}{it.location ? ` · ${it.location}` : ''}{it.expiry_date ? ` · val. ${new Date(it.expiry_date + 'T12:00:00').toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button onClick={() => adjust(it, -1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)' }}>−</button>
                <span style={{ minWidth: 54, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{it.quantity} {it.unit}</span>
                <button onClick={() => adjust(it, 1)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 16, color: 'var(--ink-3)' }}>+</button>
                <button onClick={() => openEdit(it)} style={{ width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', color: 'var(--ink-4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button onClick={() => remove(it)} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 16 }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '20px 22px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>{editId ? 'Editar artigo' : 'Novo artigo'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>Nome *</span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Paracetamol 1g" style={inp} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Categoria</span><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={inp}>{CAT_KEYS.map(c => <option key={c} value={c}>{CATS[c]}</option>)}</select></div>
                <div><span style={lbl}>Localização</span><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Armário A" style={inp} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Quantidade</span><input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} style={inp} /></div>
                <div><span style={lbl}>Unidade</span><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="un, caixa, ml" style={inp} /></div>
                <div><span style={lbl}>Mínimo</span><input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} style={inp} /></div>
              </div>
              <div><span style={lbl}>Validade</span><input type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} style={inp} /></div>
              <button onClick={save} disabled={saving || !form.name.trim()} style={{ padding: '11px', background: (!form.name.trim() || saving) ? 'var(--bg-3)' : '#0d6e42', color: (!form.name.trim() || saving) ? 'var(--ink-4)' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: (!form.name.trim() || saving) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{saving ? 'A guardar…' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
