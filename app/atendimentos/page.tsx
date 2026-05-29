'use client'

// Atendimentos avulsos — para instituições sem doentes fixos (farmácia, balcão, CS de passagem).
// Registo rápido sem criar doente; estatística do dia/mês; promover a ficha se recorrente.

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthContext'
import { useLiveData } from '@/lib/useLiveData'

interface Enc {
  id: string; at: string; person_name?: string | null; age?: number | null; patient_id?: string | null
  type: string; reason?: string | null; action?: string | null; outcome?: string | null; follow_up?: string | null
  professional?: string | null; source: string
}

const TYPES: Record<string, { label: string; color: string }> = {
  atendimento: { label: 'Atendimento', color: '#2563eb' },
  indicacao: { label: 'Indicação', color: '#0891b2' },
  rastreio: { label: 'Rastreio', color: '#16a34a' },
  vacina: { label: 'Vacina', color: '#7c3aed' },
  consulta: { label: 'Consulta', color: '#dc2626' },
  transporte: { label: 'Transporte', color: '#d97706' },
  outro: { label: 'Outro', color: '#64748b' },
}
const TYPE_KEYS = Object.keys(TYPES)
const inp: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none', boxSizing: 'border-box', background: 'white' }
const lbl: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5, display: 'block' }

export default function AtendimentosPage() {
  const { user, supabase } = useAuth() as any
  const router = useRouter()
  const [encs, setEncs] = useState<Enc[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [err, setErr] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const blank = { person_name: '', age: '', type: 'atendimento', reason: '', action: '', outcome: '', follow_up: '', professional: '' }
  const [form, setForm] = useState<any>(blank)

  const auth = useCallback(async () => (await supabase.auth.getSession()).data.session?.access_token, [supabase])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const t = await auth()
    const res = await fetch('/api/atendimentos?days=60', { headers: { Authorization: `Bearer ${t}` } })
    const d = await res.json()
    if (!res.ok) { if (res.status === 503) setTableMissing(true); setErr(d.error || ''); setEncs([]) }
    else { setTableMissing(false); setEncs(d.encounters || []) }
    setLoading(false)
  }, [user, auth])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, table: 'encounters', userId: user?.id, onChange: load })

  async function save() {
    if (!form.reason.trim() && !form.action.trim()) { setErr('Indica pelo menos o motivo ou o que foi feito.'); return }
    setSaving(true); setErr('')
    const t = await auth()
    const res = await fetch('/api/atendimentos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify(form) })
    const d = await res.json()
    if (res.ok && d.encounter) { setEncs(p => [d.encounter, ...p]); setShowForm(false); setForm(blank) }
    else setErr(d.error || 'Erro')
    setSaving(false)
  }
  async function promote(e: Enc) {
    const t = await auth()
    const res = await fetch('/api/atendimentos', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ promote: e.id }) })
    const d = await res.json()
    if (res.ok && d.patient) router.push(`/patients/${d.patient.id}`)
  }
  async function del(id: string) {
    const t = await auth()
    await fetch('/api/atendimentos', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ id }) })
    setEncs(p => p.filter(x => x.id !== id))
  }

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const todayCount = encs.filter(e => e.at.slice(0, 10) === today).length
  const monthCount = encs.filter(e => e.at.slice(0, 7) === month).length
  const followUps = encs.filter(e => e.follow_up && e.at.slice(0, 7) === month).length

  const card: React.CSSProperties = { background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 880 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Atendimentos</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px,3vw,30px)', color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0 }}>Registo de Atendimentos</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: '5px 0 0' }}>Regista quem atendeste — sem teres de criar um doente. Promove a ficha se a pessoa for recorrente.</p>
          </div>
          <button onClick={() => { setForm(blank); setErr(''); setShowForm(true) }} style={{ padding: '10px 16px', background: '#0d6e42', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>+ Atendimento</button>
        </div>

        {tableMissing ? (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#92400e', marginBottom: 6 }}>Atendimentos por configurar</div>
            <div style={{ fontSize: 13, color: '#92400e' }}>Corre <strong>supabase/sprint31_atendimentos.sql</strong> no Supabase para ativar.</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { n: todayCount, l: 'Hoje', c: '#2563eb', bg: '#eff6ff', bd: '#bfdbfe' },
                { n: monthCount, l: 'Este mês', c: '#0d6e42', bg: '#f0fdf4', bd: '#bbf7d0' },
                { n: followUps, l: 'Com seguimento', c: '#d97706', bg: '#fffbeb', bd: '#fde68a' },
              ].map(s => (
                <div key={s.l} style={{ flex: '1 1 130px', background: s.bg, border: `1.5px solid ${s.bd}`, borderRadius: 12, padding: '13px 16px' }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: s.c, lineHeight: 1 }}>{loading ? '—' : s.n}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
            {err && !tableMissing && <div style={{ ...card, marginBottom: 12, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b', fontSize: 13 }}>{err}</div>}

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />)}</div>
            ) : encs.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>Sem atendimentos. Regista o primeiro com “+ Atendimento”.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {encs.map(e => {
                  const ty = TYPES[e.type] || TYPES.outro
                  return (
                    <div key={e.id} style={{ ...card, padding: '12px 16px', borderLeft: `3px solid ${ty.color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: ty.color, background: ty.color + '14', padding: '2px 8px', borderRadius: 5 }}>{ty.label}</span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{e.person_name || 'Anónimo'}{e.age ? `, ${e.age}a` : ''}</span>
                            {e.source === 'healthpass' && <span style={{ fontSize: 10, color: '#16a34a' }}>via QR</span>}
                          </div>
                          {e.reason && <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>{e.reason}</div>}
                          {e.action && <div style={{ fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>{e.action}</div>}
                          {e.follow_up && <div style={{ fontSize: 12, color: '#b45309', marginTop: 3 }}>🔁 {e.follow_up}</div>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-5)' }}>{new Date(e.at).toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                            {!e.patient_id ? (
                              <button onClick={() => promote(e)} title="Criar ficha de doente a partir deste atendimento" style={{ fontSize: 11.5, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '3px 9px', cursor: 'pointer' }}>+ Ficha</button>
                            ) : <span style={{ fontSize: 11, color: '#16a34a' }}>ficha criada</span>}
                            <button onClick={() => del(e.id)} style={{ fontSize: 14, color: 'var(--ink-5)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                          </div>
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
          <div style={{ background: 'white', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 500, maxHeight: '92vh', overflowY: 'auto', padding: '20px 22px 34px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', fontWeight: 400, margin: 0 }}>Novo atendimento</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--ink-4)' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div>
                <span style={lbl}>Tipo</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {TYPE_KEYS.map(k => <button key={k} onClick={() => setForm({ ...form, type: k })} style={{ padding: '6px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${form.type === k ? TYPES[k].color : 'var(--border)'}`, background: form.type === k ? TYPES[k].color + '12' : 'white', color: form.type === k ? TYPES[k].color : 'var(--ink-4)', fontFamily: 'var(--font-sans)' }}>{TYPES[k].label}</button>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Nome (opcional)</span><input value={form.person_name} onChange={e => setForm({ ...form, person_name: e.target.value })} placeholder="Anónimo" style={inp} /></div>
                <div><span style={lbl}>Idade</span><input type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} style={inp} /></div>
              </div>
              <div><span style={lbl}>Motivo</span><input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Ex: dor de garganta, pedido de medição de TA…" style={inp} /></div>
              <div><span style={lbl}>O que foi feito / aconselhado</span><textarea value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} rows={2} placeholder="Ex: indicado paracetamol 1g, encaminhado para médico…" style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><span style={lbl}>Seguimento</span><input value={form.follow_up} onChange={e => setForm({ ...form, follow_up: e.target.value })} placeholder="Ex: voltar se persistir 3d" style={inp} /></div>
                <div><span style={lbl}>Atendido por</span><input value={form.professional} onChange={e => setForm({ ...form, professional: e.target.value })} style={inp} /></div>
              </div>
              <button onClick={save} disabled={saving} style={{ padding: 12, background: '#0d6e42', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: 4 }}>{saving ? 'A guardar…' : 'Guardar atendimento'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
