'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { planName } from '@/lib/plans'
import Icon from '@/components/Icon'
import WelcomeTour from '@/components/WelcomeTour'
import { modeTheme, isPremiumMode } from '@/lib/modeTheme'
import { homeGreeting, homeSubline, pickFocus, quickActions, type HomeData, type FocusCard } from '@/lib/homeIntelligence'
import { summarize } from '@/lib/studyProgress'

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
        const s = summarize()
        if (!cancel) setData({
          firstName, medsCount: 0, dosesDueNow: 0, dosesTakenToday: 0, dosesTotalToday: 0,
          studyStreak: s.streak, studyXpToday: s.xpToday, studyGoal: s.dailyGoal,
          weakArea: s.weakAreas[0]?.area || null,
          hasAnyData: s.activeDays.size > 0,
        })
        return
      }
      // pessoal / cuidador
      const today = new Date().toISOString().slice(0, 10)
      const hour = new Date().getHours()
      try {
        const [{ data: meds }, { data: logs }, { data: vitals }, { data: appts }] = await Promise.all([
          supabase.from('personal_meds').select('name, reminder_times').eq('user_id', user.id),
          supabase.from('med_logs').select('id, status').eq('user_id', user.id).gte('date', today).eq('status', 'taken'),
          supabase.from('vitals').select('recorded_at').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(1),
          supabase.from('appointments').select('title, date').eq('user_id', user.id).gte('date', today).order('date').limit(1),
        ])
        const medList = (meds || []) as { name: string; reminder_times?: string[] }[]
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
        const lastVital = (vitals || [])[0]?.recorded_at
        const lastVitalDaysAgo = lastVital ? Math.floor((Date.now() - new Date(lastVital).getTime()) / 86400000) : null
        const appt = (appts || [])[0]
        const nextAppt = appt ? { title: appt.title || 'Consulta', inDays: Math.max(0, Math.ceil((new Date(appt.date).getTime() - Date.now()) / 86400000)) } : null
        if (!cancel) setData({
          firstName, medsCount: medList.length,
          dosesDueNow: dueNow, dosesTakenToday: taken, dosesTotalToday: totalToday, nextDoseLabel: nextLabel,
          lastVitalDaysAgo, nextAppt,
          hasAnyData: medList.length > 0 || !!lastVital || !!appt,
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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '26px 16px 40px', boxSizing: 'border-box', width: '100%' }}>

        {/* Saudação — viva, com uma linha honesta sobre o estado */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: t.greetWarm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: 'clamp(27px,7vw,34px)', fontWeight: t.greetWarm ? 400 : 800, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.1, color: t.ink }}>
            {greeting}.
          </h1>
          <p style={{ fontSize: 'clamp(15px,4vw,17px)', color: t.inkSoft, margin: '7px 0 0', fontWeight: 500 }}>{subline}</p>
        </div>

        {/* ── O FOCO — a única coisa que importa agora ── */}
        <FocusHero focus={focus} theme={t} loading={!data} />

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

        {/* ── Ver tudo ── */}
        <Link href="/tudo" data-tour="all" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          padding: '15px', marginTop: 14, background: 'transparent',
          border: `1.5px solid ${t.border}`, borderRadius: t.radius,
          textDecoration: 'none', color: t.inkSoft, fontSize: 14.5, fontWeight: 700,
        }}>
          <Icon name="grid" size={18} color={t.inkSoft} />
          Ver tudo o que o Phlox faz
        </Link>

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
        @media (min-width: 620px) {
          .ini-actions { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ini-action:hover { box-shadow: 0 6px 20px rgba(0,0,0,${premium ? '0.4' : '0.06'}); }
        }
      `}</style>
    </div>
  )
}

// ─── O FOCO PRINCIPAL — hero vivo, com gradiente do modo ───────────────────────
function FocusHero({ focus, theme: t, loading }: { focus: FocusCard; theme: ReturnType<typeof modeTheme>; loading: boolean }) {
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
function ClinicalHub({ name }: { name: string }) {
  const t = modeTheme('clinical')
  const TOOLS = [
    { href: '/painel', icon: 'grid', title: 'Painel', desc: 'O dia da instituição, ao vivo' },
    { href: '/turno', icon: 'calendar', title: 'Turno', desc: 'Utentes, doses e alertas' },
    { href: '/patients', icon: 'family', title: 'Doentes', desc: 'Fichas, medicação, alertas' },
    { href: '/rounds', icon: 'check', title: 'Ronda', desc: 'PCNE · intervenções' },
    { href: '/mar', icon: 'pill', title: 'Administração (MAR)', desc: 'Registo por turno' },
    { href: '/oracle', icon: 'spark', title: 'Oracle', desc: 'SOAP · PCNE · plano' },
  ]
  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '26px 16px 40px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: t.inkFaint, marginBottom: 6 }}>Espaço clínico</div>
        <h1 style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-0.02em', color: t.ink }}>Bom trabalho{name ? `, ${name}` : ''}.</h1>
        <p style={{ color: t.inkSoft, fontSize: 14, marginBottom: 22 }}>Por onde quer começar hoje?</p>
        <div className="clin-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {TOOLS.map(tool => (
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
