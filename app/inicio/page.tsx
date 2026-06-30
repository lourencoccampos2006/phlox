'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { planName } from '@/lib/plans'
import Icon from '@/components/Icon'
import WelcomeTour from '@/components/WelcomeTour'
import HealthAlertsCard from '@/components/HealthAlertsCard'
import { computeHealthAlerts } from '@/lib/healthAlerts'
import { modeTheme, isPremiumMode, type ModeTheme } from '@/lib/modeTheme'
import { homeGreeting, homeSubline, pickFocus, quickActions, type HomeData, type FocusCard } from '@/lib/homeIntelligence'
import { summarize, syncStudyProgress } from '@/lib/studyProgress'
import { useEnabledTools } from '@/lib/useEnabledTools'
import { TOOL_CATEGORIES, PLAN_BADGE, type ToolMode } from '@/lib/toolRegistry'
import { getPins } from '@/lib/pinnedTools'
import { getTopTools } from '@/lib/userPersona'
import { ALL_PERSONAS, personaFor } from '@/lib/userPersona'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { institutionConfig } from '@/lib/institutionConfig'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { useCallback } from 'react'

// ─── /inicio reescrito 2026-06-24 — VIVO e por modo ────────────────────────────
// O Phlox antecipa-se: lê a medicação de hoje, a próxima consulta, os vitais e o
// estudo, e mostra UMA coisa principal certa para agora. Estilo adapta-se a quem
// usa: quente/humano (pessoal, cuidador) · clínico/premium escuro (estudante,
// profissional). Modo clínico mantém o seu hub próprio.

export default function InicioPage() {
  const { user, loading, supabase } = useAuth() as any
  const router = useRouter()
  const expMode: string = user?.experience_mode || 'personal'
  const [mounted, setMounted] = useState(false)
  const [data, setData] = useState<HomeData | null>(null)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
  }, [loading, user, router])

  // ── Carrega os dados reais para a inteligência do início ──
  useEffect(() => {
    if (!user || !supabase || expMode === 'clinical') return
    let cancel = false
    ;(async () => {
      const firstName = user?.name?.split(' ')[0] || ''
      if (expMode === 'student') {
        // Sincroniza o progresso com a conta (cross-device) — best-effort, não bloqueia.
        syncStudyProgress()
        const s = summarize()
        // Cartões de repetição espaçada a rever hoje (sistema SM-2 do servidor).
        let cardsDue = 0
        try {
          const { data: sd } = await supabase.auth.getSession()
          const r = await fetch('/api/study/cards?limit=1', { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
          if (r.ok) { const j = await r.json(); cardsDue = j?.dashboard?.due_today || 0 }
        } catch { /* degrada a 0 */ }
        if (!cancel) setData({
          firstName, medsCount: 0, dosesDueNow: 0, dosesTakenToday: 0, dosesTotalToday: 0,
          studyStreak: s.streak, studyXpToday: s.xpToday, studyGoal: s.dailyGoal,
          weakArea: s.weakAreas[0]?.area || null, cardsDue,
          hasAnyData: s.activeDays.size > 0 || cardsDue > 0,
        })
        return
      }
      // pessoal / cuidador
      const today = new Date().toISOString().slice(0, 10)
      const hour = new Date().getHours()
      try {
        const monthAgo = new Date(Date.now() - 60 * 86400000).toISOString()
        const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
        const [{ data: meds }, { data: logs }, { data: vitals }, { data: appts }, { data: syms }, { data: prof }] = await Promise.all([
          supabase.from('personal_meds').select('name, reminder_times, pills_remaining, pills_per_day').eq('user_id', user.id),
          supabase.from('med_logs').select('id, status').eq('user_id', user.id).gte('date', today).eq('status', 'taken'),
          supabase.from('vitals').select('bp_sys,bp_dia,hr,spo2,glucose,weight,temp,recorded_at').eq('user_id', user.id).gte('recorded_at', monthAgo).order('recorded_at', { ascending: false }).limit(40),
          supabase.from('appointments').select('title, date').eq('user_id', user.id).gte('date', today).order('date').limit(1),
          expMode === 'personal' ? supabase.from('symptom_logs').select('at, pain, temperature, symptoms').eq('user_id', user.id).is('profile_id', null).gte('at', weekAgo).then((r: any) => r, () => ({ data: [] })) : Promise.resolve({ data: [] }),
          expMode === 'personal' ? supabase.from('profiles').select('age, sex, conditions').eq('id', user.id).maybeSingle().then((r: any) => r, () => ({ data: null })) : Promise.resolve({ data: null }),
        ])
        const medList = (meds || []) as { name: string; reminder_times?: string[]; pills_remaining?: number | null; pills_per_day?: number | null }[]
        // tomas de hoje e quantas já passaram da hora (janela) sem registo
        let totalToday = 0, dueNow = 0, nextLabel: string | undefined
        medList.forEach(m => {
          (m.reminder_times || []).forEach(t => {
            totalToday++
            const h = parseInt(String(t).slice(0, 2), 10)
            if (!isNaN(h) && h <= hour) dueNow++
            if (!isNaN(h) && h >= hour && !nextLabel) nextLabel = `${m.name} às ${String(t).slice(0, 5)}`
          })
        })
        const taken = (logs || []).length
        dueNow = Math.max(0, dueNow - taken)
        const vitalRows = (vitals || []) as any[]
        const lastVital = vitalRows[0]?.recorded_at
        const lastVitalDaysAgo = lastVital ? Math.floor((Date.now() - new Date(lastVital).getTime()) / 86400000) : null
        const appt = (appts || [])[0]
        const nextAppt = appt ? { title: appt.title || 'Consulta', inDays: Math.max(0, Math.ceil((new Date(appt.date).getTime() - Date.now()) / 86400000)) } : null

        // PESSOAL: alerta de saúde próprio mais urgente + "a minha semana" (tendências).
        let healthAlert: HomeData['healthAlert'] = null
        let week: HomeData['week'] = null
        if (expMode === 'personal') {
          const totalSlots = medList.reduce((n, m) => n + (m.reminder_times?.length || 0), 0)
          const adherencePct = totalSlots > 0 ? Math.round((taken / totalSlots) * 100) : null
          const out = computeHealthAlerts({
            meds: medList.map(m => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
            age: (prof as any)?.age ?? null, sex: (prof as any)?.sex ?? null, conditions: (prof as any)?.conditions ?? null,
            vitalSeries: vitalRows, symptoms: (syms || []) as any[], adherencePct,
          })
          const top = out[0]
          if (top) healthAlert = { level: top.level, title: top.title, detail: top.detail, href: top.href || '/inicio', cta: top.cta }
          // Tendências para a "história da semana".
          const weights = vitalRows.filter(v => v.weight != null)
          const weightDelta = weights.length >= 2 ? Math.round((weights[0].weight - weights[weights.length - 1].weight) * 10) / 10 : null
          const bps = vitalRows.filter(v => v.bp_sys != null)
          let bpTrend: 'up' | 'down' | 'flat' | null = null
          if (bps.length >= 2) { const diff = bps[0].bp_sys - bps[bps.length - 1].bp_sys; bpTrend = diff <= -5 ? 'down' : diff >= 5 ? 'up' : 'flat' }
          const symWeek = ((syms || []) as any[]).length
          if (weights.length || bps.length || adherencePct != null || symWeek) {
            week = { weightDelta, bpTrend, adherencePct, vitalsCount: vitalRows.length, symptomsCount: symWeek }
          }
        }

        // CUIDADOR: o alerta de vigilância mais urgente de um familiar (o "Anjo da
        // Guarda" a antecipar-se). Lê o ledger family_alerts; degrada a null.
        let caregiverAlert: HomeData['caregiverAlert'] = null
        if (expMode === 'caregiver') {
          const rank: Record<string, number> = { critical: 4, major: 3, moderate: 2, minor: 1, info: 0 }
          const fa = await supabase.from('family_alerts')
            .select('profile_id, title, detail, severity')
            .eq('user_id', user.id).is('dismissed_at', null)
            .order('created_at', { ascending: false }).limit(12)
            .then((r: any) => (r.data || []).sort((a: any, b: any) => (rank[b.severity] || 0) - (rank[a.severity] || 0))[0], () => null)
          if (fa) {
            const { data: pr } = await supabase.from('family_profiles').select('name').eq('id', fa.profile_id).maybeSingle()
            caregiverAlert = { who: (pr?.name || 'Familiar').split(' ')[0], title: fa.title, detail: fa.detail, href: '/familia' }
          }
        }
        if (!cancel) setData({
          firstName, medsCount: medList.length,
          dosesDueNow: dueNow, dosesTakenToday: taken, dosesTotalToday: totalToday, nextDoseLabel: nextLabel,
          lastVitalDaysAgo, nextAppt, caregiverAlert, healthAlert, week,
          hasAnyData: medList.length > 0 || !!lastVital || !!appt || !!caregiverAlert || !!healthAlert,
        })
      } catch {
        if (!cancel) setData({ firstName, medsCount: 0, dosesDueNow: 0, dosesTakenToday: 0, dosesTotalToday: 0, hasAnyData: false })
      }
    })()
    return () => { cancel = true }
  }, [user, supabase, expMode])

  const plan = (user?.plan as string) || 'free'
  const clinicalAllowed = plan === 'pro' || plan === 'clinic'

  if (loading || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MODO CLÍNICO — paywall ou hub próprio ──
  if (expMode === 'clinical') {
    if (!clinicalAllowed) return <ClinicalPaywall plan={plan} />
    return <ClinicalHub name={user?.name?.split(' ')[0] || ''} />
  }

  const t = modeTheme(expMode)
  const premium = isPremiumMode(expMode)
  // Enquanto carrega os dados, usa um estado neutro para não piscar.
  const d: HomeData = data || { firstName: user?.name?.split(' ')[0] || '', medsCount: 0, dosesDueNow: 0, dosesTakenToday: 0, dosesTotalToday: 0, hasAnyData: true }
  const focus = pickFocus(expMode, d)
  const actions = quickActions(expMode)
  const greeting = mounted ? homeGreeting(d.firstName) : 'Olá'
  const subline = mounted ? homeSubline(expMode, d) : ''

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink, transition: 'background 0.3s' }}>
      <WelcomeTour mode={expMode} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>

        {/* Saudação + troca de modo (compacta) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: t.greetWarm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 'clamp(26px,6.5vw,32px)', fontWeight: t.greetWarm ? 400 : 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.12, color: t.ink }}>
              {greeting}.
            </h1>
            <p style={{ fontSize: 'clamp(15px,4vw,16.5px)', color: t.inkSoft, margin: '7px 0 0', fontWeight: 500 }}>{subline}</p>
          </div>
          <ModeChip theme={t} />
        </div>

        {/* ── O FOCO — a única coisa que importa agora ── */}
        <FocusHero focus={focus} theme={t} loading={!data} />

        {/* ── Avisos proativos de saúde (determinístico, grátis no pessoal) ── */}
        {(expMode === 'personal' || expMode === 'caregiver') && <HealthAlertsCard />}

        {/* ── A minha saúde esta semana (tendências reais) ── */}
        {expMode === 'personal' && <WeekStory data={d} loading={!data} theme={t} />}

        {/* ── Atalhos fixos do utilizador (pins) ── */}
        <PinnedRow theme={t} />

        {/* ── O que mais usa (aprende sozinho) ── */}
        <TopToolsRow theme={t} />

        {/* ── Ações sempre à mão ── */}
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 11, paddingLeft: 2 }}>
            {expMode === 'student' ? 'Estudar' : 'O que precisa'}
          </div>
          <div className="ini-actions">
            {actions.map(a => (
              <Link key={a.href + a.label} href={a.href} className="ini-action" style={{ background: t.surface, borderColor: t.border }}>
                <span className="ini-action-ic" style={{ background: t.accentSoft, color: t.accent }}>
                  <Icon name={a.icon} size={22} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{a.label}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint, marginTop: 1 }}>{a.sub}</span>
                </span>
                <Icon name="chevron" size={17} color={t.inkFaint} />
              </Link>
            ))}
          </div>
        </div>

        {/* ── TODAS as ferramentas do modo, por categoria (expansível) ── */}
        <AllToolsSection mode={expMode as ToolMode} theme={t} />

        {/* ── Momento difícil — só modos de cuidado ── */}
        {(expMode === 'personal' || expMode === 'caregiver') && (
          <Link href="/comecar" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', marginTop: 14, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: t.radius, textDecoration: 'none' }}>
            <span style={{ fontSize: 19, flexShrink: 0 }}>🤍</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: t.ink }}>A passar por um momento difícil?</span>
              <span style={{ display: 'block', fontSize: 12, color: t.inkFaint, marginTop: 1 }}>Alta do hospital, diagnóstico novo, cuidar de alguém — começamos consigo.</span>
            </span>
          </Link>
        )}

        {/* ── Pé discreto ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <Link href="/settings" style={{ fontSize: 13, color: t.inkFaint, textDecoration: 'none', fontWeight: 600 }}>Definições</Link>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 20, textDecoration: 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan === 'free' ? t.inkFaint : t.accent }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.inkSoft }}>Plano {planName(user?.plan)}</span>
          </Link>
        </div>
      </div>

      <style>{`
        .ini-actions { display: grid; grid-template-columns: 1fr; gap: 9px; }
        .ini-action {
          display: flex; align-items: center; gap: 13px; text-decoration: none;
          border: 1px solid; border-radius: ${t.radius}px; padding: 14px 15px;
          transition: transform 0.12s, box-shadow 0.16s;
        }
        .ini-action:active { transform: scale(0.99); }
        .ini-action-ic { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pin-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
        .pin-cell { display: flex; flex-direction: column; align-items: center; gap: 7px; padding: 13px 6px; border: 1px solid; border-radius: ${t.radius}px; text-decoration: none; transition: transform 0.12s; }
        .pin-cell:active { transform: scale(0.97); }
        @media (min-width: 620px) {
          .ini-actions { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ini-action:hover { box-shadow: 0 6px 20px rgba(0,0,0,${premium ? '0.4' : '0.06'}); }
          .pin-row { grid-template-columns: repeat(6, 1fr); }
        }
      `}</style>
    </div>
  )
}

// ─── Troca de modo (chip compacto, abre menu) ──────────────────────────────────
function ModeChip({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const current = personaFor(user.experience_mode)
  async function switchTo(mode: string) {
    if (mode === user.experience_mode) { setOpen(false); return }
    setBusy(true)
    await supabase.from('profiles').update({ experience_mode: mode }).eq('id', user.id)
    setOpen(false); setTimeout(() => location.reload(), 300)
  }
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Mudar de modo" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', cursor: 'pointer',
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: 999, fontFamily: 'var(--font-sans)',
        fontSize: 12.5, fontWeight: 700, color: t.inkSoft,
      }}>
        <span style={{ fontSize: 14 }}>{current.emoji}</span>
        <span className="modechip-label">{current.label}</span>
        <Icon name="chevron" size={12} color={t.inkFaint} style={{ transform: open ? 'rotate(90deg)' : 'rotate(90deg) scaleX(-1)' }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
          <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 80, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 14, boxShadow: '0 16px 44px -12px rgba(8,12,24,0.35)', minWidth: 260, padding: 6 }}>
            <div style={{ padding: '6px 10px 8px', fontSize: 10.5, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Mudar de modo</div>
            {ALL_PERSONAS.map(p => {
              const active = p.mode === current.mode
              return (
                <button key={p.mode} onClick={() => switchTo(p.mode)} disabled={busy} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 11, width: '100%', textAlign: 'left',
                  padding: '10px 11px', border: 'none', borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
                  background: active ? p.color + '1a' : 'transparent', fontFamily: 'var(--font-sans)',
                }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: p.color + '22', color: p.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{p.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: t.ink }}>{p.label}{active && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: p.color }}>● ATUAL</span>}</span>
                    <span style={{ display: 'block', fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{p.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
      <style>{`@media (max-width: 400px) { .modechip-label { display: none; } }`}</style>
    </div>
  )
}

// ─── Atalhos fixos (pins do utilizador) ────────────────────────────────────────
const PIN_ICON: Record<string, string> = {
  '/mymeds': 'pill', '/scan': 'camera', '/interactions': 'shield', '/ai': 'spark',
  '/familia': 'family', '/vitals': 'heart', '/saude-agora': 'heart', '/sintomas': 'heart',
  '/arena': 'trophy', '/study': 'cards', '/tutor': 'spark', '/labs': 'search',
  '/medicamento': 'question', '/timeline': 'calendar', '/preparar-consulta': 'calendar',
}
function PinnedRow({ theme: t }: { theme: ModeTheme }) {
  const [pins, setPins] = useState<{ path: string; label: string }[]>([])
  useEffect(() => {
    import('@/lib/pinnedTools').then(({ PINNABLE_TOOLS }) => {
      const ids = getPins()
      setPins(ids.map(p => PINNABLE_TOOLS.find(x => x.path === p)).filter(Boolean).map((x: any) => ({ path: x.path, label: x.label })))
    })
  }, [])
  if (pins.length === 0) return null
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Os meus atalhos</span>
        <Link href="/tudo" style={{ fontSize: 11.5, fontWeight: 700, color: t.accent, textDecoration: 'none' }}>Editar</Link>
      </div>
      <div className="pin-row">
        {pins.map(p => (
          <Link key={p.path} href={p.path} className="pin-cell" style={{ background: t.surface, borderColor: t.border }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={PIN_ICON[p.path] || 'grid'} size={20} /></span>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.inkSoft, textAlign: 'center', lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ─── O que mais usa (aprende localmente) ───────────────────────────────────────
const TOP_LABELS: Record<string, { label: string; icon: string }> = {
  '/mymeds': { label: 'Comprimidos', icon: 'pill' }, '/familia': { label: 'Família', icon: 'family' },
  '/interactions': { label: 'Interações', icon: 'shield' }, '/sintomas': { label: 'Sintomas', icon: 'heart' },
  '/scan': { label: 'Foto à receita', icon: 'camera' }, '/medicamento': { label: 'Medicamento', icon: 'question' },
  '/ai': { label: 'Perguntar', icon: 'spark' }, '/vitals': { label: 'Tensão e peso', icon: 'heart' },
  '/labs': { label: 'Análises', icon: 'search' }, '/arena': { label: 'Arena', icon: 'trophy' },
  '/study': { label: 'Estudar', icon: 'cards' }, '/tutor': { label: 'Tutor', icon: 'spark' },
}
function TopToolsRow({ theme: t }: { theme: ModeTheme }) {
  const [paths, setPaths] = useState<string[]>([])
  useEffect(() => { setPaths(getTopTools(8).filter(p => TOP_LABELS[p])) }, [])
  if (paths.length < 2) return null
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 11 }}>O que mais usa</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {paths.slice(0, 5).map(p => {
          const m = TOP_LABELS[p]
          return (
            <Link key={p} href={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 999, textDecoration: 'none', fontSize: 13, color: t.inkSoft, fontWeight: 600 }}>
              <Icon name={m.icon} size={16} color={t.accent} />{m.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── TODAS as ferramentas do modo, por categoria — acesso completo, calmo ───────
function AllToolsSection({ mode, theme: t }: { mode: ToolMode; theme: ModeTheme }) {
  const { enabledTools } = useEnabledTools(mode)
  const [expanded, setExpanded] = useState(false)
  const cats = Object.keys(TOOL_CATEGORIES).filter(c => enabledTools.some(tt => tt.category === c))
  if (enabledTools.length === 0) return (
    <Link href="/tudo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '15px', marginTop: 18, border: `1.5px solid ${t.border}`, borderRadius: t.radius, textDecoration: 'none', color: t.inkSoft, fontSize: 14.5, fontWeight: 700 }}>
      <Icon name="grid" size={18} color={t.inkSoft} />Ver tudo o que o Phlox faz
    </Link>
  )
  return (
    <div style={{ marginTop: 22 }} data-tour="all">
      <button onClick={() => setExpanded(e => !e)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 9,
        padding: '14px 16px', background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: t.radius,
        cursor: 'pointer', fontFamily: 'var(--font-sans)', color: t.inkSoft, fontSize: 14.5, fontWeight: 700,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><Icon name="grid" size={18} color={t.accent} />Todas as ferramentas</span>
        <Icon name="chevron" size={17} color={t.inkFaint} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {cats.map(cat => {
            const meta = TOOL_CATEGORIES[cat]
            const items = enabledTools.filter(tt => tt.category === cat)
            return (
              <div key={cat} style={{ marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9, padding: '0 2px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color }} />
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{meta.label}</span>
                </div>
                <div className="ini-actions">
                  {items.map(tool => {
                    const badge = PLAN_BADGE[tool.plan]
                    return (
                      <Link key={tool.id} href={tool.id} className="ini-action" style={{ background: t.surface, borderColor: t.border }}>
                        <span className="ini-action-ic" style={{ background: meta.color + '18', color: meta.color }}><Icon name={PIN_ICON[tool.id] || 'grid'} size={20} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{tool.label}</span>
                            {badge && <span style={{ fontSize: 9, fontWeight: 800, color: badge.color, background: badge.bg, padding: '1px 6px', borderRadius: 4 }}>{badge.label}</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
                        </span>
                        <Icon name="chevron" size={16} color={t.inkFaint} />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <Link href="/tudo" style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: 13, fontWeight: 700, color: t.accent, textDecoration: 'none' }}>Ver catálogo completo →</Link>
        </div>
      )}
    </div>
  )
}

// ─── O FOCO PRINCIPAL — hero vivo, com gradiente do modo ───────────────────────
function FocusHero({ focus, theme: t, loading }: { focus: FocusCard; theme: ModeTheme; loading: boolean }) {
  const urgent = focus.kind === 'urgent'
  return (
    <Link href={focus.href} data-tour="focus" style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${t.heroFrom}, ${t.heroTo})`,
        borderRadius: t.radiusLg, padding: '22px 22px 20px',
        boxShadow: `0 14px 40px -12px ${t.heroFrom}66`,
        opacity: loading ? 0.85 : 1, transition: 'opacity 0.3s',
      }}>
        {/* brilho decorativo subtil */}
        <div style={{ position: 'absolute', top: -40, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(8px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={focus.icon} size={22} color="white" />
            </span>
            {urgent && <span style={{ fontSize: 10.5, fontWeight: 800, color: 'white', background: 'rgba(255,255,255,0.22)', padding: '3px 9px', borderRadius: 999, letterSpacing: '0.04em' }}>AGORA</span>}
          </div>
          <div style={{ fontSize: 'clamp(19px,5vw,22px)', fontWeight: 800, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{focus.title}</div>
          {focus.sub && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.88)', marginTop: 6, lineHeight: 1.5 }}>{focus.sub}</div>}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, background: 'white', color: t.heroFrom, padding: '10px 18px', borderRadius: 999, fontSize: 14.5, fontWeight: 800 }}>
            {focus.cta}
            <Icon name="chevron" size={16} color={t.heroFrom} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── "A minha saúde esta semana" — síntese determinística de tendências ────────
function WeekStory({ data: d, loading, theme: t }: { data: HomeData; loading: boolean; theme: ModeTheme }) {
  const w = d.week
  if (loading || !w) return null
  // Constrói os "chips" só com o que houver dados.
  const chips: { label: string; tone: 'good' | 'warn' | 'neutral' }[] = []
  if (w.weightDelta != null && Math.abs(w.weightDelta) >= 0.3)
    chips.push({ label: `Peso ${w.weightDelta < 0 ? '↓' : '↑'}${Math.abs(w.weightDelta)} kg`, tone: 'neutral' })
  if (w.bpTrend === 'down') chips.push({ label: 'Tensão a melhorar', tone: 'good' })
  else if (w.bpTrend === 'up') chips.push({ label: 'Tensão a subir', tone: 'warn' })
  if (w.adherencePct != null) chips.push({ label: `Medicação ${w.adherencePct}%`, tone: w.adherencePct >= 80 ? 'good' : w.adherencePct >= 50 ? 'neutral' : 'warn' })
  if (w.symptomsCount && w.symptomsCount > 0) chips.push({ label: `${w.symptomsCount} registo${w.symptomsCount > 1 ? 's' : ''} de sintomas`, tone: 'neutral' })
  if (chips.length === 0) return null

  const TONE: Record<string, { c: string; bg: string; b: string }> = {
    good: { c: '#15803d', bg: '#f0fdf4', b: '#bbf7d0' },
    warn: { c: '#b45309', bg: '#fffbeb', b: '#fde68a' },
    neutral: { c: '#475569', bg: '#f8fafc', b: '#e2e8f0' },
  }
  return (
    <Link href="/relatorio" style={{ textDecoration: 'none', display: 'block', marginTop: 14 }}>
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: '15px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: t.ink }}>A minha saúde esta semana</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>Ver detalhe →</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {chips.map((c, i) => {
            const s = TONE[c.tone]
            return <span key={i} style={{ fontSize: 12.5, fontWeight: 700, color: s.c, background: s.bg, border: `1px solid ${s.b}`, borderRadius: 8, padding: '5px 11px' }}>{c.label}</span>
          })}
        </div>
      </div>
    </Link>
  )
}

// ─── Modo clínico: paywall ──────────────────────────────────────────────────────
function ClinicalPaywall({ plan }: { plan: string }) {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 'min(460px,100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px', textAlign: 'center', boxShadow: '0 12px 50px rgba(8,12,24,0.08)' }}>
        <div style={{ fontSize: 34, marginBottom: 12 }}>🏥</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Espaço clínico</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, margin: '0 0 10px' }}>O modo clínico é para profissionais e instituições</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>O painel da instituição, a ronda, o MAR, a vigilância de utentes e os relatórios fazem parte dos planos Pro e Institucional. O seu plano atual é {planName(plan)}.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href="/pricing" style={{ padding: '13px 18px', background: '#1d4ed8', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Ver planos Pro e Institucional</Link>
          <Link href="/settings" style={{ padding: '11px', background: 'none', color: 'var(--ink-4)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Mudar de modo nas Definições</Link>
        </div>
      </div>
    </div>
  )
}

// ─── Modo clínico: hub premium escuro ───────────────────────────────────────────
// Hub clínico VIVO e por instituição. Lê do blueprint (vocabulário e ferramentas
// certas para o tipo) e mostra um resumo do dia em tempo real (org-scoped), em vez
// de uma lista estática genérica. O cockpit completo fica a um toque.
function ClinicalHub({ name }: { name: string }) {
  const { user, supabase } = useAuth() as any
  const { institution } = useClinicPrefs()
  const scope = useOrgScope()
  const t = modeTheme('clinical')
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)
  const today = new Date().toISOString().slice(0, 10)

  const [snap, setSnap] = useState<{ people: number; logged: number; doses: number; alerts: number } | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const [p, care, mar, inc] = await Promise.all([
      scope.filter(supabase.from('patients').select('id', { count: 'exact', head: true }).eq('active', true)),
      scope.filter(supabase.from('care_records').select('patient_id')).eq('date', today),
      scope.filter(supabase.from('mar_records').select('status')).eq('date', today),
      scope.filter(supabase.from('incidents').select('id', { count: 'exact', head: true }).eq('status', 'open')),
    ])
    const logged = new Set((care.data || []).map((r: any) => r.patient_id)).size
    const doses = (mar.data || []).filter((m: any) => m.status === 'administered' || m.status === 'taken' || m.status === 'given').length
    setSnap({ people: p.count || 0, logged, doses, alerts: inc.count || 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, table: ['patients', 'care_records', 'mar_records', 'incidents'], filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  const firstName = name
  const greetLead = bp.greetingLead(firstName)
  // ações = núcleo do blueprint (já com vocabulário certo) + atalhos transversais
  const actions = [
    { href: '/painel', icon: 'grid', title: 'Abrir o painel', desc: `${bp.productName} ao vivo` },
    ...bp.coreTools.map(tool => ({ href: tool.href, icon: iconForTool(tool.icon), title: tool.label, desc: tool.hint })),
  ]

  const stats = snap ? [
    { n: snap.people, l: cfg.personNounPlural },
    { n: snap.logged, l: 'com registo hoje' },
    { n: snap.doses, l: 'tomas dadas' },
    { n: snap.alerts, l: 'a vigiar', alert: snap.alerts > 0 },
  ] : []

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 16px 44px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 6 }}>{bp.productName}</div>
        <h1 style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em', color: t.ink }}>{greetLead}</h1>
        <p style={{ color: t.inkSoft, fontSize: 14, marginBottom: 20 }}>{bp.tagline}</p>

        {/* Resumo do dia — ao vivo */}
        <Link href="/painel" style={{ display: 'block', textDecoration: 'none', background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: '16px 18px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>O dia de hoje</div>
          {!snap ? (
            <div style={{ color: t.inkFaint, fontSize: 13 }}>A carregar…</div>
          ) : (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {stats.map(s => (
                <div key={s.l}>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: (s as any).alert ? '#f87171' : t.ink }}>{s.n}</div>
                  <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 4, fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </Link>

        <div style={{ fontSize: 11, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 11, paddingLeft: 2 }}>Por onde começar</div>
        <div className="clin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {actions.map(tool => (
            <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 13, background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: 15 }}>
              <span style={{ width: 42, height: 42, borderRadius: 12, background: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={tool.icon} size={22} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: t.ink }}>{tool.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint }}>{tool.desc}</span>
              </span>
            </Link>
          ))}
        </div>
        <style>{`@media (min-width: 700px) { .clin-grid { grid-template-columns: 1fr 1fr !important; } }`}</style>
      </div>
    </div>
  )
}

// Mapeia o emoji do blueprint para um ícone do nosso set (fallback p/ grid).
function iconForTool(emoji: string): string {
  const map: Record<string, string> = {
    '🧑‍🤝‍🧑': 'family', '💊': 'pill', '📝': 'book', '👨‍👩‍👧': 'family', '🔄': 'spark',
    '⚠️': 'shield', '📐': 'check', '🩺': 'check', '🏪': 'grid', '📦': 'grid', '🔍': 'search', '📅': 'calendar',
  }
  return map[emoji] || 'grid'
}
