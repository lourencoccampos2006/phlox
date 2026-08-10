'use client'

// /familia — CENTRO DE CUIDADO.
// REESCRITA 2026-08-09 (pedido do Fernando: "está muito confuso, cheio de
// widgets, cheio de avisos"): a página tinha, por defeito, até 5 cartões Pro
// empilhados (Índice de Risco, Playbook de Crise, Sobrecarga, Partilha) por
// CADA familiar, sempre abertos — ficam agora atrás de um "Mais ferramentas"
// fechado por omissão. /portal-familia foi extinta: ligar um familiar
// institucional (código + telefone) passa a ser uma ação DENTRO do próprio
// cartão aqui — a ligação fica guardada no servidor (family_institution_links,
// via /api/family-link), não numa sessão de dispositivo em localStorage. Uma
// vez ligado, o cartão mostra o diário/medicação/conversa/visitas do lar
// diretamente — não só mensagens (components/LinkedResidentPanel.tsx).
// Motor de vigilância (lib/caregiverWatch — 26 regras clínicas + tendências
// reais) mantido tal e qual, só a apresentação mudou.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { setActiveProfile } from '@/lib/profileContext'
import { analyzeFamilyMember, WATCH_LEVEL_META, type WatchResult } from '@/lib/caregiverWatch'
import LinkedResidentPanel, { type FamilyLink } from '@/components/LinkedResidentPanel'
import RiskIndexCard from '@/components/RiskIndexCard'
import CrisisPlaybookCard from '@/components/CrisisPlaybookCard'
import ZaritBurdenCard from '@/components/ZaritBurdenCard'
import HandoffSheetButton from '@/components/HandoffSheetButton'
import ShareInviteButton from '@/components/ShareInviteButton'
import PushNudge from '@/components/PushNudge'
import Link from 'next/link'

interface Profile { id: string; name: string; relation?: string; age?: number | null; sex?: string | null; weight?: number | null; height?: number | null; creatinine?: number | null; conditions?: string | null; allergies?: string | null; notes?: string | null }
interface Med { id: string; profile_id: string; name: string; dose?: string; pills_remaining?: number | null; pills_per_day?: number | null }
interface Vital { profile_id: string | null; recorded_at: string; bp_sys?: number | null; bp_dia?: number | null; hr?: number | null; spo2?: number | null; weight?: number | null; glucose?: number | null; temp?: number | null }
interface Sym { profile_id: string | null; at: string; pain?: number | null; temperature?: number | null; symptoms?: string[] | null }

const ACCENT = '#b45309'
const RELATION_OPTIONS = ['Pai', 'Mãe', 'Filho', 'Filha', 'Cônjuge', 'Parceiro/a', 'Avô', 'Avó', 'Irmão', 'Irmã', 'Outro']
const emptyForm = { name: '', relation: '', age: '', sex: '', weight: '', height: '', creatinine: '', conditions: '', allergies: '', notes: '' }
const initials = (n: string) => n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase()
const NAME_KEY = 'phlox-familia-name'
const SEV: Record<string, { c: string; b: string; bd: string }> = {
  critical: { c: '#991b1b', b: '#fee2e2', bd: '#fca5a5' },
  major: { c: '#b91c1c', b: '#fef2f2', bd: '#fca5a5' },
  moderate: { c: '#b45309', b: '#fffbeb', bd: '#fde68a' },
  minor: { c: '#1d4ed8', b: '#eff6ff', bd: '#bfdbfe' },
  info: { c: '#64748b', b: '#f1f5f9', bd: '#e2e8f0' },
}

function act(accent: string, solid = false): React.CSSProperties {
  return solid
    ? { padding: '8px 14px', background: accent, color: 'white', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }
    : { padding: '8px 14px', background: 'white', color: accent, border: `1.5px solid ${accent}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }
}

export default function FamiliaPage() {
  const { user, supabase } = useAuth() as any
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [syms, setSyms] = useState<Sym[]>([])
  const [links, setLinks] = useState<Record<string, FamilyLink>>({})
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [moreOpen, setMoreOpen] = useState<Set<string>>(new Set())
  const [linkingFor, setLinkingFor] = useState<string | null>(null)
  const [myName, setMyName] = useState('')

  useEffect(() => { try { setMyName(localStorage.getItem(NAME_KEY) || '') } catch {} }, [])
  function setMyNamePersist(n: string) { setMyName(n); try { localStorage.setItem(NAME_KEY, n) } catch {} }

  // Saúde da família é valor PRO: Base/Plus = 1 familiar; Pro/Institucional ilimitado.
  const familyLimit = (user?.plan === 'pro' || user?.plan === 'clinic') ? Infinity : 1
  const isPro = user?.plan === 'pro' || user?.plan === 'clinic'

  function openAdd() { setEditId(null); setForm(emptyForm); setAdding(true) }
  function openEdit(p: Profile) {
    setEditId(p.id)
    setForm({
      name: p.name, relation: p.relation || '', age: p.age?.toString() || '',
      sex: p.sex || '', weight: p.weight?.toString() || '', height: p.height?.toString() || '',
      creatinine: p.creatinine?.toString() || '', conditions: p.conditions || '',
      allergies: p.allergies || '', notes: p.notes || '',
    })
    setAdding(true)
  }

  async function saveProfile() {
    if (!form.name.trim() || !user?.id) return
    if (!editId && profiles.length >= familyLimit) {
      alert('No plano gratuito e Plus pode acompanhar 1 familiar. Com o Pro, acompanha os familiares que quiser. Veja em /pricing.')
      return
    }
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
      const { data, error } = await supabase.from('family_profiles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId).eq('user_id', user.id).select().single()
      setSaving(false)
      if (!error && data) { setProfiles(ps => ps.map(p => p.id === editId ? data : p)); setAdding(false); setEditId(null); setForm(emptyForm) }
      else if (error) alert(`Não foi possível guardar: ${error.message}`)
    } else {
      const { data, error } = await supabase.from('family_profiles').insert({ user_id: user.id, ...payload }).select().single()
      setSaving(false)
      if (!error && data) { setProfiles(prev => [...prev, data as Profile]); setAdding(false); setForm(emptyForm) }
      else if (error) alert(`Não foi possível criar: ${error.message}`)
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm('Apagar este perfil e toda a medicação associada?')) return
    setDeletingId(id)
    await supabase.from('family_profiles').delete().eq('id', id).eq('user_id', user!.id)
    setProfiles(ps => ps.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data?.session?.access_token || ''}` }
  }, [supabase])

  const loadLinks = useCallback(async () => {
    try {
      const res = await fetch('/api/family-link', { headers: await authHeaders() })
      const d = await res.json()
      if (res.ok && Array.isArray(d.links)) {
        const map: Record<string, FamilyLink> = {}
        d.links.forEach((l: any) => { map[l.family_profile_id] = { code: l.code, verify_digits: l.verify_digits, patient_name: l.patient_name } })
        setLinks(map)
      }
    } catch { /* offline */ }
  }, [authHeaders])

  async function unlink(profileId: string) {
    if (!confirm('Desligar este perfil da instituição? Deixa de ver o diário, medicação e conversa. Pode voltar a ligar quando quiser.')) return
    try {
      await fetch(`/api/family-link?family_profile_id=${profileId}`, { method: 'DELETE', headers: await authHeaders() })
      setLinks(l => { const n = { ...l }; delete n[profileId]; return n })
    } catch { /* offline */ }
  }

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data: p } = await supabase.from('family_profiles')
      .select('id,name,relation,age,sex,weight,height,creatinine,conditions,allergies,notes').eq('user_id', user.id).order('name')
    const list = (p || []) as Profile[]
    setProfiles(list)
    if (list.length) {
      const ids = list.map(x => x.id)
      const since = new Date(Date.now() - 90 * 86400000).toISOString()
      const [m, v, s] = await Promise.all([
        supabase.from('family_profile_meds').select('*').in('profile_id', ids),
        supabase.from('vitals').select('profile_id,recorded_at,bp_sys,bp_dia,hr,spo2,weight,glucose,temp').in('profile_id', ids).gte('recorded_at', since).then((r: any) => r, () => ({ data: [] })),
        supabase.from('symptom_logs').select('profile_id,at,pain,temperature,symptoms').in('profile_id', ids).gte('at', since).then((r: any) => r, () => ({ data: [] })),
      ])
      setMeds((m.data || []) as Med[])
      setVitals((v.data || []) as Vital[])
      setSyms((s.data || []) as Sym[])
    }
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load(); loadLinks() }, [load, loadLinks])

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div><Link href="/login" style={{ color: 'var(--green)', fontWeight: 700 }}>Iniciar sessão →</Link></div>
    </div>
  )

  // Corre o motor de vigilância por familiar (sem alteração — só não se
  // mostra em destaque para quem já está ligado a uma instituição, cujo
  // "hoje" vem do diário do lar, não de registos pessoais).
  const watched = profiles.map(p => {
    const pmeds = meds.filter(m => m.profile_id === p.id)
    const result = analyzeFamilyMember({
      age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies,
      meds: pmeds.map(m => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
      vitals: vitals.filter(v => v.profile_id === p.id),
      symptoms: syms.filter(s => s.profile_id === p.id),
    })
    return { p, pmeds, result }
  })

  const attention = watched.flatMap(({ p, result }) =>
    result.signals
      .filter(s => s.severity === 'critical' || s.severity === 'major')
      .map(s => ({ p, s, key: `${p.id}:${s.kind}` }))
  ).filter(x => !dismissed.has(x.key))
   .sort((a, b) => (a.s.severity === 'critical' ? 0 : 1) - (b.s.severity === 'critical' ? 0 : 1))

  const activate = (p: Profile) => setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies, ownerId: user?.id })
  function toggleExpanded(id: string) { setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }
  function toggleMore(id: string) { setMoreOpen(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }) }

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 80px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Cuidar</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>A sua família</h1>
        <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>O Phlox acompanha quem mais ama e avisa-o quando algo precisa de atenção.</p>

        {adding && (
          <div style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>{editId ? 'Editar familiar' : 'Adicionar familiar'}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" autoFocus style={{ flex: '2 1 180px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <select value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} style={{ flex: '1 1 120px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none', background: 'white' }}>
                <option value="">Relação…</option>
                {RELATION_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/\D/g, '') }))} placeholder="Idade" inputMode="numeric" style={{ flex: '0 1 90px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))} style={{ flex: '1 1 110px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none', background: 'white' }}>
                <option value="">Sexo…</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="outro">Outro</option>
              </select>
              <input value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="Peso (kg)" type="number" step="0.1" style={{ flex: '1 1 100px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} placeholder="Altura (cm)" type="number" style={{ flex: '1 1 100px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <input value={form.creatinine} onChange={e => setForm(f => ({ ...f, creatinine: e.target.value }))} placeholder="Creatinina (mg/dL)" type="number" step="0.01" style={{ flex: '1 1 130px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              <input value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} placeholder="Diagnósticos / condições (ex: HTA, DM2)" style={{ padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <input value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} placeholder="Alergias (ex: Penicilina, AINEs)" style={{ padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notas / observações clínicas" rows={2} style={{ padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none', resize: 'vertical', fontFamily: 'var(--font-sans)' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveProfile} disabled={saving || !form.name.trim()} style={{ padding: '10px 18px', background: saving || !form.name.trim() ? '#e2e8f0' : ACCENT, color: saving || !form.name.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: saving || !form.name.trim() ? 'default' : 'pointer' }}>{saving ? 'A guardar…' : editId ? 'Guardar alterações' : 'Criar perfil'}</button>
              <button onClick={() => { setAdding(false); setEditId(null); setForm(emptyForm) }} style={{ padding: '10px 16px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}</div>
        ) : profiles.length === 0 && !adding ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>👨‍👩‍👧</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#0b1120', marginBottom: 8 }}>De quem está a cuidar?</div>
            <div style={{ fontSize: 14.5, color: '#64748b', marginBottom: 22, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 22px' }}>Crie um espaço para cada pessoa de quem cuida — o pai, a mãe, um filho. Se estiver num lar ou centro de dia, liga-se depois com o código da instituição. O Phlox guarda a medicação, os sinais vitais e os sintomas de cada um, e avisa-o quando algo precisa de atenção.</div>
            <button onClick={openAdd} style={{ display: 'inline-block', padding: '14px 26px', background: ACCENT, color: 'white', borderRadius: 12, fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer' }}>+ Adicionar a primeira pessoa</button>
          </div>
        ) : profiles.length === 0 ? null : (
          <>
            <PushNudge text="Ativa notificações para saberes logo quando alguém da tua família precisar de atenção." />

            {attention.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Precisa de atenção hoje</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attention.map(({ p, s, key }) => {
                    const sv = SEV[s.severity]
                    return (
                      <div key={key} style={{ background: sv.b, border: `1px solid ${sv.bd}`, borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'white', border: `1px solid ${sv.bd}`, color: sv.c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{initials(p.name)}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{p.name.split(' ')[0]} · {s.title}</div>
                            <div style={{ fontSize: 13, color: sv.c, lineHeight: 1.5, marginTop: 2 }}>{s.detail}</div>
                            {s.action && <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4 }}>→ {s.action}</div>}
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                              {s.cta && <Link href={s.cta.href} onClick={() => activate(p)} style={{ fontSize: 12.5, fontWeight: 700, color: 'white', background: sv.c, borderRadius: 8, padding: '7px 13px', textDecoration: 'none' }}>{s.cta.label} →</Link>}
                              <button onClick={() => setDismissed(d => new Set(d).add(key))} style={{ fontSize: 12.5, fontWeight: 600, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Dispensar</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {watched.map(({ p, pmeds, result }) => {
                const lv = WATCH_LEVEL_META[result.level]
                const latest = [...vitals.filter(v => v.profile_id === p.id)].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
                const link = links[p.id]
                const isOpen = expanded.has(p.id)
                const isMoreOpen = moreOpen.has(p.id)
                return (
                  <div key={p.id} style={{ background: 'white', border: `1px solid ${result.level === 'critical' ? '#fca5a5' : result.level === 'warning' ? '#fde68a' : '#e9eaec'}`, borderRadius: 16, overflow: 'hidden' }}>
                    <button onClick={() => toggleExpanded(p.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: link ? '#eff6ff' : '#fef3c7', color: link ? '#1d4ed8' : ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{initials(p.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                          {p.relation && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: 'uppercase' }}>{p.relation}</span>}
                          {p.age != null && <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.age} anos</span>}
                          {link ? (
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 8px' }}>🏡 No lar/centro</span>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 800, color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`, borderRadius: 6, padding: '2px 8px' }}>{lv.label}</span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 18, color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>⌄</span>
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ paddingTop: 14 }}>
                          {link ? (
                            <LinkedResidentPanel link={link} myName={myName} onNameChange={setMyNamePersist} onUnlink={() => unlink(p.id)} />
                          ) : (
                            <>
                              {result.signals.filter(s => s.severity !== 'critical' && s.severity !== 'major').length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                  {result.signals.filter(s => s.severity !== 'critical' && s.severity !== 'major').slice(0, 4).map((s, i) => (
                                    <span key={i} title={s.detail} style={{ fontSize: 11, fontWeight: 700, color: SEV[s.severity].c, background: SEV[s.severity].b, border: `1px solid ${SEV[s.severity].bd}`, borderRadius: 6, padding: '3px 8px' }}>{s.title}</span>
                                  ))}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#475569', marginBottom: 12 }}>
                                <span>💊 {pmeds.length} med.</span>
                                {latest?.bp_sys && <span>🩸 TA {latest.bp_sys}/{latest.bp_dia ?? '—'}</span>}
                                {latest?.weight && <span>⚖️ {latest.weight} kg</span>}
                                {p.allergies && <span style={{ color: '#dc2626' }}>⚠ {p.allergies}</span>}
                              </div>

                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                                <Link href={`/perfil/${p.id}`} style={act(ACCENT)}>Abrir perfil completo</Link>
                                <Link href="/mymeds" onClick={() => activate(p)} style={act(ACCENT, true)}>Medicação</Link>
                                <Link href="/vitals" onClick={() => activate(p)} style={act(ACCENT)}>Vitais</Link>
                                <Link href="/sintomas" onClick={() => activate(p)} style={act(ACCENT)}>Sintomas</Link>
                                <Link href="/timeline" onClick={() => activate(p)} style={act(ACCENT)}>Ver histórico</Link>
                                <Link href="/med-review" onClick={() => activate(p)} style={act(ACCENT)}>Rever medicação</Link>
                              </div>

                              <button onClick={() => toggleMore(p.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, color: '#94a3b8', padding: 0, marginBottom: isMoreOpen ? 10 : 0 }}>
                                {isMoreOpen ? '▾' : '▸'} Mais ferramentas
                              </button>

                              {isMoreOpen && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {isPro ? (
                                    <>
                                      <RiskIndexCard profileId={p.id} title={`Risco de ${p.name.split(' ')[0]}`} />
                                      <CrisisPlaybookCard profileId={p.id} name={p.name} />
                                      <ZaritBurdenCard profileId={p.id} name={p.name} />
                                      <ShareInviteButton profileId={p.id} name={p.name} />
                                      <HandoffSheetButton profileId={p.id} name={p.name} age={p.age} allergies={p.allergies} conditions={p.conditions} meds={pmeds.map(m => ({ name: m.name, dose: m.dose }))} />
                                    </>
                                  ) : (
                                    <div style={{ fontSize: 12.5, color: '#94a3b8', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
                                      Índice de risco, playbook de crise, sobrecarga do cuidador e partilha entre cuidadores são do plano Pro. <Link href="/pricing" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>Ver planos →</Link>
                                    </div>
                                  )}

                                  {linkingFor === p.id ? (
                                    <LinkInstitutionForm profileId={p.id} authHeaders={authHeaders} onLinked={(fl) => { setLinks(l => ({ ...l, [p.id]: fl })); setLinkingFor(null) }} onCancel={() => setLinkingFor(null)} />
                                  ) : (
                                    <button onClick={() => setLinkingFor(p.id)} style={{ padding: '10px 14px', background: 'white', color: '#1d4ed8', border: '1.5px solid #bfdbfe', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>🏡 Ligar a um lar ou centro de dia</button>
                                  )}
                                </div>
                              )}
                            </>
                          )}

                          <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                            <button onClick={() => openEdit(p)} style={{ padding: '6px 10px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 7, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Editar</button>
                            <button onClick={() => deleteProfile(p.id)} disabled={deletingId === p.id} style={{ padding: '6px 10px', background: 'white', color: deletingId === p.id ? '#94a3b8' : '#dc2626', border: `1px solid ${deletingId === p.id ? '#e9eaec' : '#fecaca'}`, borderRadius: 7, fontSize: 11, cursor: deletingId === p.id ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>{deletingId === p.id ? '…' : 'Apagar'}</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              <button onClick={openAdd} style={{ display: 'block', width: '100%', padding: '14px', background: 'white', border: '2px dashed #fde68a', borderRadius: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Adicionar familiar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Ligar um perfil a um residente institucional — código + últimos 4 dígitos
// do telefone registado, verificado no servidor (app/api/family-link). Fica
// guardado à conta, não ao dispositivo.
function LinkInstitutionForm({ profileId, authHeaders, onLinked, onCancel }: {
  profileId: string
  authHeaders: () => Promise<Record<string, string>>
  onLinked: (link: FamilyLink) => void
  onCancel: () => void
}) {
  const [code, setCode] = useState('')
  const [verify, setVerify] = useState('')
  const [needsVerify, setNeedsVerify] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!code.trim()) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/family-link', {
        method: 'POST', headers: await authHeaders(),
        body: JSON.stringify({ family_profile_id: profileId, code: code.trim(), verify: verify.trim() }),
      })
      const d = await res.json()
      if (d.needsVerify) { setNeedsVerify(true); setError(d.error || ''); setBusy(false); return }
      if (!res.ok || d.error) { setError(d.error || 'Não foi possível ligar.'); setBusy(false); return }
      onLinked({ code: code.trim().toUpperCase(), verify_digits: verify.replace(/\D/g, '').slice(-4), patient_name: d.patientName })
    } catch { setError('Erro de ligação. Tente novamente.') }
    setBusy(false)
  }

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 10, lineHeight: 1.5 }}>Peça à instituição o código de acesso da família. Depois de o código ser reconhecido, confirme com os últimos 4 dígitos do telefone que a instituição tem registado.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Código da instituição" style={{ flex: '1 1 160px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'var(--font-mono)' }} />
        {needsVerify && (
          <input value={verify} onChange={e => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Últimos 4 dígitos" inputMode="numeric" style={{ flex: '0 1 150px', border: '1.5px solid #e9eaec', borderRadius: 9, padding: '9px 12px', fontSize: 13.5, outline: 'none', fontFamily: 'var(--font-mono)' }} />
        )}
      </div>
      {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={submit} disabled={busy || !code.trim() || (needsVerify && verify.length !== 4)} style={{ padding: '9px 16px', background: busy || !code.trim() ? '#e2e8f0' : '#1d4ed8', color: busy || !code.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'A ligar…' : needsVerify ? 'Confirmar' : 'Continuar'}</button>
        <button onClick={onCancel} style={{ padding: '9px 14px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 12.5, cursor: 'pointer' }}>Cancelar</button>
      </div>
    </div>
  )
}
