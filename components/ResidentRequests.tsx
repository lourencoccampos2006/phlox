'use client'

// ResidentRequests — pedidos & observações do utente (o que pede/diz), visível a
// toda a equipa. Vive na ficha do utente (/patients/[id]), onde faz sentido
// registar — quem está com o utente é quem ouve o pedido. Self-contained: carrega
// e insere por conta própria, org-scoped. Degrada com elegância se a tabela
// faltar (sprint98). Os pedidos EM ABERTO também aparecem no /radar (Ronda 9,
// lib/careSignals) — o sítio onde a equipa já vê "o que merece atenção hoje",
// sem ter de abrir perfil a perfil.

import { useEffect, useState, useCallback } from 'react'

interface Req { id: string; kind: string; content: string; status: string; created_at: string; recorded_by_id?: string }

const KIND_META: Record<string, { label: string; icon: string; c: string }> = {
  pedido: { label: 'Pedido', icon: '🙋', c: '#1d4ed8' },
  observacao: { label: 'Observação', icon: '👁', c: '#475569' },
  queixa: { label: 'Queixa', icon: '⚠', c: '#b45309' },
}

export default function ResidentRequests({ patientId, supabase, scope, accent = '#0d9488' }: { patientId: string; supabase: any; scope: any; accent?: string }) {
  const [items, setItems] = useState<Req[]>([])
  const [missing, setMissing] = useState(false)
  const [kind, setKind] = useState('pedido')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await scope.filter(supabase.from('resident_requests').select('*')).eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50)
    if (error) { if (/does not exist|schema cache/i.test(error.message)) setMissing(true); return }
    setMissing(false); setItems(data || [])
  }, [patientId, supabase, scope])

  useEffect(() => { load() }, [load])

  async function add() {
    if (!text.trim()) return
    setSaving(true)
    const { data, error } = await supabase.from('resident_requests').insert(scope.stamp({ patient_id: patientId, kind, content: text.trim() })).select().single()
    setSaving(false)
    if (!error && data) { setItems(p => [data, ...p]); setText('') }
    else if (error && /does not exist|schema cache/i.test(error.message)) setMissing(true)
  }

  async function setStatus(it: Req, status: string) {
    const patch: any = { status }
    if (status === 'resolvido') patch.resolved_at = new Date().toISOString()
    await supabase.from('resident_requests').update(patch).eq('id', it.id)
    setItems(p => p.map(x => x.id === it.id ? { ...x, status } : x))
  }

  if (missing) return (
    <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
      Para registar pedidos e observações do utente, aplique <code style={{ background: '#fef3c7', padding: '1px 5px', borderRadius: 4 }}>sprint98_resident_requests.sql</code> no Supabase.
    </div>
  )

  const open = items.filter(i => i.status !== 'resolvido')

  return (
    <div>
      {/* Registar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(KIND_META).map(([k, m]) => (
          <button key={k} onClick={() => setKind(k)} style={{ padding: '6px 12px', borderRadius: 20, border: `1.5px solid ${kind === k ? m.c : '#e5e7eb'}`, background: kind === k ? m.c + '12' : 'white', color: kind === k ? m.c : '#64748b', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{m.icon} {m.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="O que o utente pediu ou disse…" style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, outline: 'none' }} />
        <button onClick={add} disabled={saving || !text.trim()} style={{ padding: '10px 16px', background: saving || !text.trim() ? '#e2e8f0' : accent, color: saving || !text.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: saving || !text.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>Registar</button>
      </div>

      {/* Lista */}
      {open.length === 0 ? (
        <div style={{ fontSize: 13, color: '#94a3b8' }}>Sem pedidos ou observações em aberto.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {open.map(it => {
            const m = KIND_META[it.kind] || KIND_META.pedido
            return (
              <div key={it.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `3px solid ${m.c}`, borderRadius: 10, padding: '10px 13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.c }}>{m.icon} {m.label}{it.status === 'em_curso' ? ' · em curso' : ''}</span>
                  <span style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{new Date(it.created_at).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: 13.5, color: '#0b1120', lineHeight: 1.5, marginTop: 3 }}>{it.content}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {it.status === 'aberto' && <button onClick={() => setStatus(it, 'em_curso')} style={{ fontSize: 12, fontWeight: 600, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Marcar em curso</button>}
                  <button onClick={() => setStatus(it, 'resolvido')} style={{ fontSize: 12, fontWeight: 600, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Resolver ✓</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
