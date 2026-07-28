'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { planName } from '@/lib/plans'
import Icon from '@/components/Icon'
import WelcomeTour from '@/components/WelcomeTour'
import { modeTheme, type ModeTheme } from '@/lib/modeTheme'
import { homeGreeting } from '@/lib/homeIntelligence'
import { ALL_PERSONAS, personaFor } from '@/lib/userPersona'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { blueprintFor } from '@/lib/institutionBlueprint'
import { institutionConfig } from '@/lib/institutionConfig'
import { useOrgScope } from '@/lib/orgScope'
import { useLiveData } from '@/lib/useLiveData'
import { MODULES_BY_MODE, getModulePrefs, type ModuleId } from '@/lib/inicioModules'
import TodayModule from '@/components/inicio/TodayModule'
import HealthModule from '@/components/inicio/HealthModule'
import RosterModule from '@/components/inicio/RosterModule'
import ProgressModule from '@/components/inicio/ProgressModule'
import ShortcutsModule from '@/components/inicio/ShortcutsModule'
import ExploreSection from '@/components/inicio/ExploreSection'

// ─── /inicio DO ZERO — 2026-07-21 ───────────────────────────────────────────
// A página mais importante do site, reconstruída de raiz (não reorganizada):
// cada modo é uma experiência própria feita de MÓDULOS autónomos (cada um
// busca os seus próprios dados), escolhidos por quem usa em /settings. Não há
// vista "Tudo o que o Phlox faz" separada nem um toggle a fingir ser uma
// página — "Explorar" é só a parte de baixo desta mesma página, sempre visível.
// Tipografia: serif para a saudação, mono para rótulos de secção e números,
// hairlines em vez de cartões com sombra. Sem gradientes, sem emoji de ícone.

export default function InicioPage() {
  const { user, loading } = useAuth() as any
  const router = useRouter()
  const expMode: string = user?.experience_mode || 'personal'
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (loading) return
    if (!user) { router.push('/login'); return }
  }, [loading, user, router])

  const [enabled, setEnabled] = useState<ModuleId[] | null>(null)
  useEffect(() => { setEnabled(getModulePrefs(expMode)) }, [expMode])

  const plan = (user?.plan as string) || 'free'
  // Acesso institucional SÓ por PERTENÇA a uma organização — nunca por plano
  // (nem Pro). Corrigido 2026-07-28: isto tinha "plan === 'pro'" a dar acesso
  // a quem nunca foi convidado por nenhuma instituição — não espelhava o
  // servidor (lib/planGate.ts), que sempre exigiu pertença.
  const inOrg = !!(user?.active_org_id || user?.org_id || user?.org_role)
  const clinicalAllowed = inOrg

  if (loading || !user) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--green)', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── MODO CLÍNICO — paywall ou hub próprio (já é uma experiência à parte) ──
  if (expMode === 'clinical') {
    if (!clinicalAllowed) return <ClinicalPaywall />
    return <ClinicalHub name={user?.name?.split(' ')[0] || ''} />
  }

  const t = modeTheme(expMode)
  const firstName = user?.name?.split(' ')[0] || ''
  const greeting = mounted ? homeGreeting(firstName) : 'Olá'
  const modules = MODULES_BY_MODE[expMode] || []
  const active = enabled ? modules.filter(m => enabled.includes(m.id)) : []

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <WelcomeTour mode={expMode} />
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '30px 18px 48px', boxSizing: 'border-box', width: '100%' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(28px,6.5vw,36px)', letterSpacing: '-0.01em', margin: 0, lineHeight: 1.1, color: t.ink }}>
            {greeting}.
          </h1>
          <ModeChip theme={t} />
        </div>

        {enabled === null ? (
          <div className="skeleton" style={{ height: 220, borderRadius: 10, marginTop: 34 }} />
        ) : (
          <>
            {active.map(m => (
              <ModuleSection key={m.id} title={m.label} theme={t}>
                {renderModule(m.id, expMode, t)}
              </ModuleSection>
            ))}

            {(expMode === 'personal' || expMode === 'caregiver') && (
              <ModuleSection title="Um momento difícil?" theme={t}>
                <Link href="/comecar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 0', textDecoration: 'none' }}>
                  <span style={{ fontSize: 13.5, color: t.inkSoft, lineHeight: 1.5 }}>Alta do hospital, diagnóstico novo, cuidar de alguém — começamos consigo.</span>
                  <Icon name="chevron" size={15} color={t.inkFaint} style={{ flexShrink: 0 }} />
                </Link>
              </ModuleSection>
            )}

            <ModuleSection title="Explorar" theme={t} anchorId="explorar">
              <ExploreSection mode={expMode} theme={t} />
            </ModuleSection>
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 36, paddingTop: 18, borderTop: `1px solid ${t.border}` }}>
          <Link href="/settings" style={{ fontSize: 13, color: t.inkFaint, textDecoration: 'none', fontWeight: 600 }}>Definições</Link>
          <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: plan === 'free' ? t.inkFaint : t.accent }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: t.inkSoft }}>Plano {planName(user?.plan)}</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

function renderModule(id: ModuleId, mode: string, t: ModeTheme) {
  switch (id) {
    case 'today': return <TodayModule theme={t} />
    case 'health': return <HealthModule theme={t} />
    case 'roster': return <RosterModule theme={t} />
    case 'progress': return <ProgressModule theme={t} />
    case 'shortcuts': return <ShortcutsModule mode={mode} theme={t} />
    default: return null
  }
}

// ─── Rótulo de secção — assinatura visual da página: mono, maiúsculas, sem
// caixa/sombra à volta. Substitui o antigo estilo de "cartão" repetido. ──────
function ModuleSection({ title, theme: t, children, anchorId }: { title: string; theme: ModeTheme; children: React.ReactNode; anchorId?: string }) {
  return (
    <section id={anchorId} style={{ marginTop: 34, scrollMarginTop: 76 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 13 }}>{title}</div>
      {children}
    </section>
  )
}

// ─── Troca de modo (chip compacto, abre menu) ──────────────────────────────
function ModeChip({ theme: t }: { theme: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const current = personaFor(user.experience_mode)
  // BUG CRÍTICO corrigido 2026-07-28: este chip listava TODAS as personas
  // (incluindo "Clínico") a qualquer conta, e switchTo() escrevia
  // experience_mode direto na BD sem checar pertença a organização nenhuma —
  // 3º sítio encontrado com este mesmo problema (depois de components/Header.tsx
  // e /settings). "Instituição" só aparece para quem já pertence a uma org real.
  const inOrg = !!(user.active_org_id || user.org_id || user.org_role)
  const personas = ALL_PERSONAS.filter(p => p.mode !== 'clinical' || inOrg)
  async function switchTo(mode: string) {
    if (mode === user.experience_mode) { setOpen(false); return }
    if (mode === 'clinical' && !inOrg) { setOpen(false); return }
    setBusy(true)
    await supabase.from('profiles').update({ experience_mode: mode }).eq('id', user.id)
    setOpen(false); setTimeout(() => location.reload(), 300)
  }
  return (
    <div style={{ position: 'relative', flexShrink: 0, marginTop: 4 }}>
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
            {personas.map(p => {
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

// ─── Modo clínico: paywall ──────────────────────────────────────────────────
function ClinicalPaywall() {
  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'var(--font-sans)' }}>
      <div style={{ width: 'min(460px,100%)', background: 'white', border: '1px solid var(--border)', borderRadius: 18, padding: '28px 26px', textAlign: 'center', boxShadow: '0 12px 50px rgba(8,12,24,0.08)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#1d4ed8', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 700 }}>Área institucional</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', fontWeight: 400, margin: '0 0 10px' }}>Esta área é exclusiva de instituições</h1>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>O acesso é atribuído pela instituição a quem convida — não se compra nem se ativa aqui.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <Link href="/settings" style={{ padding: '13px 18px', background: '#1d4ed8', color: 'white', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Voltar às Definições</Link>
        </div>
      </div>
    </div>
  )
}

// ─── Modo clínico: hub próprio ──────────────────────────────────────────────
// Hub clínico VIVO e por instituição. Lê do blueprint (vocabulário e
// ferramentas certas para o tipo) e mostra um resumo do dia em tempo real
// (org-scoped) — já é, por construção, uma experiência diferente dos outros
// modos (não usa o sistema de módulos; o "resumo do dia" É o módulo).
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
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '30px 18px 48px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 8 }}>{bp.productName}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(26px,4.5vw,32px)', margin: '0 0 6px', letterSpacing: '-0.01em', color: t.ink }}>{greetLead}</h1>
        <p style={{ color: t.inkSoft, fontSize: 14, marginBottom: 24 }}>{bp.tagline}</p>

        {/* Resumo do dia — ao vivo */}
        <Link href="/painel" style={{ display: 'block', textDecoration: 'none', marginBottom: 8 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 13 }}>O dia de hoje</div>
          {!snap ? (
            <div style={{ color: t.inkFaint, fontSize: 13 }}>A carregar…</div>
          ) : (
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {stats.map(s => (
                <div key={s.l}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, lineHeight: 1, color: (s as any).alert ? '#dc2626' : t.ink }}>{s.n}</div>
                  <div style={{ fontSize: 11.5, color: t.inkFaint, marginTop: 5, fontWeight: 600 }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </Link>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.09em', margin: '30px 0 13px' }}>Por onde começar</div>
        <div>
          {actions.map((tool, i) => (
            <Link key={tool.href} href={tool.href} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 13, padding: '12px 0', borderTop: i === 0 ? 'none' : `1px solid ${t.border}` }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: t.accentSoft, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={tool.icon} size={18} /></span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5, color: t.ink }}>{tool.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: t.inkFaint }}>{tool.desc}</span>
              </span>
              <Icon name="chevron" size={15} color={t.inkFaint} />
            </Link>
          ))}
        </div>
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
