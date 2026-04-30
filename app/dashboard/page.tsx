‘use client’

import { useState, useEffect, useCallback, Suspense } from ‘react’
import { useAuth } from ‘@/components/AuthContext’
import Header from ‘@/components/Header’
import Link from ‘next/link’
import { useSearchParams, useRouter } from ‘next/navigation’
import ReferralSection from ‘@/components/ReferralSection’

// ─── Types ────────────────────────────────────────────────────────────────────


interface Med { id: string; name: string; dose?: string; frequency?: string; created_at: string }
interface Patient { id: string; name: string; age?: number; conditions?: string; meds_count?: number; updated_at?: string; last_updated?: string; alerts?: number }
interface StudyStats { total_cards: number; streak: number; weak_topics: string[]; next_review: string }
// ─── NOVO: tipo para perfis familiares no dashboard ───
interface FamilyProfile { id: string; name: string; relation?: string; age?: number; meds_count?: number }

// ─── NOVO: secção Os Meus Perfis (partilhada pelos 3 dashboards) ──────────────

<<<<<<< HEAD
function FamilyProfilesSection({ accentColor = 'var(--green)' }: { accentColor?: string }) {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [medsCount, setMedsCount] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const plan = (user?.plan || 'free') as string
  // Limites de perfis familiares visíveis
  const LIMIT_LABELS: Record<string, string> = { free: '2 perfis', student: '3 perfis', pro: 'ilimitado', clinic: 'ilimitado' }
  const LIMIT_NUMS: Record<string, number> = { free: 2, student: 3, pro: Infinity, clinic: Infinity }
  const limit = LIMIT_NUMS[plan] ?? 2
  const atLimit = isFinite(limit) && profiles.length >= limit

  useEffect(() => {
    if (!user) return
    supabase
      .from('family_profiles')
      .select('id, name, relation, age')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .then(async ({ data }) => {
        const ps = data || []
        setProfiles(ps)
        // Contar meds por perfil
        if (ps.length > 0) {
          const { data: meds } = await supabase
            .from('family_profile_meds')
            .select('profile_id')
            .eq('user_id', user.id)
          const counts: Record<string, number> = {}
          ;(meds || []).forEach((m: { profile_id: string }) => {
            counts[m.profile_id] = (counts[m.profile_id] || 0) + 1
          })
          setMedsCount(counts)
        }
        setLoading(false)
      })
  }, [user, supabase])

  if (loading) return <div className="skeleton" style={{ height: 80, borderRadius: 10, marginBottom: 16 }} />

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Os Meus Perfis
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-5)' }}>
          {LIMIT_LABELS[plan]}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 8 }}>
        {/* Card próprio */}
        <Link href="/dashboard" style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px', background: 'white', border: `2px solid ${accentColor}`, borderRadius: 10, textDecoration: 'none', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Eu</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Perfil pessoal</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <Link href="/ai" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: accentColor, textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>AI →</Link>
            <span style={{ color: 'var(--border)' }}>|</span>
            <Link href="/interactions" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Interações</Link>
          </div>
        </Link>

        {/* Cards familiares */}
        {profiles.map(p => (
          <Link key={p.id} href={`/perfil/${p.id}`}
            style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', gap: 6, transition: 'border-color 0.15s' }}
            className="family-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                {p.relation && <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>{p.relation}</div>}
              </div>
              {(medsCount[p.id] || 0) > 0 && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', background: '#e9d5ff', border: '1px solid #d8b4fe', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
                  {medsCount[p.id]} med.
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <Link href={`/ai?profile=${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#7c3aed', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>AI →</Link>
              <span style={{ color: 'var(--border)' }}>|</span>
              <Link href={`/interactions?profile=${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Interações</Link>
            </div>
          </Link>
        ))}

        {/* Botão novo perfil (se não atingiu limite) */}
        {!atLimit ? (
          <Link href="/perfis"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 16px', background: 'var(--bg-2)', border: '1.5px dashed var(--border)', borderRadius: 10, textDecoration: 'none', gap: 4, minHeight: 80, transition: 'border-color 0.15s, background 0.15s' }}
            className="add-profile-card">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Novo perfil</div>
          </Link>
        ) : (
          <Link href="/pricing"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 16px', background: '#fffbeb', border: '1.5px dashed #fde68a', borderRadius: 10, textDecoration: 'none', gap: 4, minHeight: 80 }}>
            <div style={{ fontSize: 11, color: '#d97706', fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'center' }}>Limite atingido</div>
            <div style={{ fontSize: 10, color: '#d97706', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>Upgrade →</div>
          </Link>
        )}
      </div>
    </div>
  )
=======
function FamilyProfilesSection({ accentColor = ‘var(–green)’ }: { accentColor?: string }) {
const { user, supabase } = useAuth()
const [profiles, setProfiles] = useState<FamilyProfile[]>([])
const [medsCount, setMedsCount] = useState<Record<string, number>>({})
const [loading, setLoading] = useState(true)

const plan = (user?.plan || ‘free’) as string
// Limites de perfis familiares visíveis
const LIMIT_LABELS: Record<string, string> = { free: ‘2 perfis’, student: ‘3 perfis’, pro: ‘ilimitado’, clinic: ‘ilimitado’ }
const LIMIT_NUMS: Record<string, number> = { free: 2, student: 3, pro: Infinity, clinic: Infinity }
const limit = LIMIT_NUMS[plan] ?? 2
const atLimit = isFinite(limit) && profiles.length >= limit

useEffect(() => {
if (!user) return
supabase
.from(‘family_profiles’)
.select(‘id, name, relation, age’)
.eq(‘user_id’, user.id)
.order(‘created_at’, { ascending: true })
.then(async ({ data }) => {
const ps = data || []
setProfiles(ps)
// Contar meds por perfil
if (ps.length > 0) {
const { data: meds } = await supabase
.from(‘family_profile_meds’)
.select(‘profile_id’)
.eq(‘user_id’, user.id)
const counts: Record<string, number> = {}
;(meds || []).forEach((m: { profile_id: string }) => {
counts[m.profile_id] = (counts[m.profile_id] || 0) + 1
})
setMedsCount(counts)
}
setLoading(false)
})
}, [user, supabase])

if (loading) return <div className=“skeleton” style={{ height: 80, borderRadius: 10, marginBottom: 16 }} />

return (
<div style={{ marginBottom: 24 }}>
<div style={{ display: ‘flex’, justifyContent: ‘space-between’, alignItems: ‘center’, marginBottom: 12 }}>
<div style={{ fontSize: 10, fontFamily: ‘var(–font-mono)’, color: ‘var(–ink-4)’, letterSpacing: ‘0.12em’, textTransform: ‘uppercase’ }}>
Os Meus Perfis
</div>
<span style={{ fontSize: 10, fontFamily: ‘var(–font-mono)’, color: ‘var(–ink-5)’ }}>
{LIMIT_LABELS[plan]}
</span>
</div>

```
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 8 }}>
    {/* Card próprio */}
    <Link href="/dashboard" style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px', background: 'white', border: `2px solid ${accentColor}`, borderRadius: 10, textDecoration: 'none', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--green)', flexShrink: 0 }}>
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>Eu</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>Perfil pessoal</div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <Link href="/ai" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: accentColor, textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>AI →</Link>
        <span style={{ color: 'var(--border)' }}>|</span>
        <Link href="/interactions" onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Interações</Link>
      </div>
    </Link>

    {/* Cards familiares */}
    {profiles.map(p => (
      <Link key={p.id} href={`/perfil/${p.id}`}
        style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', gap: 6, transition: 'border-color 0.15s' }}
        className="family-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e9d5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
            {p.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            {p.relation && <div style={{ fontSize: 10, color: 'var(--ink-5)' }}>{p.relation}</div>}
          </div>
          {(medsCount[p.id] || 0) > 0 && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', background: '#e9d5ff', border: '1px solid #d8b4fe', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>
              {medsCount[p.id]} med.
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <Link href={`/ai?profile=${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: '#7c3aed', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>AI →</Link>
          <span style={{ color: 'var(--border)' }}>|</span>
          <Link href={`/interactions?profile=${p.id}`} onClick={e => e.stopPropagation()} style={{ fontSize: 10, color: 'var(--ink-4)', textDecoration: 'none', fontFamily: 'var(--font-mono)' }}>Interações</Link>
        </div>
      </Link>
    ))}

    {/* Botão novo perfil (se não atingiu limite) */}
    {!atLimit ? (
      <Link href="/perfis"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 16px', background: 'var(--bg-2)', border: '1.5px dashed var(--border)', borderRadius: 10, textDecoration: 'none', gap: 4, minHeight: 80, transition: 'border-color 0.15s, background 0.15s' }}
        className="add-profile-card">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Novo perfil</div>
      </Link>
    ) : (
      <Link href="/pricing"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '14px 16px', background: '#fffbeb', border: '1.5px dashed #fde68a', borderRadius: 10, textDecoration: 'none', gap: 4, minHeight: 80 }}>
        <div style={{ fontSize: 11, color: '#d97706', fontFamily: 'var(--font-mono)', fontWeight: 700, textAlign: 'center' }}>Limite atingido</div>
        <div style={{ fontSize: 10, color: '#d97706', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>Upgrade →</div>
      </Link>
    )}
  </div>
</div>
```

)
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
}

// ─── Personal Dashboard ───────────────────────────────────────────────────────

function PersonalDashboard() {
const { user, supabase, signOut } = useAuth()
const [tab, setTab] = useState<‘home’ | ‘meds’ | ‘diary’ | ‘account’>(‘home’)
const [meds, setMeds] = useState<Med[]>([])
const [loading, setLoading] = useState(true)
const [newMed, setNewMed] = useState({ name: ‘’, dose: ‘’, frequency: ‘’ })
const [adding, setAdding] = useState(false)

const plan = (user?.plan || ‘free’) as string
const firstName = user?.name?.split(’ ’)[0] || ‘Bem-vindo’

const loadMeds = useCallback(async () => {
if (!user) return
const { data } = await supabase.from(‘personal_meds’).select(’*’).eq(‘user_id’, user.id).order(‘created_at’, { ascending: false })
setMeds(data || [])
setLoading(false)
}, [user, supabase])

useEffect(() => { loadMeds() }, [loadMeds])

const addMed = async () => {
if (!newMed.name.trim() || !user) return
setAdding(true)
const { data } = await supabase.from(‘personal_meds’).insert({ user_id: user.id, name: newMed.name.trim(), dose: newMed.dose || null, frequency: newMed.frequency || null }).select().single()
if (data) setMeds(p => [data, …p])
setNewMed({ name: ‘’, dose: ‘’, frequency: ‘’ })
setAdding(false)
}

const removeMed = async (id: string) => {
await supabase.from(‘personal_meds’).delete().eq(‘id’, id)
setMeds(p => p.filter(m => m.id !== id))
}

<<<<<<< HEAD
  const QUICK_ACTIONS = [
    { label: 'Verificar interações', sub: `${meds.length > 0 ? meds.length + ' medicamentos no perfil' : 'Escreve os nomes das caixas'}`, href: '/interactions', badge: 'Grátis' },
    { label: 'Tradutor de Bula', sub: 'Cola o texto ou escreve o nome', href: '/bula', badge: 'Grátis' },
    { label: 'Dose Pediátrica', sub: 'Peso + medicamento = dose exacta', href: '/dose-crianca', badge: 'Grátis' },
    { label: 'Perceber Análises', sub: 'PDF ou cola os valores', href: '/labs', badge: undefined },
    { label: 'Preparar Consulta', sub: 'Perguntas certas para o médico', href: '/consult-prep', badge: undefined },
    { label: 'O que comprar sem receita', sub: 'Guia de automedicação', href: '/otc', badge: undefined },
  ]
=======
const QUICK_ACTIONS = [
{ label: ‘Verificar interações’, sub: `${meds.length > 0 ? meds.length + ' medicamentos no perfil' : 'Escreve os nomes das caixas'}`, href: ‘/interactions’, badge: ‘Grátis’ },
{ label: ‘Tradutor de Bula’, sub: ‘Cola o texto ou escreve o nome’, href: ‘/bula’, badge: ‘Grátis’ },
{ label: ‘Dose Pediátrica’, sub: ‘Peso + medicamento = dose exacta’, href: ‘/dose-crianca’, badge: ‘Grátis’ },
{ label: ‘Perceber Análises’, sub: ‘PDF ou cola os valores’, href: ‘/labs’, badge: undefined },
{ label: ‘Preparar Consulta’, sub: ‘Perguntas certas para o médico’, href: ‘/consult-prep’, badge: undefined },
{ label: ‘O que comprar sem receita’, sub: ‘Guia de automedicação’, href: ‘/otc’, badge: undefined },
]
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc

const tabStyle = (t: string) => ({
padding: ‘10px 16px’, background: ‘none’, border: ‘none’,
borderBottom: `2px solid ${tab === t ? 'var(--green)' : 'transparent'}`,
cursor: ‘pointer’, fontSize: 12, fontWeight: 700,
color: tab === t ? ‘var(–green)’ : ‘var(–ink-4)’,
fontFamily: ‘var(–font-sans)’, letterSpacing: ‘0.04em’,
textTransform: ‘uppercase’ as const, marginBottom: -1,
transition: ‘color 0.15s, border-color 0.15s’, whiteSpace: ‘nowrap’ as const,
})

return (
<div style={{ minHeight: ‘100vh’, background: ‘var(–bg-2)’, fontFamily: ‘var(–font-sans)’ }}>
<Header />

```
  {/* Personal header */}
  <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
    <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Olá, {firstName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 3 }}>
            {meds.length > 0 ? `${meds.length} medicamento${meds.length > 1 ? 's' : ''} no teu perfil` : 'Começa por adicionar os teus medicamentos'}
          </div>
        </div>
        {plan === 'free' && (
          <Link href="/pricing" style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700, border: '1px solid var(--green)', padding: '5px 10px', borderRadius: 5, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
            Upgrade
          </Link>
        )}
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
        {[['home', 'Início'], ['meds', 'Medicação'], ['diary', 'Diário'], ['account', 'Conta']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
        ))}
      </div>
    </div>
  </div>

  <div className="page-container page-body">

    {/* HOME TAB */}
    {tab === 'home' && (
      <div>
        {/* Stats row */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
            {[
              { value: String(meds.length), label: meds.length === 1 ? 'Medicamento' : 'Medicamentos', color: 'var(--green)', href: undefined as string | undefined, action: () => setTab('meds') },
              { value: plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1), label: 'Plano actual', color: plan === 'free' ? 'var(--ink-4)' : plan === 'student' ? '#7c3aed' : '#1d4ed8', href: plan === 'free' ? '/pricing' : undefined, action: undefined as (() => void) | undefined },
              { value: meds.length >= 2 ? '!' : '✓', label: meds.length >= 2 ? 'Verificar interações' : 'Sem alertas', color: meds.length >= 2 ? '#d97706' : 'var(--green)', href: '/interactions', action: undefined as (() => void) | undefined },
            ].map(({ value, label, color, href, action }) => {
              const content = (
                <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', cursor: href || action ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
                  onClick={action}
                  className={href || action ? 'stat-card' : ''}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{label}</div>
                </div>
              )
              return href
                ? <Link key={label} href={href} style={{ textDecoration: 'none' }}>{content}</Link>
                : <div key={label}>{content}</div>
            })}
          </div>
        )}

        {/* ─── Os Meus Perfis ─── */}
        <FamilyProfilesSection accentColor="var(--green)" />

        {/* Quick actions */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>O que precisas hoje?</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 8 }}>
            {QUICK_ACTIONS.map(({ label, sub, href, badge }) => (
              <Link key={href} href={href}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                className="quick-action">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                    {badge && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{badge}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Meds snapshot */}
        {meds.length > 0 && (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Os meus medicamentos</div>
              <button onClick={() => setTab('meds')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Ver todos →</button>
            </div>
            {meds.slice(0, 4).map((med, i) => (
              <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < Math.min(meds.length, 4) - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>
              </div>
            ))}
            {meds.length >= 2 && (
              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--green-light)', color: 'var(--green)', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, border: '1px solid var(--green-mid)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                  Verificar interações entre {meds.length} medicamentos →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Upgrade prompt for free */}
        {plan === 'free' && (
          <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>Diário de sintomas, preparação de consulta, alertas</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Acompanha a tua medicação ao longo do tempo com análise farmacológica.</div>
            </div>
            <Link href="/pricing" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em', textTransform: 'uppercase', flexShrink: 0 }}>
              Ver Student — 3,99€/mês
            </Link>
          </div>
        )}
      </div>
    )}

<<<<<<< HEAD
      <div className="page-container page-body">

        {/* HOME TAB */}
        {tab === 'home' && (
          <div>
            {/* Stats row */}
            {!loading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
                {[
                  { value: String(meds.length), label: meds.length === 1 ? 'Medicamento' : 'Medicamentos', color: 'var(--green)', href: undefined as string | undefined, action: () => setTab('meds') },
                  { value: plan === 'free' ? 'Free' : plan.charAt(0).toUpperCase() + plan.slice(1), label: 'Plano actual', color: plan === 'free' ? 'var(--ink-4)' : plan === 'student' ? '#7c3aed' : '#1d4ed8', href: plan === 'free' ? '/pricing' : undefined, action: undefined as (() => void) | undefined },
                  { value: meds.length >= 2 ? '!' : '✓', label: meds.length >= 2 ? 'Verificar interações' : 'Sem alertas', color: meds.length >= 2 ? '#d97706' : 'var(--green)', href: '/interactions', action: undefined as (() => void) | undefined },
                ].map(({ value, label, color, href, action }) => {
                  const content = (
                    <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', cursor: href || action ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
                      onClick={action}
                      className={href || action ? 'stat-card' : ''}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color, fontWeight: 400, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{label}</div>
                    </div>
                  )
                  return href
                    ? <Link key={label} href={href} style={{ textDecoration: 'none' }}>{content}</Link>
                    : <div key={label}>{content}</div>
                })}
              </div>
            )}

            {/* ─── Os Meus Perfis ─── */}
            <FamilyProfilesSection accentColor="var(--green)" />

            {/* Quick actions */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>O que precisas hoje?</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 8 }}>
                {QUICK_ACTIONS.map(({ label, sub, href, badge }) => (
                  <Link key={href} href={href}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10, textDecoration: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    className="quick-action">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                        {badge && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#0d6e42', background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: 3, padding: '1px 5px', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>{badge}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{sub}</div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                ))}
              </div>
            </div>

            {/* Meds snapshot */}
            {meds.length > 0 && (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Os meus medicamentos</div>
                  <button onClick={() => setTab('meds')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--green)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Ver todos →</button>
                </div>
                {meds.slice(0, 4).map((med, i) => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 18px', borderBottom: i < Math.min(meds.length, 4) - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>
                  </div>
                ))}
                {meds.length >= 2 && (
                  <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
                    <Link href="/interactions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--green-light)', color: 'var(--green)', textDecoration: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, border: '1px solid var(--green-mid)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                      Verificar interações entre {meds.length} medicamentos →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Upgrade prompt for free */}
            {plan === 'free' && (
              <div style={{ background: 'var(--ink)', borderRadius: 10, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4, letterSpacing: '-0.01em' }}>Diário de sintomas, preparação de consulta, alertas</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Acompanha a tua medicação ao longo do tempo com análise farmacológica.</div>
                </div>
                <Link href="/pricing" style={{ background: 'white', color: 'var(--ink)', textDecoration: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.02em', textTransform: 'uppercase', flexShrink: 0 }}>
                  Ver Student — 3,99€/mês
                </Link>
              </div>
            )}
          </div>
        )}

        {/* MEDS TAB */}
        {tab === 'meds' && (
          <div style={{ maxWidth: 640 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>Os meus medicamentos</h2>
            </div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
              <div className="add-med-form">
                <input value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMed()}
                  placeholder="Nome do medicamento *" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
                  placeholder="Dose (ex: 10mg)" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <input value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
                  placeholder="Frequência" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                <button onClick={addMed} disabled={!newMed.name.trim() || adding}
                  style={{ background: newMed.name.trim() && !adding ? 'var(--ink)' : 'var(--bg-3)', color: newMed.name.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: newMed.name.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {adding ? '...' : 'Adicionar'}
                </button>
              </div>
            </div>
            {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {meds.map(med => (
                  <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                      {(med.dose || med.frequency) && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>}
                    </div>
                    <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px' }} className="remove-btn">×</button>
                  </div>
                ))}
                {meds.length === 0 && <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>Nenhum medicamento adicionado ainda.</div>}
              </div>
            )}
          </div>
        )}

        {/* DIARY TAB */}
        {tab === 'diary' && (
          <div style={{ maxWidth: 640 }}>
            {plan === 'free' ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.01em' }}>Diário de sintomas</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 24px' }}>Regista como te sentes dia a dia. Ao fim de 2 semanas, análise farmacológica completa — o que está a funcionar, o que pode ser efeito adverso, o que levar à consulta.</p>
                <Link href="/pricing" style={{ display: 'inline-flex', background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '11px 22px', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Student — 3,99€/mês
                </Link>
              </div>
            ) : (
              <Link href="/diary" style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '20px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700 }}>
                Abrir diário de sintomas →
              </Link>
            )}
          </div>
        )}

        {/* ACCOUNT TAB */}
        {tab === 'account' && (
          <div style={{ maxWidth: 520 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 20 }}>Conta</h2>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
              {[{ l: 'Nome', v: user?.name || '—' }, { l: 'Email', v: user?.email || '' }, { l: 'Plano', v: user?.plan || 'Gratuito' }].map(({ l, v }, i, arr) => (
                <div key={l} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ padding: '12px 14px', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>{l}</div>
                  <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)' }}>{v}</div>
                </div>
              ))}
            </div>
            <ReferralSection />
            <button onClick={signOut} style={{ width: '100%', marginTop: 12, padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }} className="signout-btn">
              Terminar sessão
=======
    {/* MEDS TAB */}
    {tab === 'meds' && (
      <div style={{ maxWidth: 640 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>Os meus medicamentos</h2>
        </div>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '16px', marginBottom: 12 }}>
          <div className="add-med-form">
            <input value={newMed.name} onChange={e => setNewMed(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMed()}
              placeholder="Nome do medicamento *" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <input value={newMed.dose} onChange={e => setNewMed(p => ({ ...p, dose: e.target.value }))}
              placeholder="Dose (ex: 10mg)" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <input value={newMed.frequency} onChange={e => setNewMed(p => ({ ...p, frequency: e.target.value }))}
              placeholder="Frequência" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
            <button onClick={addMed} disabled={!newMed.name.trim() || adding}
              style={{ background: newMed.name.trim() && !adding ? 'var(--ink)' : 'var(--bg-3)', color: newMed.name.trim() && !adding ? 'white' : 'var(--ink-4)', border: 'none', borderRadius: 7, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: newMed.name.trim() && !adding ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {adding ? '...' : 'Adicionar'}
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
            </button>
          </div>
        </div>
        {loading ? <div className="skeleton" style={{ height: 200, borderRadius: 10 }} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {meds.map(med => (
              <div key={med.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '13px 16px', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{med.name}</div>
                  {(med.dose || med.frequency) && <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{[med.dose, med.frequency].filter(Boolean).join(' · ')}</div>}
                </div>
                <button onClick={() => removeMed(med.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-5)', fontSize: 18, padding: '2px 6px' }} className="remove-btn">×</button>
              </div>
            ))}
            {meds.length === 0 && <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '40px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 14 }}>Nenhum medicamento adicionado ainda.</div>}
          </div>
        )}
      </div>
    )}

<<<<<<< HEAD
      <style>{`
        .quick-action:hover { border-color: var(--green) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }
        .stat-card:hover { border-color: var(--border-2) !important; }
        .remove-btn:hover { color: var(--red) !important; }
        .signout-btn:hover { color: var(--red) !important; border-color: var(--red) !important; }
        .family-card:hover { border-color: #7c3aed !important; }
        .add-profile-card:hover { border-color: var(--green) !important; background: var(--green-light) !important; }
      `}</style>
    </div>
  )
=======
    {/* DIARY TAB */}
    {tab === 'diary' && (
      <div style={{ maxWidth: 640 }}>
        {plan === 'free' ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.01em' }}>Diário de sintomas</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 360, margin: '0 auto 24px' }}>Regista como te sentes dia a dia. Ao fim de 2 semanas, análise farmacológica completa — o que está a funcionar, o que pode ser efeito adverso, o que levar à consulta.</p>
            <Link href="/pricing" style={{ display: 'inline-flex', background: 'var(--ink)', color: 'white', textDecoration: 'none', padding: '11px 22px', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Student — 3,99€/mês
            </Link>
          </div>
        ) : (
          <Link href="/diary" style={{ display: 'block', background: 'var(--green)', color: 'white', textDecoration: 'none', padding: '20px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700 }}>
            Abrir diário de sintomas →
          </Link>
        )}
      </div>
    )}

    {/* ACCOUNT TAB */}
    {tab === 'account' && (
      <div style={{ maxWidth: 520 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 20 }}>Conta</h2>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          {[{ l: 'Nome', v: user?.name || '—' }, { l: 'Email', v: user?.email || '' }, { l: 'Plano', v: user?.plan || 'Gratuito' }].map(({ l, v }, i, arr) => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: '100px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>{l}</div>
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)' }}>{v}</div>
            </div>
          ))}
        </div>
        <ReferralSection />
        <button onClick={signOut} style={{ width: '100%', marginTop: 12, padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }} className="signout-btn">
          Terminar sessão
        </button>
      </div>
    )}
  </div>

  <style>{`
    .quick-action:hover { border-color: var(--green) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important; }
    .stat-card:hover { border-color: var(--border-2) !important; }
    .remove-btn:hover { color: var(--red) !important; }
    .signout-btn:hover { color: var(--red) !important; border-color: var(--red) !important; }
    .family-card:hover { border-color: #7c3aed !important; }
    .add-profile-card:hover { border-color: var(--green) !important; background: var(--green-light) !important; }
  `}</style>
</div>
```

)
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
}

// ─── Student Dashboard ────────────────────────────────────────────────────────

function StudentDashboard() {
const { user, supabase, signOut } = useAuth()
const [tab, setTab] = useState<‘study’ | ‘ai’ | ‘tools’ | ‘account’>(‘study’)
const [stats, setStats] = useState<StudyStats>({ total_cards: 0, streak: 0, weak_topics: [], next_review: ‘’ })
const plan = (user?.plan || ‘free’) as string
const firstName = user?.name?.split(’ ’)[0] || ‘Estudante’
const isStudent = plan === ‘student’ || plan === ‘pro’ || plan === ‘clinic’

const CLASSES = [
{ name: ‘Cardiovascular’, progress: 73, color: ‘#ef4444’ },
{ name: ‘Psiquiatria’, progress: 31, color: ‘#8b5cf6’ },
{ name: ‘Endocrinologia’, progress: 58, color: ‘#f59e0b’ },
{ name: ‘Anti-infecciosos’, progress: 82, color: ‘#10b981’ },
{ name: ‘Respiratório’, progress: 45, color: ‘#3b82f6’ },
{ name: ‘Gastrointestinal’, progress: 67, color: ‘#f97316’ },
{ name: ‘SNC e Analgesia’, progress: 29, color: ‘#6366f1’ },
{ name: ‘Reumatologia’, progress: 15, color: ‘#ec4899’ },
]

const STUDY_TOOLS = [
{ href: ‘/study’, label: ‘Flashcards e Quizzes’, sub: ‘24 classes farmacológicas’, plan: null },
{ href: ‘/exam’, label: ‘Modo Exame’, sub: ‘Timer + análise de erros’, plan: ‘student’ },
{ href: ‘/cases’, label: ‘Casos Clínicos’, sub: ‘Raciocínio clínico guiado’, plan: ‘student’ },
{ href: ‘/compare’, label: ‘Comparar Fármacos’, sub: ‘A vs B linha a linha’, plan: ‘student’ },
{ href: ‘/disease’, label: ‘Fármacos por Diagnóstico’, sub: ‘1ª e 2ª linha + exame’, plan: ‘student’ },
]

const tabStyle = (t: string) => ({
padding: ‘10px 16px’, background: ‘none’, border: ‘none’,
borderBottom: `2px solid ${tab === t ? '#7c3aed' : 'transparent'}`,
cursor: ‘pointer’, fontSize: 12, fontWeight: 700,
color: tab === t ? ‘#7c3aed’ : ‘var(–ink-4)’,
fontFamily: ‘var(–font-sans)’, letterSpacing: ‘0.04em’,
textTransform: ‘uppercase’ as const, marginBottom: -1,
whiteSpace: ‘nowrap’ as const,
})

return (
<div style={{ minHeight: ‘100vh’, background: ‘var(–bg-2)’, fontFamily: ‘var(–font-sans)’ }}>
<Header />

```
  {/* Student header */}
  <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
    <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Modo Estudo — {firstName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 3 }}>
            {isStudent ? 'Continua de onde paraste.' : 'Activa o plano Student para acesso completo.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#7c3aed', fontStyle: 'italic' }}>7</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>dias streak</div>
          </div>
          <div style={{ width: 1, height: 32, background: 'var(--border)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: '#7c3aed', fontStyle: 'italic' }}>340</div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>XP ganho</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
        {[['study', 'Estudo'], ['ai', 'Phlox AI'], ['tools', 'Ferramentas'], ['account', 'Conta']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
        ))}
      </div>
    </div>
  </div>

  <div className="page-container page-body">

<<<<<<< HEAD
        {/* STUDY TAB */}
        {tab === 'study' && (
          <div>
            {/* ─── NOVO: Os Meus Perfis ─── */}
            <FamilyProfilesSection accentColor="#7c3aed" />

            {/* Progress by class */}
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Progresso por classe</div>
                <Link href="/study" style={{ fontSize: 11, color: '#7c3aed', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Estudar →</Link>
=======
    {/* STUDY TAB */}
    {tab === 'study' && (
      <div>
        {/* ─── NOVO: Os Meus Perfis ─── */}
        <FamilyProfilesSection accentColor="#7c3aed" />

        {/* Progress by class */}
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '20px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Progresso por classe</div>
            <Link href="/study" style={{ fontSize: 11, color: '#7c3aed', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Estudar →</Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
            {CLASSES.map(cls => (
              <div key={cls.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '-0.01em' }}>{cls.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{cls.progress}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${cls.progress}%`, background: cls.color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                </div>
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
              </div>
            ))}
          </div>
        </div>

        {/* Study tools */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Ferramentas de estudo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {STUDY_TOOLS.map(({ href, label, sub, plan: toolPlan }) => {
              const locked = toolPlan === 'student' && !isStudent
              return (
                <Link key={href} href={locked ? '/pricing' : href}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', gap: 12 }}
                  className="study-tool">
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: locked ? 'var(--ink-4)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{sub}</div>
                  </div>
                  {locked
                    ? <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#7c3aed', border: '1px solid #e9d5ff', background: '#faf5ff', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Student</span>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  }
                </Link>
              )
            })}
          </div>
        </div>

        {!isStudent && (
          <div style={{ background: '#7c3aed', borderRadius: 10, padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 4 }}>Modo Exame, Casos Clínicos, Comparador, Progressão</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Tudo o que precisas para passar nos exames de farmacologia.</div>
            </div>
            <Link href="/pricing" style={{ background: 'white', color: '#7c3aed', textDecoration: 'none', padding: '9px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
              3,99€/mês →
            </Link>
          </div>
        )}
      </div>
    )}

    {/* AI TUTOR TAB */}
    {tab === 'ai' && (
      <div style={{ maxWidth: 680 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#7c3aed', padding: '18px 22px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox AI · Tutor Farmacológico</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>
              Não te dou respostas. Construo o raciocínio contigo.
            </div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 20 }}>
              O tutor socrático de farmacologia. Faz a tua pergunta — desde "porque é que os beta-bloqueadores são usados na IC se parecem contraintuitivos" até "qual a diferença clínica entre IECA e ARA-II" — e o AI guia-te até perceberes, não só memorizares.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {[
                'Porque é que o ramipril é preferido ao enalapril na nefropatia diabética?',
                'Não percebo porque é que os diuréticos poupadores de potássio são usados com outros diuréticos.',
                'Explica-me o mecanismo da resistência à insulina como se eu fosse idiota.',
              ].map(q => (
                <Link key={q} href={`/ai?q=${encodeURIComponent(q)}`}
                  style={{ padding: '11px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--ink-2)', textDecoration: 'none', lineHeight: 1.5 }}
                  className="question-pill">
                  &ldquo;{q}&rdquo;
                </Link>
              ))}
            </div>
            <Link href="/ai" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: '#7c3aed', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Abrir Phlox AI →
            </Link>
          </div>
        </div>
      </div>
    )}

    {/* TOOLS TAB */}
    {tab === 'tools' && (
      <div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Todas as ferramentas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 8 }}>
          {[
            { href: '/interactions', label: 'Verificar Interações', plan: null },
            { href: '/labs', label: 'Análises Clínicas', plan: null },
            { href: '/drugs', label: 'Base de Dados FDA', plan: null },
            { href: '/compare', label: 'Comparar Fármacos', plan: 'student' },
            { href: '/disease', label: 'Fármacos por Diagnóstico', plan: 'student' },
            { href: '/monograph', label: 'Monografia Clínica', plan: null },
            { href: '/doses', label: 'Posologia', plan: null },
            { href: '/calculators', label: 'Calculadoras', plan: null },
            { href: '/safety', label: 'Segurança', plan: null },
          ].map(({ href, label, plan: toolPlan }) => {
            const locked = toolPlan === 'student' && !isStudent
            return (
              <Link key={href} href={locked ? '/pricing' : href}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', gap: 10 }}
                className="study-tool">
                <span style={{ fontSize: 13, fontWeight: 600, color: locked ? 'var(--ink-4)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                {locked
                  ? <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#7c3aed', border: '1px solid #e9d5ff', background: '#faf5ff', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>STU</span>
                  : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                }
              </Link>
            )
          })}
        </div>
      </div>
    )}

    {/* ACCOUNT TAB */}
    {tab === 'account' && (
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 20 }}>Conta</h2>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          {[{ l: 'Nome', v: user?.name || '—' }, { l: 'Email', v: user?.email || '' }, { l: 'Plano', v: user?.plan || 'Gratuito' }].map(({ l, v }, i, arr) => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>{l}</div>
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)' }}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={signOut} style={{ width: '100%', padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }} className="signout-btn">
          Terminar sessão
        </button>
      </div>
    )}
  </div>

  <style>{`
    .study-tool:hover { border-color: #7c3aed !important; background: #faf5ff !important; }
    .question-pill:hover { border-color: #7c3aed !important; background: #faf5ff !important; }
    .signout-btn:hover { color: var(--red) !important; border-color: var(--red) !important; }
  `}</style>
</div>
```

)
}

// ─── Pro Dashboard ────────────────────────────────────────────────────────────

function ProDashboard() {
const { user, supabase, signOut } = useAuth()
const [tab, setTab] = useState<‘patients’ | ‘tools’ | ‘ai’ | ‘account’>(‘patients’)
const [patients, setPatients] = useState<Patient[]>([])
const [loading, setLoading] = useState(true)
const [newPatient, setNewPatient] = useState({ name: ‘’, age: ‘’, conditions: ‘’ })
const [adding, setAdding] = useState(false)
const [showAddForm, setShowAddForm] = useState(false)
const plan = (user?.plan || ‘free’) as string
const isPro = plan === ‘pro’ || plan === ‘clinic’
const firstName = user?.name?.split(’ ’)[0] || ‘Doutor’

<<<<<<< HEAD
  const loadPatients = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('patients').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
    setPatients(data || [])
    setLoading(false)
  }, [user, supabase])
=======
const loadPatients = useCallback(async () => {
if (!user) return
const { data } = await supabase.from(‘patients’).select(’*’).eq(‘user_id’, user.id).order(‘updated_at’, { ascending: false })
setPatients(data || [])
setLoading(false)
}, [user, supabase])
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc

useEffect(() => { loadPatients() }, [loadPatients])

<<<<<<< HEAD
  const addPatient = async () => {
    if (!newPatient.name.trim() || !user) return
    setAdding(true)
    const { data, error } = await supabase.from('patients').insert({
      user_id: user.id,
      name: newPatient.name.trim(),
      age: newPatient.age ? parseInt(newPatient.age) : null,
      conditions: newPatient.conditions.trim() || null,
    }).select().single()
    if (error) console.error('addPatient error:', error.message)
    if (data) setPatients(p => [data, ...p])
    setNewPatient({ name: '', age: '', conditions: '' })
    setShowAddForm(false)
    setAdding(false)
  }
=======
const addPatient = async () => {
if (!newPatient.name.trim() || !user) return
setAdding(true)
const { data, error } = await supabase.from(‘patients’).insert({
user_id: user.id,
name: newPatient.name.trim(),
age: newPatient.age ? parseInt(newPatient.age) : null,
conditions: newPatient.conditions.trim() || null,
}).select().single()
if (error) console.error(‘addPatient error:’, error.message)
if (data) setPatients(p => [data, …p])
setNewPatient({ name: ‘’, age: ‘’, conditions: ‘’ })
setShowAddForm(false)
setAdding(false)
}
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc

const PRO_TOOLS = [
{ href: ‘/ai’, label: ‘Phlox AI Co-Piloto’, sub: ‘Com contexto clínico do doente’, key: ‘ai’ },
{ href: ‘/strategy’, label: ‘Estratégias Terapêuticas’, sub: ‘Evidência A/B/C comparada’, key: ‘strategy’ },
{ href: ‘/protocol’, label: ‘Protocolo Terapêutico’, sub: ‘ESC · ADA · NICE · DGS’, key: ‘protocol’ },
{ href: ‘/med-review’, label: ‘Revisão de Medicação’, sub: ‘Análise clínica + PDF’, key: ‘review’ },
{ href: ‘/nursing’, label: ‘Farmacotecnia IV·SC·IM’, sub: ‘Compatibilidades e prep.’, key: ‘nursing’ },
{ href: ‘/calculators’, label: ‘Calculadoras Clínicas’, sub: ‘CKD-EPI · SCORE2 · Cockcroft’, key: ‘calc’ },
{ href: ‘/compatibility’, label: ‘Compatibilidade IV’, sub: “Trissel’s e King Guide”, key: ‘compat’ },
{ href: ‘/monograph’, label: ‘Monografia Clínica’, sub: ‘Qualquer fármaco completo’, key: ‘mono’ },
{ href: ‘/doses’, label: ‘Posologia por Indicação’, sub: ‘Guidelines actualizadas’, key: ‘doses’ },
{ href: ‘/briefing’, label: ‘Briefing de Consulta’, sub: ‘Contexto clínico em 15s’, key: ‘brief’ },
]

const tabStyle = (t: string) => ({
padding: ‘10px 16px’, background: ‘none’, border: ‘none’,
borderBottom: `2px solid ${tab === t ? '#1d4ed8' : 'transparent'}`,
cursor: ‘pointer’, fontSize: 12, fontWeight: 700,
color: tab === t ? ‘#1d4ed8’ : ‘var(–ink-4)’,
fontFamily: ‘var(–font-sans)’, letterSpacing: ‘0.04em’,
textTransform: ‘uppercase’ as const, marginBottom: -1,
whiteSpace: ‘nowrap’ as const,
})

return (
<div style={{ minHeight: ‘100vh’, background: ‘var(–bg-2)’, fontFamily: ‘var(–font-sans)’ }}>
<Header />

```
  {/* Pro header */}
  <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
    <div className="page-container" style={{ paddingTop: 24, paddingBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em' }}>
            Espaço Clínico — {firstName}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 3 }}>
            {isPro ? `${patients.length} doente${patients.length !== 1 ? 's' : ''} no perfil · Co-piloto IA activo` : 'Upgrade para Pro para activar gestão de doentes'}
          </div>
        </div>
        {isPro && (
          <button onClick={() => { setTab('patients'); setShowAddForm(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo doente
          </button>
        )}
      </div>
      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
        {[['patients', 'Doentes'], ['tools', 'Ferramentas'], ['ai', 'Co-Piloto IA'], ['account', 'Conta']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} style={tabStyle(id)}>{label}</button>
        ))}
      </div>
    </div>
  </div>

  <div className="page-container page-body">

    {/* PATIENTS TAB */}
    {tab === 'patients' && (
      <div>
        {/* ─── NOVO: Os Meus Perfis (pessoais/familiares) ─── */}
        <FamilyProfilesSection accentColor="#1d4ed8" />

        {!isPro ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.01em' }}>Gestão de Doentes</div>
            <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
              Cria perfis clínicos para os teus doentes. O Phlox AI tem contexto completo — patologias, medicação, função renal — e responde em função de cada doente específico.
            </p>
            <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Pro — 12,99€/mês
            </Link>
          </div>
        ) : (
          <div>
            {/* Add patient form */}
            {showAddForm && (
              <div style={{ background: 'white', border: '2px solid #1d4ed8', borderRadius: 10, padding: '18px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Novo doente</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, marginBottom: 10 }}>
                  <input value={newPatient.name} onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))}
                    placeholder="Nome do doente *" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <input value={newPatient.age} onChange={e => setNewPatient(p => ({ ...p, age: e.target.value }))}
                    placeholder="Idade" type="number" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <input value={newPatient.conditions} onChange={e => setNewPatient(p => ({ ...p, conditions: e.target.value }))}
                    placeholder="Diagnósticos (ex: HTA, DM2, FA)" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={addPatient} disabled={!newPatient.name.trim() || adding}
                    style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {adding ? 'A criar...' : 'Criar perfil'}
                  </button>
                  <button onClick={() => setShowAddForm(false)}
                    style={{ background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Patient list */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
              </div>
            ) : patients.length === 0 ? (
              <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 16 }}>Nenhum doente criado ainda.</div>
                <button onClick={() => setShowAddForm(true)}
                  style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Criar primeiro doente →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {patients.map(patient => (
                  <Link key={patient.id} href={`/patients/${patient.id}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: 'white', textDecoration: 'none', gap: 12 }}
                    className="patient-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{patient.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {[patient.age ? `${patient.age} anos` : null, patient.conditions].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {patient.alerts && patient.alerts > 0 ? (
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', background: 'var(--red-light)', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 3 }}>
                          {patient.alerts} alerta{patient.alerts > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{patient.meds_count} med.</span>
                      )}
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )}

    {/* TOOLS TAB */}
    {tab === 'tools' && (
      <div>
        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas clínicas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 8 }}>
          {PRO_TOOLS.map(({ href, label, sub }) => {
            const locked = !isPro && ['strategy', 'protocol', 'review', 'brief'].includes(href.slice(1))
            return (
              <Link key={href} href={locked ? '/pricing' : href}
                style={{ display: 'flex', flexDirection: 'column', padding: '16px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none' }}
                className="pro-tool">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--ink-4)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                  {locked && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, marginLeft: 8 }}>Pro</span>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{sub}</span>
              </Link>
            )
          })}
        </div>
      </div>
    )}

    {/* AI CO-PILOT TAB */}
    {tab === 'ai' && (
      <div style={{ maxWidth: 680 }}>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ background: '#1d4ed8', padding: '18px 22px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Phlox AI · Co-Piloto Clínico</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'white', fontStyle: 'italic', fontWeight: 400 }}>
              Com o contexto dos teus doentes, não em abstracto.
            </div>
          </div>
          <div style={{ padding: '20px 22px' }}>
            <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 20 }}>
              Selecciona um doente antes de abrir o AI. O co-piloto já sabe a idade, diagnósticos, função renal e medicação actual. As respostas são em função daquele doente específico — não genéricas.
            </p>
            {patients.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Abrir AI com doente</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {patients.slice(0, 3).map(p => (
                    <Link key={p.id} href={`/ai?patient=${p.id}`}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, textDecoration: 'none', gap: 10 }}
                      className="patient-ai-btn">
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>{p.conditions || '—'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <Link href="/ai" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: '#1d4ed8', color: 'white', textDecoration: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Abrir Co-Piloto IA →
            </Link>
          </div>
        </div>
      </div>
    )}

<<<<<<< HEAD
      <div className="page-container page-body">

        {/* PATIENTS TAB */}
        {tab === 'patients' && (
          <div>
            {/* ─── NOVO: Os Meus Perfis (pessoais/familiares) ─── */}
            <FamilyProfilesSection accentColor="#1d4ed8" />

            {!isPro ? (
              <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', fontWeight: 400, marginBottom: 14, letterSpacing: '-0.01em' }}>Gestão de Doentes</div>
                <p style={{ fontSize: 14, color: 'var(--ink-4)', lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                  Cria perfis clínicos para os teus doentes. O Phlox AI tem contexto completo — patologias, medicação, função renal — e responde em função de cada doente específico.
                </p>
                <Link href="/pricing" style={{ display: 'inline-flex', background: '#1d4ed8', color: 'white', textDecoration: 'none', padding: '12px 24px', borderRadius: 7, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Pro — 12,99€/mês
                </Link>
              </div>
            ) : (
              <div>
                {/* Add patient form */}
                {showAddForm && (
                  <div style={{ background: 'white', border: '2px solid #1d4ed8', borderRadius: 10, padding: '18px', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14 }}>Novo doente</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr', gap: 8, marginBottom: 10 }}>
                      <input value={newPatient.name} onChange={e => setNewPatient(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nome do doente *" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <input value={newPatient.age} onChange={e => setNewPatient(p => ({ ...p, age: e.target.value }))}
                        placeholder="Idade" type="number" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                      <input value={newPatient.conditions} onChange={e => setNewPatient(p => ({ ...p, conditions: e.target.value }))}
                        placeholder="Diagnósticos (ex: HTA, DM2, FA)" style={{ border: '1.5px solid var(--border)', borderRadius: 7, padding: '10px 13px', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={addPatient} disabled={!newPatient.name.trim() || adding}
                        style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        {adding ? 'A criar...' : 'Criar perfil'}
                      </button>
                      <button onClick={() => setShowAddForm(false)}
                        style={{ background: 'white', color: 'var(--ink-4)', border: '1px solid var(--border)', borderRadius: 7, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Patient list */}
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 8 }} />)}
                  </div>
                ) : patients.length === 0 ? (
                  <div style={{ background: 'white', border: '2px dashed var(--border)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: 'var(--ink-4)', marginBottom: 16 }}>Nenhum doente criado ainda.</div>
                    <button onClick={() => setShowAddForm(true)}
                      style={{ background: '#1d4ed8', color: 'white', border: 'none', borderRadius: 7, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Criar primeiro doente →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    {patients.map(patient => (
                      <Link key={patient.id} href={`/patients/${patient.id}`}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: 'white', textDecoration: 'none', gap: 12 }}
                        className="patient-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 2 }}>{patient.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {[patient.age ? `${patient.age} anos` : null, patient.conditions].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          {patient.alerts && patient.alerts > 0 ? (
                            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--red)', background: 'var(--red-light)', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: 3 }}>
                              {patient.alerts} alerta{patient.alerts > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{patient.meds_count} med.</span>
                          )}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TOOLS TAB */}
        {tab === 'tools' && (
          <div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>Ferramentas clínicas</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))', gap: 8 }}>
              {PRO_TOOLS.map(({ href, label, sub }) => {
                const locked = !isPro && ['strategy', 'protocol', 'review', 'brief'].includes(href.slice(1))
                return (
                  <Link key={href} href={locked ? '/pricing' : href}
                    style={{ display: 'flex', flexDirection: 'column', padding: '16px 18px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none' }}
                    className="pro-tool">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: locked ? 'var(--ink-4)' : 'var(--ink)', letterSpacing: '-0.01em' }}>{label}</span>
                      {locked && <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#1d4ed8', border: '1px solid #bfdbfe', background: '#eff6ff', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, marginLeft: 8 }}>Pro</span>}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ink-5)', fontFamily: 'var(--font-mono)' }}>{sub}</span>
                  </Link>
                )
              })}
=======
    {/* ACCOUNT TAB */}
    {tab === 'account' && (
      <div style={{ maxWidth: 480 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.01em', marginBottom: 20 }}>Conta</h2>
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
          {[{ l: 'Nome', v: user?.name || '—' }, { l: 'Email', v: user?.email || '' }, { l: 'Plano', v: user?.plan || 'Gratuito' }].map(({ l, v }, i, arr) => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ padding: '12px 14px', background: 'var(--bg-2)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center' }}>{l}</div>
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-2)' }}>{v}</div>
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
            </div>
          ))}
        </div>
        {!isPro && (
          <Link href="/pricing" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', background: '#1d4ed8', borderRadius: 10, textDecoration: 'none', marginBottom: 12, color: 'white' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>Upgrade para Pro</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Gestão de doentes, co-piloto IA, relatórios PDF</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        )}
        <ReferralSection />
        <button onClick={signOut} style={{ width: '100%', marginTop: 12, padding: '12px', background: 'white', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--ink-4)', cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }} className="signout-btn">
          Terminar sessão
        </button>
      </div>
    )}
  </div>

  <style>{`
    .patient-row:hover { background: #eff6ff !important; }
    .pro-tool:hover { border-color: #1d4ed8 !important; background: #eff6ff !important; }
    .patient-ai-btn:hover { border-color: #1d4ed8 !important; background: #eff6ff !important; }
    .signout-btn:hover { color: var(--red) !important; border-color: var(--red) !important; }
  `}</style>
</div>
```

)
}

// ─── Main router ──────────────────────────────────────────────────────────────

function DashboardRouter() {
const { user, loading } = useAuth()
const sp = useSearchParams()
const router = useRouter()

const modeParam = sp.get(‘mode’)
const profileType = (user as any)?.profile_type || modeParam || ‘personal’
const plan = (user?.plan || ‘free’) as string

// Determine dashboard to show
const getDashboard = () => {
// URL param overrides
if (modeParam === ‘pro’ || modeParam === ‘professional’) return ‘pro’
if (modeParam === ‘student’) return ‘student’
if (modeParam === ‘personal’) return ‘personal’
// Profile type from onboarding
if (profileType === ‘professional’) return ‘pro’
if (profileType === ‘student’) return ‘student’
// Plan-based fallback
if (plan === ‘pro’ || plan === ‘clinic’) return ‘pro’
return ‘personal’
}

if (loading) return (
<div style={{ minHeight: ‘100vh’, background: ‘var(–bg-2)’, display: ‘flex’, alignItems: ‘center’, justifyContent: ‘center’ }}>
<div className=“skeleton” style={{ width: 300, height: 24, borderRadius: 4 }} />
</div>
)

if (!user) { router.push(’/login’); return null }

const dash = getDashboard()

<<<<<<< HEAD
  const MODE_CONFIG = [
    { mode: 'personal', label: 'Pessoal', icon: '👤', color: 'var(--green)', desc: 'A minha medicação e família' },
    { mode: 'student',  label: 'Estudo',  icon: '📚', color: '#7c3aed',       desc: 'Farmacologia e casos clínicos' },
    { mode: 'pro',      label: 'Clínico', icon: '🏥', color: '#1d4ed8',       desc: 'Co-piloto e doentes' },
  ]

  return (
    <>
      {/* ── Sticky mode bar ── */}
      <div style={{ position: 'sticky', top: 60, zIndex: 90, background: 'var(--ink)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="page-container" style={{ display: 'flex', gap: 0 }}>
          {MODE_CONFIG.map(({ mode, label, icon, color, desc }) => (
            <Link key={mode} href={`/dashboard?mode=${mode}`}
              style={{ display: 'flex', flexDirection: 'column', padding: '10px 20px', textDecoration: 'none', borderBottom: `2px solid ${dash === mode ? color : 'transparent'}`, transition: 'all 0.15s', flexShrink: 0 }}
              className={`mode-tab mode-tab-${mode} ${dash === mode ? 'mode-tab-active' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', color: dash === mode ? 'white' : 'rgba(255,255,255,0.4)', transition: 'color 0.15s' }}>{label}</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-mono)', marginTop: 1, letterSpacing: '0.02em', display: 'none' }} className="mode-tab-desc">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {dash === 'pro' && <ProDashboard />}
      {dash === 'student' && <StudentDashboard />}
      {dash === 'personal' && <PersonalDashboard />}

      <style>{`
        @media (min-width: 640px) { .mode-tab-desc { display: block !important; } .mode-tab { padding: 10px 24px !important; } }
        .mode-tab:hover .mode-tab-desc { color: rgba(255,255,255,0.45) !important; }
      `}</style>
    </>
  )
=======
const MODE_CONFIG = [
{ mode: ‘personal’, label: ‘Pessoal’, icon: ‘👤’, color: ‘var(–green)’, desc: ‘A minha medicação e família’ },
{ mode: ‘student’,  label: ‘Estudo’,  icon: ‘📚’, color: ‘#7c3aed’,       desc: ‘Farmacologia e casos clínicos’ },
{ mode: ‘pro’,      label: ‘Clínico’, icon: ‘🏥’, color: ‘#1d4ed8’,       desc: ‘Co-piloto e doentes’ },
]

return (
<>
{/* ── Sticky mode bar ── */}
<div style={{ position: ‘sticky’, top: 60, zIndex: 90, background: ‘var(–ink)’, borderBottom: ‘1px solid rgba(255,255,255,0.08)’ }}>
<div className=“page-container” style={{ display: ‘flex’, gap: 0 }}>
{MODE_CONFIG.map(({ mode, label, icon, color, desc }) => (
<Link key={mode} href={`/dashboard?mode=${mode}`}
style={{ display: ‘flex’, flexDirection: ‘column’, padding: ‘10px 20px’, textDecoration: ‘none’, borderBottom: `2px solid ${dash === mode ? color : 'transparent'}`, transition: ‘all 0.15s’, flexShrink: 0 }}
className={`mode-tab mode-tab-${mode} ${dash === mode ? 'mode-tab-active' : ''}`}>
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: 6 }}>
<span style={{ fontSize: 13 }}>{icon}</span>
<span style={{ fontSize: 11, fontWeight: 700, fontFamily: ‘var(–font-mono)’, letterSpacing: ‘0.06em’, textTransform: ‘uppercase’, color: dash === mode ? ‘white’ : ‘rgba(255,255,255,0.4)’, transition: ‘color 0.15s’ }}>{label}</span>
</div>
<div style={{ fontSize: 9, color: ‘rgba(255,255,255,0.25)’, fontFamily: ‘var(–font-mono)’, marginTop: 1, letterSpacing: ‘0.02em’, display: ‘none’ }} className=“mode-tab-desc”>{desc}</div>
</Link>
))}
</div>
</div>

```
  {dash === 'pro' && <ProDashboard />}
  {dash === 'student' && <StudentDashboard />}
  {dash === 'personal' && <PersonalDashboard />}

  <style>{`
    @media (min-width: 640px) { .mode-tab-desc { display: block !important; } .mode-tab { padding: 10px 24px !important; } }
    .mode-tab:hover .mode-tab-desc { color: rgba(255,255,255,0.45) !important; }
  `}</style>
</>
```

)
>>>>>>> 6bb00fe3dd6ec37df4b42229e2900012910cf0dc
}

export default function DashboardPage() {
return (
<Suspense fallback={<div style={{ minHeight: ‘100vh’, background: ‘var(–bg-2)’ }} />}>
<DashboardRouter />
</Suspense>
)
}
