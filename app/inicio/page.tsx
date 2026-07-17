'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { planName } from '@/lib/plans'
import Icon from '@/components/Icon'
import WelcomeTour from '@/components/WelcomeTour'
import { computeHealthAlerts } from '@/lib/healthAlerts'
import { modeTheme, isPremiumMode, type ModeTheme } from '@/lib/modeTheme'
import { homeGreeting, homeSubline, pickFocus, quickActions, type HomeData, type FocusCard, type QuickAction } from '@/lib/homeIntelligence'
import { summarize, syncStudyProgress } from '@/lib/studyProgress'
import { getPins, setPins as persistPins, PINNABLE_TOOLS } from '@/lib/pinnedTools'
import PinPickerModal from '@/components/PinPickerModal'
import { ALL_PERSONAS, personaFor } from '@/lib/userPersona'
import { getNavForMode, type NavCategory } from '@/lib/navigation'
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

  // REDESIGN 2026-07-17 — não há mais uma página /tudo separada. "Para ti" e
  // "Tudo o que o Phlox faz" são duas VISTAS da mesma página, trocadas por um
  // botão grande (não um menu escondido) — para ninguém, incluindo pessoas
  // menos à vontade com tecnologia, precisar de descobrir uma página à parte.
  // Fica na URL (?ver=tudo) para ser possível voltar atrás/partilhar/marcar.
  const [view, setView] = useState<'para-ti' | 'tudo'>('para-ti')
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URLSearchParams(window.location.search).get('ver') === 'tudo') setView('tudo')
  }, [])
  function changeView(v: 'para-ti' | 'tudo') {
    setView(v)
    router.replace(v === 'tudo' ? '/inicio?ver=tudo' : '/inicio', { scroll: false })
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

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
          // REDESIGN 2026-07-17: agora também para cuidador — "a tua própria
          // saúde" deixou de depender de um HealthAlertsCard separado com o
          // seu próprio fetch (fazia esta MESMA pergunta 2x e mostrava o
          // mesmo alerta 2x, no foco E num cartão à parte).
          (expMode === 'personal' || expMode === 'caregiver') ? supabase.from('symptom_logs').select('at, pain, temperature, symptoms').eq('user_id', user.id).is('profile_id', null).gte('at', weekAgo).then((r: any) => r, () => ({ data: [] })) : Promise.resolve({ data: [] }),
          // idade/sexo/condições do próprio: o profiles NÃO tem estas colunas
          // (dava 400 em toda a home). Fica null; o motor de alertas trata disso. (Ronda 11)
          Promise.resolve({ data: null }),
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

        // "A tua saúde": alerta próprio mais urgente + os restantes + "a minha
        // semana" (tendências). REDESIGN 2026-07-17: computado uma única vez
        // aqui (antes: /inicio calculava o topo para o foco E o
        // HealthAlertsCard recalculava tudo outra vez, do zero, só para
        // mostrar por baixo — o mesmo alerta aparecia 2x, em sítios diferentes).
        let healthAlert: HomeData['healthAlert'] = null
        let moreHealthAlerts: HomeData['moreHealthAlerts'] = []
        let week: HomeData['week'] = null
        if (expMode === 'personal' || expMode === 'caregiver') {
          const totalSlots = medList.reduce((n, m) => n + (m.reminder_times?.length || 0), 0)
          const adherencePct = totalSlots > 0 ? Math.round((taken / totalSlots) * 100) : null
          const out = computeHealthAlerts({
            meds: medList.map(m => ({ name: m.name, pills_remaining: m.pills_remaining, pills_per_day: m.pills_per_day })),
            age: (prof as any)?.age ?? null, sex: (prof as any)?.sex ?? null, conditions: (prof as any)?.conditions ?? null,
            vitalSeries: vitalRows, symptoms: (syms || []) as any[], adherencePct,
          })
          // Em modo pessoal, o 1º alerta grave pode virar o FOCO principal
          // (pickFocus) — não o repetimos na tira secundária. Em modo cuidador
          // nenhum alerta próprio vira foco (o familiar tem prioridade), por
          // isso aqui vão todos.
          if (expMode === 'personal') {
            const top = out[0]
            if (top) healthAlert = { level: top.level, title: top.title, detail: top.detail, href: top.href || '/inicio', cta: top.cta }
            moreHealthAlerts = out.slice(1, 4)
          } else {
            moreHealthAlerts = out.slice(0, 3)
          }
          // Tendências para a "história da semana" (só pessoal — em modo
          // cuidador o foco é a saúde de quem se cuida, não a própria semana).
          if (expMode === 'personal') {
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
        // CUIDADOR: sobrecarga do próprio cuidador (item B13 da auditoria) — a
        // avaliação Zarit-12 mais recente feita a QUALQUER familiar, só se for
        // moderada/grave e recente (<30 dias). Sinal de burnout mais direto que
        // existe (auto-relatado), não telemetria nova de engagement.
        let caregiverBurdenAlert: HomeData['caregiverBurdenAlert'] = null
        if (expMode === 'caregiver') {
          const { data: bc } = await supabase.from('caregiver_burden_checks')
            .select('profile_id, band, total_score, created_at')
            .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          if (bc && (bc.band === 'sobrecarga_moderada' || bc.band === 'sobrecarga_grave')) {
            const daysOld = Math.floor((Date.now() - new Date(bc.created_at).getTime()) / 86400000)
            if (daysOld <= 30) {
              const { data: pr } = await supabase.from('family_profiles').select('name').eq('id', bc.profile_id).maybeSingle()
              caregiverBurdenAlert = {
                profileName: (pr?.name || 'um familiar').split(' ')[0],
                band: bc.band,
                label: bc.band === 'sobrecarga_grave' ? 'Sobrecarga grave' : 'Sobrecarga moderada',
                advice: bc.band === 'sobrecarga_grave'
                  ? 'Falar com o médico de família, assistente social ou serviço de cuidados paliativos pode fazer diferença real.'
                  : 'Vale a pena procurar pequenas pausas regulares e identificar tarefas que possa delegar.',
              }
            }
          }
        }
        if (!cancel) setData({
          firstName, medsCount: medList.length,
          dosesDueNow: dueNow, dosesTakenToday: taken, dosesTotalToday: totalToday, nextDoseLabel: nextLabel,
          lastVitalDaysAgo, nextAppt, caregiverAlert, caregiverBurdenAlert, healthAlert, moreHealthAlerts, week,
          hasAnyData: medList.length > 0 || !!lastVital || !!appt || !!caregiverAlert || !!healthAlert,
        })
      } catch {
        if (!cancel) setData({ firstName, medsCount: 0, dosesDueNow: 0, dosesTakenToday: 0, dosesTotalToday: 0, hasAnyData: false })
      }
    })()
    return () => { cancel = true }
  }, [user, supabase, expMode])

  const plan = (user?.plan as string) || 'free'
  // Acesso ao modo clínico por PLANO (pro/clinic) OU por PERTENÇA a uma
  // organização. Um funcionário convidado fica no plano free (limites grátis
  // FORA da instituição) mas, como é membro da org, tem o modo clínico e tudo o
  // que a instituição tem. Espelha getUserPlan no servidor.
  const inOrg = !!(user?.active_org_id || user?.org_id || user?.org_role)
  const clinicalAllowed = plan === 'pro' || plan === 'clinic' || inOrg

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

        {/* ── Trocar de vista — GRANDE e claro, não um menu escondido ── */}
        <ViewToggle view={view} onChange={changeView} theme={t} />

        {view === 'para-ti' ? (
          <>
            {/* ── O FOCO — a única coisa que importa agora ── */}
            <FocusHero focus={focus} theme={t} loading={!data} />

            {/* ── A tua saúde (alertas restantes + tendências da semana, 1 só cartão) ── */}
            {(expMode === 'personal' || expMode === 'caregiver') && <HealthStrip data={d} loading={!data} theme={t} />}

            {/* ── Atalhos — os teus fixados + os essenciais do modo, uma lista só ── */}
            <ShortcutsSection mode={expMode} actions={actions} theme={t} />

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
          </>
        ) : (
          /* ── TUDO O QUE O PHLOX FAZ — antes era a página /tudo à parte;
              agora é só uma vista aqui, com pesquisa e tudo por categoria. ── */
          <TudoView mode={expMode} theme={t} />
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
        @media (min-width: 620px) {
          .ini-actions { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ini-action:hover { box-shadow: 0 6px 20px rgba(0,0,0,${premium ? '0.4' : '0.06'}); }
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

// ─── Atalhos — REDESIGN 2026-07-17 ──────────────────────────────────────────────
// Antes havia TRÊS listas de atalhos empilhadas (pins fixados, "o que mais usa"
// aprendido sozinho, e as ações fixas do modo) em DOIS estilos visuais
// diferentes (grelha de ícones vs. lista) — a fonte mais citada de "confuso".
// Agora é uma lista só: os teus pins primeiro (se tiveres), a preencher o resto
// com os essenciais do modo que ainda não tenhas fixado. "O que mais usa"
// (aprendido sozinho) saiu — era o menos legível dos três e duplicava o que os
// pins/essenciais já cobrem.
const PIN_ICON: Record<string, string> = {
  '/mymeds': 'pill', '/scan': 'camera', '/interactions': 'shield', '/ai': 'spark',
  '/familia': 'family', '/vitals': 'heart', '/saude-agora': 'heart', '/sintomas': 'heart',
  '/arena': 'trophy', '/study': 'cards', '/tutor': 'spark', '/labs': 'search',
  '/medicamento': 'question', '/timeline': 'calendar',
}
const SHORTCUTS_MAX = 6

function ShortcutsSection({ mode, actions, theme: t }: { mode: string; actions: QuickAction[]; theme: ModeTheme }) {
  const [pinIds, setPinIds] = useState<string[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => { setPinIds(getPins()) }, [])

  function togglePin(path: string) {
    setPinIds(prev => {
      const cur = prev || []
      const next = cur.includes(path) ? cur.filter(p => p !== path) : [...cur, path].slice(0, 6)
      persistPins(next)
      return next
    })
  }

  if (pinIds === null) return <div className="skeleton" style={{ height: 160, borderRadius: 12, marginTop: 22 }} />

  const pins = pinIds
    .map(id => PINNABLE_TOOLS.find(x => x.path === id))
    .filter(Boolean)
    .map((x: any) => ({ href: x.path, icon: PIN_ICON[x.path] || 'grid', label: x.label, sub: 'Fixado por ti' }))
  const seen = new Set(pins.map(p => p.href))
  const combined = [...pins, ...actions.filter(a => !seen.has(a.href))].slice(0, SHORTCUTS_MAX)

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11, paddingLeft: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {mode === 'student' ? 'Estudar' : 'Atalhos'}
        </span>
        {/* REDESIGN 2026-07-17: antes ligava a /tudo, que nunca teve edição de
            pins nenhuma (link morto). Abre agora o mesmo seletor usado em
            /settings — "personalizado nas definições", sem sair da página. */}
        <button onClick={() => setPickerOpen(true)} style={{ fontSize: 11.5, fontWeight: 700, color: t.accent, textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Personalizar</button>
      </div>
      <PinPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} pins={pinIds} onToggle={togglePin} />
      <div className="ini-actions">
        {combined.map(a => (
          <Link key={a.href} href={a.href} className="ini-action" style={{ background: t.surface, borderColor: t.border }}>
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
  )
}

// ─── Trocar de vista — REDESIGN 2026-07-17 ──────────────────────────────────────
// Botão grande, sempre visível, com os DOIS destinos escritos por extenso (não
// um ícone sozinho nem um menu escondido) — para uma pessoa idosa ou pouco à
// vontade com tecnologia perceber ao primeiro olhar que há duas formas de ver
// esta página, sem ter de descobrir nada.
function ViewToggle({ view, onChange, theme: t }: { view: 'para-ti' | 'tudo'; onChange: (v: 'para-ti' | 'tudo') => void; theme: ModeTheme }) {
  const opt = (v: 'para-ti' | 'tudo', label: string) => {
    const active = view === v
    return (
      <button onClick={() => onChange(v)} style={{
        flex: 1, padding: '13px 10px', border: 'none', borderRadius: t.radius - 2, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 14.5, fontWeight: active ? 800 : 700,
        background: active ? t.accent : 'transparent', color: active ? '#fff' : t.inkSoft,
        transition: 'background 0.15s, color 0.15s',
      }}>{label}</button>
    )
  }
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, background: t.surfaceMuted, border: `1px solid ${t.border}`, borderRadius: t.radius, marginBottom: 18 }}>
      {opt('para-ti', 'Para ti')}
      {opt('tudo', 'Tudo o que o Phlox faz')}
    </div>
  )
}

// ─── TUDO O QUE O PHLOX FAZ — antes /tudo, agora uma vista aqui ─────────────────
// Pesquisa + catálogo completo por categoria. Mesma fonte de dados do ⌘K
// (lib/navigation.ts) — não filtrado pelas preferências de "Para ti" (aqui é
// para ver mesmo TUDO), com secções sempre abertas (nada escondido atrás de um
// "expandir" que uma pessoa possa não descobrir).
function TudoView({ mode, theme: t }: { mode: string; theme: ModeTheme }) {
  const [q, setQ] = useState('')
  const navMode = (mode === 'clinical' ? 'clinical' : mode) as 'personal' | 'caregiver' | 'student' | 'clinical'
  const cats: NavCategory[] = getNavForMode(navMode)
  const term = q.trim().toLowerCase()
  const filtered = !term ? cats : cats
    .map(c => ({ ...c, tools: c.tools.filter(x => x.label.toLowerCase().includes(term) || x.desc.toLowerCase().includes(term)) }))
    .filter(c => c.tools.length > 0)

  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <label htmlFor="tudo-search" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: t.inkFaint, marginBottom: 6 }}>Procurar uma ferramenta</label>
        <span style={{ position: 'absolute', left: 15, top: 40, color: t.inkFaint }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
        </span>
        <input id="tudo-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Ex: comprimidos, tensão, dúvida…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 44px', fontSize: 16, border: `1.5px solid ${t.border}`, borderRadius: t.radius, outline: 'none', background: t.surface, color: t.ink }} />
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: t.surface, border: `1px dashed ${t.border}`, borderRadius: t.radius, padding: '36px 20px', textAlign: 'center', color: t.inkFaint, fontSize: 14 }}>
          Nada encontrado para "{q}". Tenta outra palavra.
        </div>
      ) : filtered.map(cat => (
        <div key={cat.id} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11, padding: '0 2px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat.label}</span>
          </div>
          <div className="ini-actions">
            {cat.tools.map(tool => (
              <Link key={tool.href} href={tool.href} className="ini-action" style={{ background: t.surface, borderColor: t.border }}>
                <span className="ini-action-ic" style={{ background: `${cat.color}22`, fontSize: 20 }}>{tool.icon}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: t.ink, letterSpacing: '-0.01em' }}>{tool.label}</span>
                    {tool.badge && <span style={{ fontSize: 9, fontWeight: 800, color: t.accent, background: t.accentSoft, padding: '1px 6px', borderRadius: 4 }}>{tool.badge}</span>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint, marginTop: 1 }}>{tool.desc}</span>
                </span>
                <Icon name="chevron" size={16} color={t.inkFaint} />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── O FOCO PRINCIPAL — hero vivo, com gradiente do modo ───────────────────────
function FocusHero({ focus, theme: t, loading }: { focus: FocusCard; theme: ModeTheme; loading: boolean }) {
  // Enquanto os dados reais carregam, "focus" vem de um fallback que assume
  // hasAnyData:true — mostrar o cartão já montado piscava "A sua medicação · 0
  // medicamentos" a um utilizador novo antes do cartão de boas-vindas correto
  // aparecer. Um skeleton evita mostrar conteúdo que pode estar errado.
  if (loading) return (
    <div style={{ borderRadius: t.radiusLg, padding: '22px 22px 20px', background: t.surface, border: `1px solid ${t.border}` }}>
      <div className="skeleton" style={{ height: 38, width: 38, borderRadius: 11, marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 22, width: '70%', borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: '50%', borderRadius: 6 }} />
    </div>
  )
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

// ─── "A tua saúde" — REDESIGN 2026-07-17 ────────────────────────────────────────
// Substitui HealthAlertsCard (cartão à parte, com o SEU PRÓPRIO fetch — mostrava
// o mesmo alerta que já ia no foco, outra vez, num sítio diferente) + WeekStory
// (outro cartão logo a seguir). Agora é UM cartão: os alertas que não couberam
// no foco (moreHealthAlerts, já calculados 1x pelo /inicio) + as tendências da
// semana, só quando há mesmo algo a mostrar.
const ALERT_LVL: Record<string, { c: string; bg: string; b: string }> = {
  high: { c: '#991b1b', bg: '#fef2f2', b: '#fecaca' },
  medium: { c: '#92400e', bg: '#fffbeb', b: '#fde68a' },
  low: { c: '#1e40af', bg: '#eff6ff', b: '#bfdbfe' },
}
const TREND_TONE: Record<string, { c: string; bg: string; b: string }> = {
  good: { c: '#15803d', bg: '#f0fdf4', b: '#bbf7d0' },
  warn: { c: '#b45309', bg: '#fffbeb', b: '#fde68a' },
  neutral: { c: '#475569', bg: '#f8fafc', b: '#e2e8f0' },
}
function HealthStrip({ data: d, loading, theme: t }: { data: HomeData; loading: boolean; theme: ModeTheme }) {
  if (loading) return null
  const alerts = d.moreHealthAlerts || []
  const w = d.week

  const chips: { label: string; tone: 'good' | 'warn' | 'neutral' }[] = []
  if (w) {
    if (w.weightDelta != null && Math.abs(w.weightDelta) >= 0.3)
      chips.push({ label: `Peso ${w.weightDelta < 0 ? '↓' : '↑'}${Math.abs(w.weightDelta)} kg`, tone: 'neutral' })
    if (w.bpTrend === 'down') chips.push({ label: 'Tensão a melhorar', tone: 'good' })
    else if (w.bpTrend === 'up') chips.push({ label: 'Tensão a subir', tone: 'warn' })
    if (w.adherencePct != null) chips.push({ label: `Medicação ${w.adherencePct}%`, tone: w.adherencePct >= 80 ? 'good' : w.adherencePct >= 50 ? 'neutral' : 'warn' })
    if (w.symptomsCount && w.symptomsCount > 0) chips.push({ label: `${w.symptomsCount} registo${w.symptomsCount > 1 ? 's' : ''} de sintomas`, tone: 'neutral' })
  }

  if (alerts.length === 0 && chips.length === 0) return null

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: t.radius, padding: '15px 16px', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: t.ink }}>A tua saúde</span>
        <Link href="/relatorio" style={{ fontSize: 12, fontWeight: 700, color: t.accent, textDecoration: 'none' }}>Ver detalhe →</Link>
      </div>
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: chips.length > 0 ? 11 : 0 }}>
          {alerts.map((a, i) => {
            const s = ALERT_LVL[a.level]
            return (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: s.bg, border: `1px solid ${s.b}`, borderRadius: 9, padding: '9px 11px' }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>{a.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.c }}>{a.title}</div>
                  {a.detail && <div style={{ fontSize: 12, color: s.c, opacity: 0.9, lineHeight: 1.4, marginTop: 1 }}>{a.detail}</div>}
                </div>
                {a.href && <Link href={a.href} style={{ flexShrink: 0, alignSelf: 'center', fontSize: 11, fontWeight: 800, color: s.c, textDecoration: 'none', whiteSpace: 'nowrap' }}>{a.cta || 'Ver'} →</Link>}
              </div>
            )
          })}
        </div>
      )}
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {chips.map((c, i) => {
            const s = TREND_TONE[c.tone]
            return <span key={i} style={{ fontSize: 12.5, fontWeight: 700, color: s.c, background: s.bg, border: `1px solid ${s.b}`, borderRadius: 8, padding: '5px 11px' }}>{c.label}</span>
          })}
        </div>
      )}
    </div>
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
