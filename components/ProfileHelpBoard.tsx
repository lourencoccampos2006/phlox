'use client'

// ProfileHelpBoard — quadro "Preciso de ajuda" (pesquisa competitiva 2026-07-27,
// Lotsa Helping Hands). Extraído de app/perfil/[id]/page.tsx para um componente
// autónomo (auto-busca os seus próprios dados a partir de profileId) para poder
// ser usado tanto em /perfil/[id] (o dono do perfil) como em /partilhado-comigo
// (quem tem acesso partilhado, family_profile_shares) — sem isto, só o DONO
// conseguia publicar/reclamar tarefas, porque /perfil/[id] só carrega para quem
// é dono (RLS de family_profiles). A API (/api/family-help) já validava acesso
// partilhado corretamente; faltava o caminho de UI para o usar.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

const inputStyle: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' }

export default function ProfileHelpBoard({ profileId }: { profileId: string }) {
  const { user, supabase } = useAuth() as any
  const [items, setItems] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const [newHelp, setNewHelp] = useState({ title: '', note: '', needed_by: '' })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const res = await fetch(`/api/family-help?profile_id=${profileId}`, { headers: await authHeader() })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setItems(j.items || [])
    setLoaded(true)
  }, [profileId, authHeader])

  useEffect(() => { load() }, [load])

  async function addHelp() {
    if (!newHelp.title.trim()) return
    setAdding(true); setErr('')
    try {
      const res = await fetch('/api/family-help', { method: 'POST', headers: await authHeader(), body: JSON.stringify({ profile_id: profileId, title: newHelp.title.trim(), note: newHelp.note.trim() || undefined, needed_by: newHelp.needed_by || undefined }) })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setNewHelp({ title: '', note: '', needed_by: '' })
      await load()
    } catch (e: any) { setErr(e.message || 'Não foi possível criar o pedido.') }
    setAdding(false)
  }

  async function action(id: string, act: 'claim' | 'unclaim' | 'done' | 'reopen') {
    await fetch('/api/family-help', { method: 'PATCH', headers: await authHeader(), body: JSON.stringify({ id, action: act }) })
    await load()
  }

  async function remove(id: string) {
    await fetch(`/api/family-help?id=${id}`, { method: 'DELETE', headers: await authHeader() })
    await load()
  }

  return (
    <div>
      <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Publicar um pedido</div>
        <input value={newHelp.title} onChange={e => setNewHelp(f => ({ ...f, title: e.target.value }))}
          placeholder="Ex: Ida ao médico dia 5" style={{ ...inputStyle, marginBottom: 8 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 8, marginBottom: 8 }}>
          <input value={newHelp.note} onChange={e => setNewHelp(f => ({ ...f, note: e.target.value }))}
            placeholder="Detalhe (opcional)" style={inputStyle} />
          <input type="date" value={newHelp.needed_by} onChange={e => setNewHelp(f => ({ ...f, needed_by: e.target.value }))} style={inputStyle} />
        </div>
        {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
        <button onClick={addHelp} disabled={!newHelp.title.trim() || adding}
          style={{ width: '100%', padding: '10px 18px', background: newHelp.title.trim() && !adding ? 'var(--ink)' : 'var(--bg-3)', color: newHelp.title.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: newHelp.title.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {adding ? '...' : 'Publicar'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loaded && items.length === 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
            Sem pedidos. Quem tiver acesso partilhado a este perfil também pode reclamar tarefas.
          </div>
        )}
        {items.map(h => (
          <div key={h.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px', opacity: h.status === 'done' ? 0.55 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textDecoration: h.status === 'done' ? 'line-through' : 'none' }}>{h.title}</div>
                {h.note && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 3 }}>{h.note}</div>}
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
                  {h.needed_by ? `Até ${new Date(h.needed_by + 'T12:00:00').toLocaleDateString('pt-PT')} · ` : ''}
                  publicado por {h.created_by_name}
                  {h.claimed_by_name ? ` · reclamado por ${h.claimed_by_name}` : ''}
                </div>
              </div>
              <button aria-label="Eliminar" onClick={() => remove(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {h.status === 'open' && <button onClick={() => action(h.id, 'claim')} style={{ padding: '6px 12px', background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-mid)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Eu trato disto</button>}
              {h.status === 'claimed' && h.claimed_by === user?.id && <button onClick={() => action(h.id, 'unclaim')} style={{ padding: '6px 12px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Largar</button>}
              {h.status === 'claimed' && <button onClick={() => action(h.id, 'done')} style={{ padding: '6px 12px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Marcar feito</button>}
              {h.status === 'done' && <button onClick={() => action(h.id, 'reopen')} style={{ padding: '6px 12px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reabrir</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
