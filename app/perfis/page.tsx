'use client'

// ─── NOVO: app/perfis/page.tsx ───
// Gestão de perfis familiares. Criar, editar, apagar perfis.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import Header from '@/components/Header'
import Link from 'next/link'

interface FamilyProfile {
  id: string
  name: string
  relation?: string
  age?: number
  sex?: string
  weight?: number
  height?: number
  creatinine?: number
  conditions?: string
  allergies?: string
  notes?: string
  created_at: string
}

interface MedCount { profile_id: string }

const PLAN_LIMITS: Record<string, number> = { free: 2, student: 3, pro: Infinity, clinic: Infinity }
const RELATION_OPTIONS = ['Pai', 'Mãe', 'Filho', 'Filha', 'Cônjuge', 'Parceiro/a', 'Avô', 'Avó', 'Irmão', 'Irmã', 'Outro']

const emptyForm = { name: '', relation: '', age: '', sex: '', weight: '', height: '', creatinine: '', conditions: '', allergies: '', notes: '' }

export default function PerfisPage() {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [medsCount, setMedsCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const plan = (user?.plan || 'free') as string
  const limit = PLAN_LIMITS[plan] ?? 2
  const atLimit = isFinite(limit) && profiles.length >= limit

  const load = useCallback(async () => {
    if (!user) return
    const { data: ps } = await supabase.from('family_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    setProfiles(ps || [])
    if ((ps || []).length > 0) {
      const { data: meds } = await supabase.from('family_profile_meds').select('profile_id').eq('user_id', user.id)
      const counts: Record<string, number> = {}
      ;(meds || []).forEach((m: MedCount) => { counts[m.profile_id] = (counts[m.profile_id] || 0) + 1 })
      setMedsCount(counts)
    }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  function openAdd() { setEditId(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(p: FamilyProfile) {
    setEditId(p.id)
    setForm({
      name: p.name, relation: p.relation || '', age: p.age?.toString() || '',
      sex: p.sex || '', weight: p.weight?.toString() || '', height: p.height?.toString() || '',
      creatinine: p.creatinine?.toString() || '', conditions: p.conditions || '',
      allergies: p.allergies || '', notes: p.notes || '',
    })
    setShowForm(true)
  }

  async function save() {
    if (!form.name.trim() || !user) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      relation: form.relation || null,
      age: form.age ? parseInt(form.age) : null,
      sex: form.sex || null,
      weight: form.weight ? parseFloat(form.weight) : null,
      height: form.height ? parseFloat(form.height) : null,
      creatinine: form.creatinine ? parseFloat(form.creatinine) : null,
      conditions: form.conditions || null,
      allergies: form.allergies || null,
      notes: form.notes || null,
    }
    if (editId) {
      const { data } = await supabase.from('family_profiles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId).eq('user_id', user.id).select().single()
      if (data) setProfiles(ps => ps.map(p => p.id === editId ? data : p))
    } else {
      const { data } = await supabase.from('family_profiles').insert({ user_id: user.id, ...payload }).select().single()
      if (data) setProfiles(ps => [...ps, data])
    }
    setShowForm(false)
    setSaving(false)
  }

  async function deleteProfile(id: string) {
    if (!confirm('Apagar este perfil e toda a medicação associada?')) return
    setDeletingId(id)
    await supabase.from('family_profiles').delete().eq('id', id).eq('user_id', user!.id)
    setProfiles(ps => ps.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const inputStyle = { width: '100%', border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none', background: 'white', boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em', marginBottom: 4, display: 'block' as const }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-2)', fontFamily: 'var(--font-sans)' }}>
      <Header />

      <div className="page-container page-body">

        {/* Header da página */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 6 }}>Os Meus Perfis</h1>
            <p style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.5 }}>
              Gere os perfis familiares — medicação, dados clínicos e análises com AI.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>
              {isFinite(limit) ? `${profiles.length}/${limit}` : `${profiles.length} perfis`}
            </span>
            {atLimit ? (
              <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#d97706', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Upgrade para mais →
              </Link>
            ) : (
              <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                Novo perfil
              </button>
            )}
          </div>
        </div>

        {/* Formulário de criar/editar */}
        {showForm && (
          <div style={{ background: 'white', border: '2px solid var(--green)', borderRadius: 12, padding: '24px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--green)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20, fontWeight: 700 }}>
              {editId ? 'Editar perfil' : 'Novo perfil familiar'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nome *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Mãe, João, Avó Maria" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Relação</label>
                <select value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">Seleccionar...</option>
                  {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Idade</label>
                <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value }))} placeholder="Anos" type="number" min="0" max="120" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sexo</label>
                <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))} style={{ ...inputStyle }}>
                  <option value="">Seleccionar...</option>
                  <option value="M">Masculino</option>
                  <option value="F">Feminino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Peso (kg)</label>
                <input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="Ex: 72" type="number" step="0.1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Altura (cm)</label>
                <input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} placeholder="Ex: 165" type="number" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Creatinina (mg/dL)</label>
                <input value={form.creatinine} onChange={e => setForm(f => ({ ...f, creatinine: e.target.value }))} placeholder="Ex: 0.9" type="number" step="0.01" style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Diagnósticos / condições</label>
                <input value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} placeholder="Ex: HTA, DM2, IRC estádio 3" style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Alergias</label>
                <input value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Ex: Penicilina, AINEs" style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observações clínicas relevantes..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={!form.name.trim() || saving} style={{ padding: '10px 22px', background: form.name.trim() && !saving ? 'var(--ink)' : 'var(--bg-3)', color: form.name.trim() && !saving ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: form.name.trim() && !saving ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {saving ? 'A guardar...' : editId ? 'Guardar alterações' : 'Criar perfil'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: '10px 16px', background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de perfis */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 88, borderRadius: 10 }} />)}
          </div>
        ) : profiles.length === 0 ? (
          <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 12, padding: '64px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', fontWeight: 400, marginBottom: 12, letterSpacing: '-0.01em' }}>
              Sem perfis familiares
            </div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 24px' }}>
              Cria um perfil para cada familiar — a medicação, condições e dados clínicos de cada um ficam num só sítio.
            </p>
            <button onClick={openAdd} style={{ padding: '11px 22px', background: 'var(--ink)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Criar primeiro perfil →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {profiles.map(p => {
              const n = medsCount[p.id] || 0
              const deleting = deletingId === p.id
              return (
                <div key={p.id} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {p.relation && <span>{p.relation}</span>}
                      {p.age && <span>{p.age} anos</span>}
                      {p.conditions && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>{p.conditions}</span>}
                    </div>
                  </div>

                  {/* Badge meds */}
                  {n > 0 && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', background: '#e9d5ff', border: '1px solid #d8b4fe', padding: '3px 8px', borderRadius: 4, flexShrink: 0 }}>
                      {n} med.
                    </span>
                  )}

                  {/* Acções */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <Link href={`/ai?profile=${p.id}`} style={{ padding: '7px 12px', background: '#eff6ff', color: '#1d4ed8', textDecoration: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                      AI
                    </Link>
                    <Link href={`/perfil/${p.id}`} style={{ padding: '7px 12px', background: 'var(--bg-2)', color: 'var(--ink)', textDecoration: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                      Ver →
                    </Link>
                    <button onClick={() => openEdit(p)} style={{ padding: '7px 12px', background: 'white', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)' }}>
                      Editar
                    </button>
                    <button onClick={() => deleteProfile(p.id)} disabled={deleting} style={{ padding: '7px 12px', background: 'white', color: deleting ? 'var(--ink-5)' : 'var(--red)', border: `1px solid ${deleting ? 'var(--border)' : '#fecaca'}`, borderRadius: 6, fontSize: 11, cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-mono)' }}>
                      {deleting ? '...' : 'Apagar'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA upgrade se no limite */}
        {atLimit && (
          <div style={{ marginTop: 20, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>
                Limite de {limit} perfis atingido no plano {plan === 'free' ? 'Gratuito' : plan}
              </div>
              <div style={{ fontSize: 12, color: '#92400e' }}>
                Upgrade para Pro e adiciona perfis ilimitados.
              </div>
            </div>
            <Link href="/pricing" style={{ padding: '9px 18px', background: '#d97706', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
              Ver planos →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
