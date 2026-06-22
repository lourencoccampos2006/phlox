'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEnabledTools } from '@/lib/useEnabledTools'
import { TOOL_CATEGORIES, PLAN_BADGE, type ToolMode } from '@/lib/toolRegistry'
import { planName } from '@/lib/plans'
import PersonaSwitcher from '@/components/PersonaSwitcher'
import PinnedToolsBar from '@/components/PinnedToolsBar'
import MyTopTools from '@/components/MyTopTools'
import NextStep from '@/components/NextStep'
import FocusModeToggle from '@/components/FocusModeToggle'
import DailyBriefCard from '@/components/DailyBriefCard'
import HealthAlertsCard from '@/components/HealthAlertsCard'

// ─── Home adaptativa — mobile-first, lista limpa. Só mostra ferramentas ativas. ─

function greeting() { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 19 ? 'Boa tarde' : 'Boa noite' }
function dateStr() { return new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' }) }

type NonClinicalMode = Exclude<ToolMode, 'clinical'>
const HERO: Record<NonClinicalMode, { href: string; title: string; sub: string; cta: string; color: string }> = {
  personal:  { href: '/mymeds',  title: 'A minha medicação', sub: 'Vê a tua lista, ativa lembretes e verifica interações.', cta: 'Abrir', color: '#0d9488' },
  caregiver: { href: '/familia', title: 'Os perfis da família', sub: 'Gere a medicação e a saúde de quem cuidas, num só sítio.', cta: 'Abrir', color: '#b45309' },
  student:   { href: '/arena',   title: 'Continuar a estudar', sub: 'Entra na Arena, treina casos e sobe de liga.', cta: 'Começar', color: '#7c3aed' },
}

export default function InicioPage() {
  const { user, loading } = useAuth() as any
  const router = useRouter()
  const expMode: string = user?.experience_mode || 'personal'
  // Saudação/data só depois de montar — evita mismatch de hidratação (a hora do
  // servidor difere da do cliente, e o toLocaleDateString varia entre os dois).
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
    // Já NÃO redirecionamos clínico para /cockpit — o /inicio é o hub de entrada
    // para todos os modos. O modo clínico mostra paywall (se não-Pro) ou hub clínico.
  }, [loading, user, router])

  const plan = (user?.plan as string) || 'free'
  const clinicalAllowed = plan === 'pro' || plan === 'clinic'
  const toolMode: ToolMode = (['personal', 'caregiver', 'student'].includes(expMode) ? expMode : 'personal') as ToolMode
  const { enabledTools } = useEnabledTools(toolMode)
  const isFree = !user?.plan || user.plan === 'free'

  if (loading || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MODO CLÍNICO ──
  if (expMode === 'clinical') {
    // Free/Plus → paywall (o espaço clínico exige Institucional/Pro)
    if (!clinicalAllowed) {
      return (
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-sans)' }}>
          <div style={{ width: 'min(460px,100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px', textAlign: 'center', boxShadow: '0 12px 50px rgba(8,12,24,0.08)' }}>
            <div style={{ fontSize: 34, marginBottom: 12 }}>🏥</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 700 }}>Espaço clínico</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, margin: '0 0 10px' }}>O modo clínico é para profissionais e instituições</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>O painel da instituição, a ronda, o MAR, a vigilância de utentes e os relatórios fazem parte dos planos Pro e Institucional. O teu plano atual é {planName(plan)}.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <Link href="/pricing" style={{ padding: '13px 18px', background: '#1d4ed8', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Ver planos Pro e Institucional</Link>
              <Link href="/settings" style={{ padding: '11px', background: 'none', color: 'var(--ink-4)', borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>Mudar de modo nas Definições</Link>
            </div>
          </div>
        </div>
      )
    }
    // Pro/Institucional → hub clínico (não /cockpit automático; entrada calma)
    return <ClinicalHub router={router} name={user?.name?.split(' ')[0] || ''} />
  }

  const cats = Object.keys(TOOL_CATEGORIES).filter(c => enabledTools.some(t => t.category === c))
  const firstName = user?.name?.split(' ')[0] || ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '22px 16px 40px', boxSizing: 'border-box', width: '100%' }}>

        {/* Greeting + plan chip */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)', fontWeight: 400, letterSpacing: '-0.02em', margin: 0, lineHeight: 1.15 }}>
              {mounted ? greeting() : 'Olá'}{firstName ? `, ${firstName}` : ''}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--ink-4)', marginTop: 4, textTransform: 'capitalize', minHeight: 18 }}>{mounted ? dateStr() : ''}</div>
          </div>
          <Link href="/pricing" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', background: 'white', border: '1px solid var(--border)', borderRadius: 20, textDecoration: 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFree ? '#94a3b8' : '#0d6e42' }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>Plano {planName(user?.plan)}</span>
          </Link>
        </div>

        {/* Quick switcher de persona + Focus Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <PersonaSwitcher />
          <FocusModeToggle />
        </div>

        {/* PRO — avisos proativos (determinísticos) + "A tua saúde hoje" (briefing IA). */}
        {(toolMode === 'personal' || toolMode === 'caregiver') && <HealthAlertsCard />}
        {(toolMode === 'personal' || toolMode === 'caregiver') && <DailyBriefCard />}

        {/* Atalhos fixos do utilizador (até 6 escolhidos por ele) */}
        <PinnedToolsBar />

        {/* O site aprende: atalhos automáticos para o que o utilizador mais usa */}
        <MyTopTools />

        {/* Hero — ação principal do modo */}
        {(() => { const h = (HERO as Record<string, typeof HERO.personal | undefined>)[toolMode]; if (!h) return null; return (
          <Link href={h.href} style={{ textDecoration: 'none' }}>
            <div style={{ background: h.color, borderRadius: 16, padding: '20px 22px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>{h.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 4, lineHeight: 1.45 }}>{h.sub}</div>
              </div>
              <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', color: 'white', padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 700 }}>
                {h.cta} <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </span>
            </div>
          </Link>
        )})()}

        {/* Fluxo guiado: o próximo passo certo, com base no estado real do utilizador */}
        <NextStep mode={toolMode} />

        {enabledTools.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', marginBottom: 8 }}>Sem ferramentas ativas</div>
            <Link href="/settings" style={{ fontSize: 13, color: '#0d6e42', textDecoration: 'none', fontWeight: 700 }}>Escolher ferramentas →</Link>
          </div>
        ) : (
          cats.map(cat => {
            const meta = TOOL_CATEGORIES[cat]
            const items = enabledTools.filter(t => t.category === cat)
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 2px' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{meta.label}</span>
                </div>
                {/* Card list — mobile-first single column, becomes 2-col on wide screens */}
                <div className="home-grid">
                  {items.map(t => {
                    const badge = PLAN_BADGE[t.plan]
                    return (
                      <Link key={t.id} href={t.id} className="home-card" style={{ textDecoration: 'none' }}>
                        <span style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: meta.color }} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t.label}</span>
                            {badge && <span style={{ fontSize: 9, fontWeight: 700, color: badge.color, background: badge.bg, padding: '1px 6px', borderRadius: 4 }}>{badge.label}</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-4)', marginTop: 2 }}>{t.desc}</span>
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

        {/* Add more */}
        <Link href="/settings?tab=ferramentas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px', background: 'white', border: '1.5px dashed var(--border)', borderRadius: 12, textDecoration: 'none', color: 'var(--ink-4)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar mais ferramentas
        </Link>

        {/* Porta de entrada calma para um momento difícil — discreta, opcional. */}
        <Link href="/comecar" style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', marginBottom: 16 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🤍</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>A passar por um momento difícil?</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-4)', marginTop: 1 }}>Alta do hospital, diagnóstico novo, cuidar de alguém — o Phlox ajuda nos primeiros passos.</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-5)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M9 18l6-6-6-6"/></svg>
        </Link>

        {/* Free-plan ad slot — 2026-06-01: escondido em modo foco */}
        {isFree && (
          <div className="focus-hide" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Publicidade</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 10 }}>Espaço de anúncio — removido em qualquer plano pago.</div>
            <Link href="/pricing" style={{ display: 'inline-block', padding: '8px 14px', background: 'var(--ink)', color: 'white', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>Remover anúncios →</Link>
          </div>
        )}
      </div>

      <style>{`
        .home-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
        .home-card {
          display: flex; align-items: center; gap: 13px;
          background: white; border: 1px solid var(--border); border-radius: 14px;
          padding: 14px 15px; transition: border-color 0.15s, box-shadow 0.15s;
        }
        .home-card:active { background: var(--bg-2); }
        @media (min-width: 700px) {
          .home-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .home-card:hover { border-color: var(--border-2); box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
        }
      `}</style>
    </div>
  )
}

// Hub de entrada do modo clínico — entrada calma, não o cockpit direto.
function ClinicalHub({ name }: { router: any; name: string }) {
  const TOOLS = [
    { href: '/cockpit', icon: '▦', title: 'Cockpit', desc: 'Dashboard do turno · alertas · KPIs' },
    { href: '/patients', icon: '👥', title: 'Doentes', desc: 'Fichas, medicação, alertas' },
    { href: '/rounds', icon: '🩺', title: 'Ronda farmacêutica', desc: 'PCNE · intervenções' },
    { href: '/mar', icon: '💊', title: 'Administração (MAR)', desc: 'Registo por turno' },
    { href: '/vigia', icon: '🏥', title: 'Vigia Clínico', desc: 'Vigilância farmacológica de todos' },
    { href: '/oracle', icon: '✦', title: 'Oracle', desc: 'SOAP · PCNE · plano' },
    { href: '/turno', icon: '🕐', title: 'Turno', desc: 'Visão do turno atual' },
    { href: '/handover', icon: '🔄', title: 'Passagem de turno', desc: 'Relatório IA do turno' },
  ]
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 40px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 6 }}>Espaço clínico</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px,4vw,32px)', fontWeight: 500, margin: '0 0 4px' }}>Bom trabalho{name ? `, ${name}` : ''}.</h1>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, marginBottom: 20 }}>Por onde queres começar hoje?</p>
        <div className="home-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {TOOLS.map(t => (
            <Link key={t.href} href={t.href} className="home-card" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, background: 'white', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: '#1d4ed814', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{t.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{t.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-4)' }}>{t.desc}</span>
              </span>
            </Link>
          ))}
        </div>
        <style>{`
          .home-card:hover { border-color: var(--border-2); box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          @media (min-width: 700px) { .home-grid { grid-template-columns: 1fr 1fr !important; } }
        `}</style>
      </div>
    </div>
  )
}
