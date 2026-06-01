'use client'

// /guardados — biblioteca central de tudo o que o utilizador guardou.
// Pesquisa, filtro por tipo, reabrir, pin, eliminar. Privacidade total: localStorage.

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { getAllSaves, remove, togglePin, clearAll, KIND_META, SAVES_EVENT, type SavedItem, type SavedKind } from '@/lib/saves'
import { useToast } from '@/components/Toast'

export default function GuardadosPage() {
  const [items, setItems] = useState<SavedItem[]>([])
  const [q, setQ] = useState('')
  const [kindFilter, setKindFilter] = useState<SavedKind | 'all'>('all')
  const toast = useToast()

  function refresh() { setItems(getAllSaves()) }
  useEffect(() => {
    refresh()
    const fn = () => refresh()
    window.addEventListener(SAVES_EVENT, fn)
    return () => window.removeEventListener(SAVES_EVENT, fn)
  }, [])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return items
      .filter(s => kindFilter === 'all' || s.kind === kindFilter)
      .filter(s => !t || s.title.toLowerCase().includes(t) || (s.preview || '').toLowerCase().includes(t))
      .sort((a, b) => {
        if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
        return b.createdAt.localeCompare(a.createdAt)
      })
  }, [items, q, kindFilter])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    items.forEach(s => { c[s.kind] = (c[s.kind] || 0) + 1 })
    return c
  }, [items])

  const usedKinds = Object.keys(KIND_META).filter(k => counts[k]) as SavedKind[]

  function onClearAll() {
    if (!confirm(`Eliminar TODOS os ${items.length} itens guardados? Esta ação é definitiva.`)) return
    clearAll(); toast.info('Guardados limpos')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 900 }}>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>A minha biblioteca</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Guardados</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>Tudo o que guardaste — mnemónicas, explicações, análises, consultas — num só sítio. Fica no teu dispositivo.</p>
        </div>

        {/* Pesquisa + acções */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={`Pesquisar em ${items.length} item${items.length === 1 ? '' : 's'}…`}
            style={{ flex: 1, minWidth: 220, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white' }} />
          {items.length > 0 && (
            <button onClick={onClearAll} style={{ padding: '10px 14px', background: 'white', color: '#94a3b8', border: '1px solid #e5e7eb', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Limpar tudo</button>
          )}
        </div>

        {/* Filtros */}
        {items.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <FilterChip active={kindFilter === 'all'} color="#0b1120" onClick={() => setKindFilter('all')}>Tudo · {counts.all}</FilterChip>
            {usedKinds.map(k => (
              <FilterChip key={k} active={kindFilter === k} color={KIND_META[k].color} onClick={() => setKindFilter(k)}>
                {KIND_META[k].icon} {KIND_META[k].label} · {counts[k]}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Lista */}
        {items.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
            Nenhum resultado para esta pesquisa.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(s => <SavedRow key={s.id} item={s} />)}
          </div>
        )}

        <div style={{ marginTop: 18, fontSize: 11.5, color: '#94a3b8', textAlign: 'center', lineHeight: 1.55 }}>
          Os guardados ficam só neste dispositivo (browser). Para sincronizar entre dispositivos, em breve.
        </div>
      </div>
    </div>
  )
}

function FilterChip({ children, active, color, onClick }: { children: React.ReactNode; active: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '7px 13px', borderRadius: 999, border: `1.5px solid ${active ? color : '#e5e7eb'}`,
        background: active ? color + '14' : 'white', color: active ? color : '#475569',
        fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
      }}>{children}</button>
  )
}

function SavedRow({ item }: { item: SavedItem }) {
  const meta = KIND_META[item.kind]
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: meta.color + '14', color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{meta.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>{meta.label}</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.createdAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          {item.pinned && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>★ Fixo</span>}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0b1120', marginBottom: 3, lineHeight: 1.35, wordBreak: 'break-word' }}>{item.title}</div>
        {item.preview && <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{item.preview}</div>}
        {item.href && (
          <div style={{ marginTop: 7 }}>
            <Link href={item.href} style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', textDecoration: 'none' }}>Abrir na ferramenta →</Link>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
        <button onClick={() => togglePin(item.id)} title={item.pinned ? 'Desafixar' : 'Fixar'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: item.pinned ? '#b45309' : '#cbd5e1', padding: 3 }}>★</button>
        <button onClick={() => { if (confirm('Eliminar?')) remove(item.id) }} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94a3b8', padding: 3 }}>×</button>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: '40px 24px', textAlign: 'center', border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 36, marginBottom: 10 }}>★</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: '#0b1120', fontWeight: 400, marginBottom: 6 }}>Ainda nada guardado</div>
      <p style={{ fontSize: 13.5, color: '#64748b', maxWidth: 380, margin: '0 auto 16px', lineHeight: 1.55 }}>
        Em qualquer ferramenta procura o botão <strong>☆ Guardar</strong>. Aqui voltas a encontrar tudo, organizado.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/explica" style={chipLink}>Explica-me ↗</Link>
        <Link href="/mnemonicas" style={chipLink}>Mnemónicas ↗</Link>
        <Link href="/quickcheck" style={chipLink}>Análise de meds ↗</Link>
      </div>
    </div>
  )
}

const chipLink: React.CSSProperties = { display: 'inline-block', padding: '8px 14px', background: '#f1f5f9', color: '#0b1120', textDecoration: 'none', borderRadius: 999, fontSize: 13, fontWeight: 700 }
