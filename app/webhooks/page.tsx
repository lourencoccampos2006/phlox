'use client'

// Webhooks de saída — o Phlox dispara eventos (venda, documento, stock baixo…) para um
// URL configurável, assinados com HMAC-SHA256. Para ligar a Zapier, Make, n8n ou o ERP
// próprio da instituição. Inclui teste e histórico de entregas.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { WEBHOOK_EVENTS, randomSecret } from '@/lib/webhooks'

interface Endpoint { id: string; url: string; secret: string; events: string[]; active: boolean; description?: string | null; last_status?: number | null; last_at?: string | null }
interface Delivery { id: string; endpoint_id: string; event: string; at: string; status: number; ok: boolean; response?: string | null }

const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }
const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 18 }

export default function WebhooksPage() {
  const { user, supabase } = useAuth() as any
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const blank = { url: '', description: '', events: ['sale.created'] as string[], secret: randomSecret() }
  const [form, setForm] = useState<any>(blank)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [e, d] = await Promise.all([
      supabase.from('webhook_endpoints').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('webhook_deliveries').select('*').eq('user_id', user.id).order('at', { ascending: false }).limit(20),
    ])
    if (e.error) { if (/relation .*webhook_endpoints.* does not exist/i.test(e.error.message)) setMissing(true); setEndpoints([]) }
    else { setMissing(false); setEndpoints(e.data || []) }
    setDeliveries(d.error ? [] : d.data || [])
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  function toggleEvent(ev: string) {
    setForm((f: any) => ({ ...f, events: f.events.includes(ev) ? f.events.filter((x: string) => x !== ev) : [...f.events, ev] }))
  }
  async function create() {
    if (!form.url.trim() || !/^https?:\/\//.test(form.url.trim())) { setMsg('Indica um URL válido (https://…).'); return }
    if (form.events.length === 0) { setMsg('Escolhe pelo menos um evento.'); return }
    setSaving(true); setMsg('')
    const { data, error } = await supabase.from('webhook_endpoints').insert({
      user_id: user.id, url: form.url.trim(), secret: form.secret, events: form.events, description: form.description.trim() || null, active: true,
    }).select().single()
    if (!error && data) { setEndpoints(p => [data, ...p]); setShowForm(false); setForm({ ...blank, secret: randomSecret() }) }
    else setMsg(error?.message || 'Erro')
    setSaving(false)
  }
  async function toggleActive(ep: Endpoint) {
    await supabase.from('webhook_endpoints').update({ active: !ep.active }).eq('id', ep.id)
    setEndpoints(p => p.map(x => x.id === ep.id ? { ...x, active: !ep.active } : x))
  }
  async function del(id: string) {
    await supabase.from('webhook_endpoints').delete().eq('id', id)
    setEndpoints(p => p.filter(x => x.id !== id))
  }
  async function test(ep: Endpoint) {
    setMsg('A testar…')
    const token = (await supabase.auth.getSession()).data.session?.access_token
    const r = await fetch('/api/webhooks/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ test: true, endpointId: ep.id }) })
    const j = await r.json().catch(() => ({}))
    setMsg(j?.results?.[0]?.ok ? `Teste OK (HTTP ${j.results[0].status})` : `Teste falhou${j?.results?.[0] ? ` (HTTP ${j.results[0].status})` : ''}`)
    setTimeout(() => { setMsg(''); load() }, 2500)
  }

  const evLabel = (id: string) => WEBHOOK_EVENTS.find(e => e.id === id)?.label || id

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 860 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Integrações</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Webhooks de saída</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Liga o Phlox a tudo: Zapier, Make, n8n ou o teu ERP. Cada evento é enviado por POST e assinado (HMAC-SHA256 no cabeçalho <code>X-Phlox-Signature</code>).</p>
          </div>
          {!missing && <button onClick={() => { setForm({ ...blank, secret: randomSecret() }); setMsg(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Webhook</button>}
        </div>

        {msg && <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: msg.includes('falh') || msg.includes('válido') || msg.includes('Escolhe') ? '#dc2626' : '#16a34a' }}>{msg}</div>}

        {missing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24, color: '#92400e', fontSize: 13.5 }}>
            Corre <strong>supabase/sprint36_webhooks.sql</strong> no Supabase para ativar os webhooks.
          </div>
        ) : loading ? (
          <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
        ) : (
          <>
            {endpoints.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: 36 }}>Sem webhooks. Cria o primeiro com “+ Webhook”.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {endpoints.map(ep => (
                  <div key={ep.id} style={{ ...card, padding: '14px 16px', opacity: ep.active ? 1 : 0.6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', wordBreak: 'break-all' }}>{ep.url}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                          {ep.events.map(e => <span key={e} style={{ fontSize: 10.5, fontWeight: 600, color: '#0d6e42', background: '#eef6f1', padding: '2px 7px', borderRadius: 5 }}>{evLabel(e)}</span>)}
                        </div>
                        {ep.last_at && <div style={{ fontSize: 11, color: ep.last_status && ep.last_status >= 200 && ep.last_status < 300 ? '#16a34a' : '#dc2626', marginTop: 6 }}>Última entrega: HTTP {ep.last_status} · {new Date(ep.last_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'flex-start' }}>
                        <button onClick={() => test(ep)} style={{ padding: '6px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'white', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Testar</button>
                        <button onClick={() => toggleActive(ep)} style={{ padding: '6px 11px', borderRadius: 7, border: `1px solid ${ep.active ? '#bbf7d0' : 'var(--border)'}`, background: ep.active ? '#f0fdf4' : 'white', color: ep.active ? '#16a34a' : 'var(--ink-4)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{ep.active ? 'Ativo' : 'Inativo'}</button>
                        <button onClick={() => del(ep.id)} style={{ fontSize: 16, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>secret: {ep.secret.slice(0, 12)}…</div>
                  </div>
                ))}
              </div>
            )}

            {deliveries.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>Entregas recentes</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {deliveries.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: 9, fontSize: 12.5 }}>
                      <span style={{ color: 'var(--ink-2)' }}><span style={{ fontWeight: 700, color: d.ok ? '#16a34a' : '#dc2626' }}>{d.ok ? '✓' : '✗'} {d.status || 'erro'}</span> · {evLabel(d.event)}</span>
                      <span style={{ color: '#9ca3af' }}>{new Date(d.at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ ...card, marginTop: 22, fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              <strong>Como verificar a assinatura:</strong> o corpo é enviado como JSON. Calcula <code>HMAC-SHA256(secret, body)</code> e compara com o cabeçalho <code>X-Phlox-Signature</code> (hex). O <code>X-Phlox-Timestamp</code> evita reenvios.
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div onMouseDown={ev => { if (ev.target === ev.currentTarget) setShowForm(false) }} style={{ position: 'fixed', inset: 0, zIndex: 1900, background: 'rgba(8,12,24,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Novo webhook</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><span style={lbl}>URL de destino</span><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://hooks.zapier.com/…" style={inp} autoFocus /></div>
              <div><span style={lbl}>Descrição (opcional)</span><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Sincronizar com o ERP" style={inp} /></div>
              <div>
                <span style={lbl}>Eventos</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {WEBHOOK_EVENTS.map(ev => (
                    <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 8, border: `1.5px solid ${form.events.includes(ev.id) ? '#0d6e42' : 'var(--border)'}`, background: form.events.includes(ev.id) ? '#eef6f1' : 'white', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.events.includes(ev.id)} onChange={() => toggleEvent(ev.id)} />
                      <span><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{ev.label}</span><span style={{ display: 'block', fontSize: 11, color: 'var(--ink-5)' }}>{ev.desc}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div><span style={lbl}>Segredo de assinatura</span><input value={form.secret} readOnly style={{ ...inp, fontFamily: 'var(--font-mono)', fontSize: 12, background: 'var(--bg-2)' }} /></div>
              <button onClick={create} disabled={saving} style={{ padding: 12, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A criar…' : 'Criar webhook'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
