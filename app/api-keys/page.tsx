'use client'

// Phlox · Chaves de API (Institucional). Cria chaves rotáveis com scopes, vê o uso
// e revoga em qualquer momento. O segredo é mostrado UMA SÓ VEZ.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { newApiKey, ALL_SCOPES, type Scope } from '@/lib/apiKey'

interface Key { id: string; name: string; prefix: string; scopes: string[]; active: boolean; last_used_at?: string | null; expires_at?: string | null; created_at: string }

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }

export default function ApiKeysPage() {
  const { user, supabase } = useAuth() as any
  const [keys, setKeys] = useState<Key[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['sales:read'])
  const [creating, setCreating] = useState(false)
  const [secretJustCreated, setSecretJustCreated] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase.from('api_keys').select('id,name,prefix,scopes,active,last_used_at,expires_at,created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    if (error) { if (/relation .*api_keys.* does not exist/i.test(error.message)) setMissing(true); setKeys([]) }
    else { setMissing(false); setKeys(data || []) }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  function toggleScope(s: string) {
    setScopes(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  }

  async function create() {
    if (!name.trim()) { setErr('Indica um nome.'); return }
    if (scopes.length === 0) { setErr('Escolhe pelo menos um scope.'); return }
    setCreating(true); setErr('')
    try {
      const k = await newApiKey()
      const { data, error } = await supabase.from('api_keys').insert({
        user_id: user.id, name: name.trim(), prefix: k.prefix, hash: k.hash, scopes, active: true,
      }).select().single()
      if (error) throw new Error(error.message)
      setKeys(p => [data, ...p])
      setSecretJustCreated(k.secret)
      setName(''); setScopes(['sales:read']); setShowForm(false)
    } catch (e: any) { setErr(e.message || 'Erro') }
    setCreating(false)
  }

  async function revoke(id: string) {
    if (!confirm('Revogar esta chave? Pedidos imediatamente passam a falhar.')) return
    await supabase.from('api_keys').update({ active: false }).eq('id', id)
    setKeys(p => p.map(k => k.id === id ? { ...k, active: false } : k))
  }
  async function del(id: string) {
    if (!confirm('Eliminar permanentemente? Não há retrocesso.')) return
    await supabase.from('api_keys').delete().eq('id', id)
    setKeys(p => p.filter(k => k.id !== id))
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Phlox · API (Institucional)</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,3vw,34px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Chaves de API</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-4)', margin: '5px 0 0', lineHeight: 1.6 }}>Liga o teu ERP, BI ou app móvel ao Phlox. Chaves rotáveis, com scopes e rate limit por chave.</p>
          </div>
          {!missing && <button onClick={() => { setName(''); setScopes(['sales:read']); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Nova chave</button>}
        </div>

        {secretJustCreated && (
          <div style={{ ...card, marginBottom: 14, borderColor: '#fde68a', background: '#fffbeb' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Copia agora — só verás esta chave uma vez</div>
            <div style={{ background: 'var(--bg-2)', padding: '12px 14px', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13, color: '#0b1120', wordBreak: 'break-all' }}>{secretJustCreated}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(secretJustCreated) }} style={{ padding: '7px 12px', background: '#92400e', color: 'white', border: 'none', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Copiar</button>
              <button onClick={() => setSecretJustCreated(null)} style={{ padding: '7px 12px', background: 'white', color: '#92400e', border: '1px solid #fde68a', borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Já copiei</button>
            </div>
          </div>
        )}

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5 }}>
            Esta funcionalidade está temporariamente indisponível. Tenta novamente daqui a pouco.
          </div>
        ) : loading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
        ) : keys.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: 36 }}>Sem chaves. Cria a primeira em “+ Nova chave”.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keys.map(k => (
              <div key={k.id} style={{ ...card, padding: '14px 16px', opacity: k.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{k.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)', marginTop: 3 }}>{k.prefix}<span style={{ color: '#cbd5e1' }}>.•••••••••••••••</span></div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                      {k.scopes.map(s => <span key={s} style={{ fontSize: 10.5, fontWeight: 600, color: '#0d6e42', background: '#eef6f1', padding: '2px 7px', borderRadius: 5 }}>{s}</span>)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', marginTop: 6 }}>{k.last_used_at ? `Usada ${new Date(k.last_used_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}` : 'Nunca usada'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                    {k.active ? <button onClick={() => revoke(k.id)} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Revogar</button>
                              : <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>Revogada</span>}
                    <button onClick={() => del(k.id)} style={{ fontSize: 16, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...card, marginTop: 22, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>Como usar</div>
          Adiciona o cabeçalho <code>Authorization: Bearer pk_live_…</code> aos pedidos. Endpoints públicos disponíveis:
          <ul style={{ margin: '8px 0 0 18px' }}>
            <li><code>GET /api/v1/sales?from=YYYY-MM-DD&amp;to=YYYY-MM-DD</code> · scope <code>sales:read</code></li>
            <li><code>POST /api/v1/sales</code> · scope <code>sales:write</code></li>
          </ul>
          Rate limit: 60 pedidos por minuto e por chave. Mais detalhes em <Link href="/api-docs" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>/api-docs</Link>.
        </div>

        {err && <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>{err}</div>}
      </div>

      {showForm && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Nova chave</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>Nome</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Importador ERP, BI nocturno…" style={inp} autoFocus /></div>
              <div>
                <span style={lbl}>Scopes</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {ALL_SCOPES.map(s => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${scopes.includes(s) ? '#0d6e42' : 'var(--border)'}`, background: scopes.includes(s) ? '#eef6f1' : 'white', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-2)' }}>
                      <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <button onClick={create} disabled={creating} style={{ padding: 12, background: creating ? 'var(--bg-3)' : '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: creating ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{creating ? 'A criar…' : 'Criar chave'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
