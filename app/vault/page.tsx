'use client'

// /vault — Cofre de saúde do utilizador.
// Documentos clínicos guardados com pesquisa, categorização e PARTILHA POR
// CÓDIGO TEMPORÁRIO (8 chars, expira, máx-views). Útil para mostrar uma
// receita ou análise a um médico fora do sistema sem dar login.

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import Link from 'next/link'

type VaultDoc = {
  id: string
  title: string
  category: string
  notes: string | null
  body_text: string | null
  issued_at: string | null
  expires_at: string | null
  tags: string[] | null
  pinned: boolean
  created_at: string
}

const CATS: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'exam',         label: 'Análises',      icon: '🧪', color: '#0891b2' },
  { id: 'prescription', label: 'Receita',       icon: '📄', color: '#7c3aed' },
  { id: 'imaging',      label: 'Imagiologia',   icon: '🔬', color: '#0d6e42' },
  { id: 'vaccine',      label: 'Vacina',        icon: '💉', color: '#16a34a' },
  { id: 'report',       label: 'Relatório',     icon: '📋', color: '#475569' },
  { id: 'letter',       label: 'Carta',         icon: '✉',  color: '#b45309' },
  { id: 'other',        label: 'Outro',         icon: '📁', color: '#94a3b8' },
]

export default function VaultPage() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<VaultDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [editing, setEditing] = useState<VaultDoc | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [sharing, setSharing] = useState<VaultDoc | null>(null)
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  async function refresh() {
    if (!user?.id) return
    const { data } = await supabase.from('health_vault')
      .select('*').order('pinned', { ascending: false }).order('updated_at', { ascending: false }).limit(200)
    setItems(data || [])
    setLoading(false)
  }
  useEffect(() => { refresh() }, [user?.id])

  const filtered = items.filter(it => {
    if (catFilter !== 'all' && it.category !== catFilter) return false
    const t = q.trim().toLowerCase()
    if (!t) return true
    return it.title.toLowerCase().includes(t) || (it.notes || '').toLowerCase().includes(t) || (it.body_text || '').toLowerCase().includes(t) || (it.tags || []).join(' ').toLowerCase().includes(t)
  })

  async function saveItem(d: Partial<VaultDoc>, isNew: boolean) {
    if (!user?.id || !d.title) return
    const payload = { ...d, user_id: user.id, updated_at: new Date().toISOString() }
    if (isNew) {
      const { error } = await supabase.from('health_vault').insert(payload)
      if (error) { toast.error(error.message); return }
    } else {
      const { error } = await supabase.from('health_vault').update(payload).eq('id', d.id!)
      if (error) { toast.error(error.message); return }
    }
    toast.success(isNew ? 'Documento adicionado' : 'Atualizado')
    setEditing(null); setAddingNew(false); refresh()
  }

  async function removeItem(id: string) {
    if (!confirm('Eliminar este documento do cofre?')) return
    await supabase.from('health_vault').delete().eq('id', id)
    refresh()
  }

  async function togglePin(it: VaultDoc) {
    await supabase.from('health_vault').update({ pinned: !it.pinned }).eq('id', it.id)
    refresh()
  }

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)' }}>Cofre de saúde</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          Guarda análises, receitas e relatórios num só sítio. Partilha com o médico através de um código temporário — sem dar login, sem perder controlo.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#0d6e42', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 1000 }}>

        <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Pessoal · Premium</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Cofre de saúde</h1>
            <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Análises, receitas e relatórios — pesquisáveis e partilháveis com código temporário.</p>
          </div>
          <button onClick={() => setAddingNew(true)}
            style={{ padding: '11px 18px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>+ Novo</button>
        </div>

        <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Pesquisar em ${items.length} documento${items.length === 1 ? '' : 's'}…`}
          style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 12, outline: 'none', background: 'white' }} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <Chip active={catFilter === 'all'} onClick={() => setCatFilter('all')} color="#0b1120" label={`Tudo · ${items.length}`} />
          {CATS.map(c => {
            const n = items.filter(it => it.category === c.id).length
            if (!n) return null
            return <Chip key={c.id} active={catFilter === c.id} onClick={() => setCatFilter(c.id)} color={c.color} label={`${c.icon} ${c.label} · ${n}`} />
          })}
        </div>

        {loading ? (
          <div style={{ background: 'white', borderRadius: 14, padding: 36, textAlign: 'center', color: '#94a3b8' }}>A carregar…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 36, textAlign: 'center', color: '#94a3b8' }}>
            {items.length === 0 ? 'Cofre vazio — adiciona o primeiro documento.' : 'Nenhum resultado.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(it => {
              const cat = CATS.find(c => c.id === it.category) || CATS[CATS.length - 1]
              return (
                <div key={it.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: cat.color + '14', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>{cat.label}</span>
                      {it.issued_at && <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(it.issued_at).toLocaleDateString('pt-PT')}</span>}
                      {it.pinned && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>★ Fixo</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0b1120', marginTop: 2 }}>{it.title}</div>
                    {it.notes && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, lineHeight: 1.5 }}>{it.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button onClick={() => setSharing(it)} title="Partilhar com código" style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>↗</button>
                    <button onClick={() => setEditing(it)} title="Editar" style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#475569' }}>✎</button>
                    <button onClick={() => togglePin(it)} title="Fixar" style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: it.pinned ? '#b45309' : '#94a3b8' }}>★</button>
                    <button onClick={() => removeItem(it.id)} title="Eliminar" style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 11, color: '#94a3b8' }}>×</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {(editing || addingNew) && (
          <EditModal doc={editing} onClose={() => { setEditing(null); setAddingNew(false) }} onSave={(d) => saveItem(d, addingNew)} />
        )}
        {sharing && <ShareModal doc={sharing} onClose={() => setSharing(null)} />}
      </div>
    </div>
  )
}

function Chip({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 999, border: `1.5px solid ${active ? color : '#e5e7eb'}`, background: active ? color + '14' : 'white', color: active ? color : '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{label}</button>
  )
}

function EditModal({ doc, onClose, onSave }: { doc: VaultDoc | null; onClose: () => void; onSave: (d: Partial<VaultDoc>) => void }) {
  const [title, setTitle] = useState(doc?.title || '')
  const [category, setCategory] = useState(doc?.category || 'exam')
  const [notes, setNotes] = useState(doc?.notes || '')
  const [bodyText, setBodyText] = useState(doc?.body_text || '')
  const [issuedAt, setIssuedAt] = useState(doc?.issued_at || '')
  const [tags, setTags] = useState((doc?.tags || []).join(', '))

  function save() {
    if (!title.trim()) return
    onSave({
      id: doc?.id,
      title: title.trim(),
      category,
      notes: notes.trim() || null,
      body_text: bodyText.trim() || null,
      issued_at: issuedAt || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,17,32,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 560, maxWidth: '100%', maxHeight: '90vh', overflow: 'auto', padding: 20 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 14 }}>{doc ? 'Editar documento' : 'Novo documento'}</div>

        <Label>Título</Label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Análises Set/2026"
          style={input()} />

        <Label>Categoria</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {CATS.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)}
              style={{ padding: '6px 11px', borderRadius: 8, border: `1.5px solid ${category === c.id ? c.color : '#e5e7eb'}`, background: category === c.id ? c.color + '14' : 'white', color: category === c.id ? c.color : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Label>Data do documento</Label>
            <input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} style={input()} />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="cardio, anual" style={input()} />
          </div>
        </div>

        <Label>Notas (opcional)</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...input(), resize: 'vertical' }} />

        <Label>Texto/conteúdo (para pesquisar e mostrar)</Label>
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} rows={5} placeholder="Cola o conteúdo do documento aqui…" style={{ ...input(), resize: 'vertical' }} />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 16px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} style={{ padding: '9px 18px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Guardar</button>
        </div>
      </div>
    </div>
  )
}

function ShareModal({ doc, onClose }: { doc: VaultDoc; onClose: () => void }) {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [duration, setDuration] = useState<24 | 168 | 720>(24)
  const [maxViews, setMaxViews] = useState<number>(5)
  const [code, setCode] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  async function createShare() {
    if (!user?.id) return
    setCreating(true)
    try {
      // Gera código 8 chars
      const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
      let c = ''
      for (let i = 0; i < 8; i++) c += chars[Math.floor(Math.random() * chars.length)]
      const expires = new Date(Date.now() + duration * 3600 * 1000).toISOString()
      const { error } = await supabase.from('health_vault_shares').insert({
        user_id: user.id, code: c, vault_ids: [doc.id], expires_at: expires, max_views: maxViews,
      })
      if (error) { toast.error(error.message); return }
      setCode(c)
    } finally { setCreating(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(11,17,32,0.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 14, width: 460, maxWidth: '100%', padding: 22 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#0b1120', marginBottom: 6 }}>Partilhar com código</div>
        <p style={{ fontSize: 12.5, color: '#64748b', marginTop: 0, marginBottom: 16, lineHeight: 1.55 }}>
          Gera um código temporário que qualquer pessoa pode usar em phlox.../v/CÓDIGO para ver este documento. Expira automaticamente.
        </p>

        {!code ? (
          <>
            <Label>Validade</Label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[[24, '24h'], [168, '7 dias'], [720, '30 dias']].map(([v, l]) => (
                <button key={v} onClick={() => setDuration(v as 24 | 168 | 720)}
                  style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1.5px solid ${duration === v ? '#0d6e42' : '#e5e7eb'}`, background: duration === v ? '#f0fdf4' : 'white', color: duration === v ? '#0d6e42' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>
            <Label>Máximo de visualizações</Label>
            <input type="number" min={1} max={50} value={maxViews} onChange={e => setMaxViews(Number(e.target.value) || 1)} style={input()} />

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
              <button onClick={onClose} style={{ padding: '9px 16px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={createShare} disabled={creating} style={{ padding: '9px 18px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{creating ? 'A criar…' : 'Gerar código'}</button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 800, color: '#0d6e42', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 8px', letterSpacing: '0.2em', marginBottom: 12 }}>{code}</div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>Indica este código (ou o link) ao destinatário.</div>
            <button onClick={() => { navigator.clipboard.writeText(`${location.origin}/v/${code}`); toast.success('Link copiado') }}
              style={{ width: '100%', padding: '10px', background: '#0b1120', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 6 }}>
              📋 Copiar link
            </button>
            <button onClick={onClose} style={{ width: '100%', padding: '9px', background: 'white', color: '#475569', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, marginTop: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</div> }
function input(): React.CSSProperties { return { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', marginBottom: 4 } }
