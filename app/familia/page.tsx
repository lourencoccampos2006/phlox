'use client'

// /familia — CENTRO DE CUIDADO (Ronda 2, 2026-06-28). De lista passiva a
// "Anjo da Guarda": o Phlox vela pelas pessoas de quem cuidamos. Corre o motor de
// vigilância (lib/caregiverWatch — reúne 26 regras clínicas + tendências reais de
// vitais/stock/sintomas) por familiar, e mostra no topo "o que precisa de atenção
// hoje" (acionável), seguido de um cartão vivo por pessoa.

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { setActiveProfile } from '@/lib/profileContext'
import { analyzeFamilyMember, WATCH_LEVEL_META, type WatchResult, type WatchSignal } from '@/lib/caregiverWatch'
import Link from 'next/link'

interface Profile { id: string; name: string; relation?: string; age?: number | null; sex?: string | null; weight?: number | null; conditions?: string | null; allergies?: string | null }
interface Med { id: string; profile_id: string; name: string; dose?: string; pills_remaining?: number | null; pills_per_day?: number | null }
interface Vital { profile_id: string | null; recorded_at: string; bp_sys?: number | null; bp_dia?: number | null; hr?: number | null; spo2?: number | null; weight?: number | null; glucose?: number | null; temp?: number | null }
interface Sym { profile_id: string | null; at: string; pain?: number | null; temperature?: number | null; symptoms?: string[] | null }

const ACCENT = '#b45309'
const initials = (n: string) => n.split(' ').slice(0, 2).map(x => x[0]).join('').toUpperCase()
const SEV: Record<string, { c: string; b: string; bd: string }> = {
  critical: { c: '#991b1b', b: '#fee2e2', bd: '#fca5a5' },
  major: { c: '#b91c1c', b: '#fef2f2', bd: '#fca5a5' },
  moderate: { c: '#b45309', b: '#fffbeb', bd: '#fde68a' },
  minor: { c: '#1d4ed8', b: '#eff6ff', bd: '#bfdbfe' },
  info: { c: '#64748b', b: '#f1f5f9', bd: '#e2e8f0' },
}

export default function FamiliaPage() {
  const { user, supabase } = useAuth() as any
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [meds, setMeds] = useState<Med[]>([])
  const [vitals, setVitals] = useState<Vital[]>([])
  const [syms, setSyms] = useState<Sym[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  // Adicionar familiar AQUI (cria logo o perfil — antes mandava para /perfis e não criava).
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', relation: '', age: '' })
  const [saving, setSaving] = useState(false)

  async function createProfile() {
    if (!form.name.trim() || !user?.id) return
    setSaving(true)
    const { data, error } = await supabase.from('family_profiles').insert({
      user_id: user.id, name: form.name.trim(),
      relation: form.relation.trim() || null,
      age: form.age ? Number(form.age) : null,
    }).select().single()
    setSaving(false)
    if (!error && data) {
      setProfiles(prev => [...prev, data as Profile])
      setForm({ name: '', relation: '', age: '' }); setAdding(false)
    } else if (error) {
      alert(`Não foi possível criar: ${error.message}`)
    }
  }

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data: p } = await supabase.from('family_profiles')
      .select('id,name,relation,age,sex,weight,conditions,allergies').eq('user_id', user.id).order('name')
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

  useEffect(() => { load() }, [load])

  if (!user) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 36, marginBottom: 12 }}>👨‍👩‍👧</div><Link href="/login" style={{ color: 'var(--green)', fontWeight: 700 }}>Iniciar sessão →</Link></div>
    </div>
  )

  // Corre o motor de vigilância por familiar.
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

  // Feed "precisa de atenção hoje" — agrega os sinais críticos/graves de todos.
  const attention = watched.flatMap(({ p, result }) =>
    result.signals
      .filter(s => s.severity === 'critical' || s.severity === 'major')
      .map(s => ({ p, s, key: `${p.id}:${s.kind}` }))
  ).filter(x => !dismissed.has(x.key))
   .sort((a, b) => (a.s.severity === 'critical' ? 0 : 1) - (b.s.severity === 'critical' ? 0 : 1))

  const activate = (p: Profile) => setActiveProfile({ id: p.id, name: p.name, type: 'family', age: p.age, sex: p.sex, weight: p.weight, conditions: p.conditions, allergies: p.allergies })

  return (
    <div style={{ minHeight: '100vh', background: '#fbfaf8', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px clamp(14px,4vw,28px) 80px' }}>

        {/* Cabeçalho warm */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT, fontWeight: 700, marginBottom: 6 }}>Centro de cuidado</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,5vw,34px)', fontWeight: 500, color: '#0b1120', margin: '0 0 6px', letterSpacing: '-0.02em' }}>A sua família</h1>
        <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>O Phlox acompanha quem mais ama e avisa-o quando algo precisa de atenção.</p>

        {/* Portal Família (lar/centro) */}
        <Link href="/portal-familia" style={{ textDecoration: 'none', display: 'block', marginBottom: 18 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>💬</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#1e40af' }}>O seu familiar está num lar ou centro de dia?</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#3b5bdb', lineHeight: 1.45 }}>Entre no Portal Família com o código da instituição — fotos, recados e medicação.</span>
            </span>
            <span style={{ color: '#1e40af', fontWeight: 700, flexShrink: 0 }}>→</span>
          </div>
        </Link>

        {/* Formulário inline de adicionar familiar — cria logo o perfil aqui. */}
        {adding && (
          <div style={{ background: 'white', border: '1px solid #fde68a', borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120', marginBottom: 10 }}>Adicionar familiar</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome" autoFocus style={{ flex: '2 1 180px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <input value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} placeholder="Relação (Mãe, Pai…)" style={{ flex: '1 1 120px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
              <input value={form.age} onChange={e => setForm(f => ({ ...f, age: e.target.value.replace(/\D/g, '') }))} placeholder="Idade" inputMode="numeric" style={{ flex: '0 1 90px', padding: '10px 12px', border: '1.5px solid #e9eaec', borderRadius: 9, fontSize: 14, outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createProfile} disabled={saving || !form.name.trim()} style={{ padding: '10px 18px', background: saving || !form.name.trim() ? '#e2e8f0' : ACCENT, color: saving || !form.name.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 800, cursor: saving || !form.name.trim() ? 'default' : 'pointer' }}>{saving ? 'A criar…' : 'Criar perfil'}</button>
              <button onClick={() => { setAdding(false); setForm({ name: '', relation: '', age: '' }) }} style={{ padding: '10px 16px', background: 'white', color: '#64748b', border: '1px solid #e9eaec', borderRadius: 9, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 110, borderRadius: 14 }} />)}</div>
        ) : profiles.length === 0 && !adding ? (
          <div style={{ background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '34px 22px', textAlign: 'center' }}>
            <div style={{ fontSize: 34, marginBottom: 14 }}>👨‍👩‍👧</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: '#0b1120', marginBottom: 8 }}>Quem está a cuidar?</div>
            <div style={{ fontSize: 14.5, color: '#64748b', marginBottom: 22, lineHeight: 1.6, maxWidth: 380, margin: '0 auto 22px' }}>Crie um espaço para cada pessoa de quem cuida — o pai, a mãe, um filho. O Phlox passa a velar por cada um.</div>
            <button onClick={() => setAdding(true)} style={{ display: 'inline-block', padding: '14px 26px', background: ACCENT, color: 'white', borderRadius: 12, fontSize: 16, fontWeight: 800, border: 'none', cursor: 'pointer' }}>+ Adicionar a primeira pessoa</button>
          </div>
        ) : profiles.length === 0 ? null : (
          <>
            {/* ── O QUE PRECISA DE ATENÇÃO HOJE ── */}
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

            {/* ── CARTÃO POR FAMILIAR ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {watched.map(({ p, pmeds, result }) => {
                const lv = WATCH_LEVEL_META[result.level]
                const latest = [...vitals.filter(v => v.profile_id === p.id)].sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0]
                return (
                  <div key={p.id} style={{ background: 'white', border: `1px solid ${result.level === 'critical' ? '#fca5a5' : result.level === 'warning' ? '#fde68a' : '#e9eaec'}`, borderRadius: 16, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px' }}>
                      <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#fef3c7', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{initials(p.name)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0b1120' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                          {p.relation && <span style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: 'uppercase' }}>{p.relation}</span>}
                          {p.age && <span style={{ fontSize: 12, color: '#94a3b8' }}>{p.age} anos</span>}
                          <span style={{ fontSize: 10, fontWeight: 800, color: lv.color, background: lv.bg, border: `1px solid ${lv.border}`, borderRadius: 6, padding: '2px 8px' }}>{lv.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sinais (não-críticos — os críticos já estão no topo) */}
                    {result.signals.filter(s => s.severity !== 'critical' && s.severity !== 'major').length > 0 && (
                      <div style={{ padding: '0 18px 4px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {result.signals.filter(s => s.severity !== 'critical' && s.severity !== 'major').slice(0, 4).map((s, i) => (
                          <span key={i} title={s.detail} style={{ fontSize: 11, fontWeight: 700, color: SEV[s.severity].c, background: SEV[s.severity].b, border: `1px solid ${SEV[s.severity].bd}`, borderRadius: 6, padding: '3px 8px' }}>{s.title}</span>
                        ))}
                      </div>
                    )}

                    {/* Linha de estado */}
                    <div style={{ padding: '10px 18px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#475569', borderTop: '1px solid #f1f5f9', marginTop: 8 }}>
                      <span>💊 {pmeds.length} med.</span>
                      {latest?.bp_sys && <span>🩸 TA {latest.bp_sys}/{latest.bp_dia ?? '—'}</span>}
                      {latest?.weight && <span>⚖️ {latest.weight} kg</span>}
                      {p.allergies && <span style={{ color: '#dc2626' }}>⚠ {p.allergies}</span>}
                    </div>

                    {/* Ações */}
                    <div style={{ padding: '12px 18px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #f1f5f9' }}>
                      <Link href="/mymeds" onClick={() => activate(p)} style={act(ACCENT, true)}>Medicação</Link>
                      <Link href="/vitals" onClick={() => activate(p)} style={act(ACCENT)}>Vitais</Link>
                      <Link href="/sintomas" onClick={() => activate(p)} style={act(ACCENT)}>Sintomas</Link>
                      <Link href="/consult-prep" onClick={() => activate(p)} style={act(ACCENT)}>Preparar consulta</Link>
                      <Link href="/med-review" onClick={() => activate(p)} style={act(ACCENT)}>Rever medicação</Link>
                      {/* Ligar ao lar/centro: usa o Portal Família (código + verificação) — daí
                          mensagens, medicação e visitas ligam-se ao utente da instituição. */}
                      <Link href="/portal-familia" onClick={() => activate(p)} style={act('#1d4ed8')}>Ligar ao lar / centro</Link>
                    </div>
                  </div>
                )
              })}

              <button onClick={() => setAdding(true)} style={{ display: 'block', width: '100%', padding: '14px', background: 'white', border: '2px dashed #fde68a', borderRadius: 14, textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>+ Adicionar familiar</button>
              <Link href="/familia360" style={{ display: 'block', padding: '12px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#475569', textDecoration: 'none' }}>Abrir o painel completo (Família 360°) →</Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function act(accent: string, solid = false): React.CSSProperties {
  return solid
    ? { padding: '8px 14px', background: accent, color: 'white', borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }
    : { padding: '8px 14px', background: 'white', color: accent, border: `1.5px solid ${accent}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: 'none' }
}
