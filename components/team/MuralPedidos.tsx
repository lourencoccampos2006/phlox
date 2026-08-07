'use client'

// Pedidos & observações — agregado de TODOS os utentes, para toda a equipa ver
// num só sítio (2026-08-07: antes só aparecia na ficha de cada utente, um a
// um — a equipa só via o pedido de alguém se abrisse a ficha certa). Quem
// regista continua a ser feito na ficha (é lá que quem está com o utente ouve
// o pedido) — isto é a VISTA partilhada, não um formulário novo. Mesma tabela
// e workflow do components/ResidentRequests.tsx.

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useOrgScope } from '@/lib/orgScope'

interface Req { id: string; patient_id: string; kind: string; content: string; status: string; created_at: string }

const KIND_META: Record<string, { label: string; icon: string; c: string }> = {
  pedido: { label: 'Pedido', icon: '🙋', c: '#1d4ed8' },
  observacao: { label: 'Observação', icon: '👁', c: '#475569' },
  queixa: { label: 'Queixa', icon: '⚠', c: '#b45309' },
}

export default function MuralPedidos() {
  const { user, supabase } = useAuth() as any
  const scope = useOrgScope()
  const [items, setItems] = useState<Req[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showResolved, setShowResolved] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [reqRes, patRes] = await Promise.all([
      scope.filter(supabase.from('resident_requests').select('*')).order('created_at', { ascending: false }).limit(200),
      scope.filter(supabase.from('patients').select('id,name')),
    ])
    if (reqRes.error) {
      if (/does not exist|schema cache/i.test(reqRes.error.message)) setMissing(true)
      setLoading(false); return
    }
    setMissing(false)
    setItems((reqRes.data || []) as Req[])
    const nm: Record<string, string> = {}
    ;(patRes.data || []).forEach((p: any) => { nm[p.id] = p.name })
    setNames(nm)
    setLoading(false)
  }, [user, supabase, scope])

  useEffect(() => { load() }, [load])

  async function setStatus(it: Req, status: string) {
    const patch: any = { status }
    if (status === 'resolvido') patch.resolved_at = new Date().toISOString()
    await supabase.from('resident_requests').update(patch).eq('id', it.id)
    setItems(p => p.map(x => x.id === it.id ? { ...x, status } : x))
  }

  if (missing) return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
      Para ver pedidos e observações aqui, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint98_resident_requests.sql</code> no Supabase.
    </div>
  )

  const shown = items.filter(i => showResolved ? i.status === 'resolvido' : i.status !== 'resolvido')
  const openCount = items.filter(i => i.status !== 'resolvido').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>Pedidos e observações de todos os utentes — regista-se na ficha de cada um, aparece aqui para a equipa toda ver.</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowResolved(false)} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${!showResolved ? '#0d9488' : '#e5e7eb'}`, background: !showResolved ? '#f0fdfa' : 'white', color: !showResolved ? '#0d9488' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Em aberto {openCount > 0 ? `(${openCount})` : ''}</button>
          <button onClick={() => setShowResolved(true)} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${showResolved ? '#0d9488' : '#e5e7eb'}`, background: showResolved ? '#f0fdfa' : 'white', color: showResolved ? '#0d9488' : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Resolvidos</button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 30 }}>A carregar…</div>
      ) : shown.length === 0 ? (
        <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 40 }}>{showResolved ? 'Sem pedidos resolvidos ainda.' : 'Sem pedidos ou observações em aberto.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shown.map(it => {
            const m = KIND_META[it.kind] || KIND_META.pedido
            return (
              <div key={it.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${m.c}`, borderRadius: 10, padding: '10px 13px', opacity: it.status === 'resolvido' ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.c }}>{m.icon} {m.label}{it.status === 'em_curso' ? ' · em curso' : ''}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date(it.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0b1120', marginTop: 4 }}>{names[it.patient_id] || 'Utente'}</div>
                <div style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.5, marginTop: 2 }}>{it.content}</div>
                {it.status !== 'resolvido' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    {it.status === 'aberto' && <button onClick={() => setStatus(it, 'em_curso')} style={{ fontSize: 12, fontWeight: 600, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Marcar em curso</button>}
                    <button onClick={() => setStatus(it, 'resolvido')} style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Resolver ✓</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
