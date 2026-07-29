'use client'

// HandoffNotes — "Passagem de cuidado": quando a responsabilidade de cuidar de
// um familiar muda de mãos por um período (ex: um irmão cobre o outro uma
// semana), o cuidador que sai deixa uma nota estruturada para quem entra — como
// está a pessoa, do que estar atento, mudanças na medicação — e quem assume
// confirma que leu. Distinta da "Ficha para o hospital" (HandoffSheetButton,
// em /familia): aquela é um documento IMPRESSO gerado a partir de dados já
// existentes (medicação + risco + playbook), sem autoria nem persistência;
// esta é escrita por um cuidador PARA o próximo e fica guardada. Componente
// autónomo para ser usado tanto em /perfil/[id] (dono) como em
// /partilhado-comigo (acesso partilhado).

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'

interface HandoffNote {
  id: string; starts_at: string; ends_at?: string | null; summary: string; watch_for?: string | null; med_changes?: string | null
  created_by: string; created_by_name: string; acknowledged_by?: string | null; acknowledged_by_name?: string | null; acknowledged_at?: string | null
  created_at: string
}

const inputStyle: React.CSSProperties = { border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' }
const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'vertical', fontFamily: 'var(--font-sans)' }

function fmtDate(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }

export default function HandoffNotes({ profileId }: { profileId: string }) {
  const { user, supabase } = useAuth() as any
  const [notes, setNotes] = useState<HandoffNote[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ startsAt: new Date().toISOString().slice(0, 10), endsAt: '', summary: '', watchFor: '', medChanges: '' })
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  const authHeader = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const load = useCallback(async () => {
    const res = await fetch(`/api/family-handoff?profile_id=${profileId}`, { headers: await authHeader() })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setNotes(j.items || [])
    setLoaded(true)
  }, [profileId, authHeader])

  useEffect(() => { load() }, [load])

  async function addNote() {
    if (!form.summary.trim()) return
    setAdding(true); setErr('')
    try {
      const res = await fetch('/api/family-handoff', {
        method: 'POST', headers: await authHeader(), body: JSON.stringify({
          profile_id: profileId, starts_at: form.startsAt || undefined, ends_at: form.endsAt || undefined,
          summary: form.summary.trim(), watch_for: form.watchFor.trim() || undefined, med_changes: form.medChanges.trim() || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Erro')
      setForm({ startsAt: new Date().toISOString().slice(0, 10), endsAt: '', summary: '', watchFor: '', medChanges: '' })
      setShowForm(false)
      await load()
    } catch (e: any) { setErr(e.message || 'Não foi possível criar a nota.') }
    setAdding(false)
  }

  async function action(id: string, act: 'acknowledge' | 'unacknowledge') {
    await fetch('/api/family-handoff', { method: 'PATCH', headers: await authHeader(), body: JSON.stringify({ id, action: act }) })
    await load()
  }

  async function remove(id: string) {
    await fetch(`/api/family-handoff?id=${id}`, { method: 'DELETE', headers: await authHeader() })
    await load()
  }

  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 12 }}>
        Quando a responsabilidade de cuidar muda de mãos por um período — uma viagem, uma semana de trabalho — deixa aqui o essencial para quem entra: como está a pessoa, do que estar atento, o que mudou na medicação.
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '12px', background: 'white', border: '2px dashed var(--border)', borderRadius: 10, textAlign: 'center', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', cursor: 'pointer', marginBottom: 12 }}>
          + Deixar uma passagem
        </button>
      ) : (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>Nova passagem</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>A partir de</div>
              <input type="date" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>Até (opcional)</div>
              <input type="date" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
            placeholder="Como está a pessoa, o que se passou nos últimos dias *" rows={3} style={{ ...textareaStyle, marginBottom: 8 }} />
          <textarea value={form.watchFor} onChange={e => setForm(f => ({ ...f, watchFor: e.target.value }))}
            placeholder="Do que estar atento (opcional)" rows={2} style={{ ...textareaStyle, marginBottom: 8 }} />
          <textarea value={form.medChanges} onChange={e => setForm(f => ({ ...f, medChanges: e.target.value }))}
            placeholder="Mudanças na medicação (opcional)" rows={2} style={{ ...textareaStyle, marginBottom: 8 }} />
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addNote} disabled={!form.summary.trim() || adding}
              style={{ flex: 1, padding: '10px 18px', background: form.summary.trim() && !adding ? 'var(--ink)' : 'var(--bg-3)', color: form.summary.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: form.summary.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {adding ? '...' : 'Publicar passagem'}
            </button>
            <button onClick={() => { setShowForm(false); setErr('') }} style={{ padding: '10px 16px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loaded && notes.length === 0 && !showForm && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>
            Sem passagens registadas ainda.
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} style={{ background: 'white', border: `1px solid ${n.acknowledged_by ? 'var(--border)' : '#fde68a'}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                  {fmtDate(n.starts_at)}{n.ends_at ? ` – ${fmtDate(n.ends_at)}` : ''} · por {n.created_by_name}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{n.summary}</div>
                {n.watch_for && (
                  <div style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.5, marginTop: 8, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 7, padding: '8px 10px' }}>
                    <strong>Do que estar atento: </strong>{n.watch_for}
                  </div>
                )}
                {n.med_changes && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, marginTop: 6 }}>
                    <strong>Medicação: </strong>{n.med_changes}
                  </div>
                )}
              </div>
              <button aria-label="Eliminar" onClick={() => remove(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px', flexShrink: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {n.acknowledged_by ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>✓ Assumido por {n.acknowledged_by_name}</span>
              ) : (
                <button onClick={() => action(n.id, 'acknowledge')} style={{ padding: '6px 12px', background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-mid)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Li, fico eu</button>
              )}
              {n.acknowledged_by === user?.id && <button onClick={() => action(n.id, 'unacknowledge')} style={{ padding: '6px 12px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Desfazer</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
