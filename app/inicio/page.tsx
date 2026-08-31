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
import HomeWidgetsModule from '@/components/inicio/HomeWidgets'
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
    case 'shortcuts': return (mode === 'personal' || mode === 'caregiver') ? <HomeWidgetsModule mode={mode} theme={t} /> : <ShortcutsModule mode={mode} theme={t} />
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
  // BUG/PEDIDO 2026-08-07: /inicio deixou de mostrar a grelha de ferramentas
  // (isso agora vive só em /painel, que absorveu o catálogo completo) — em vez
  // disso mostra "widgets úteis": info que interessa a QUALQUER funcionário
  // (nunca restrita a admin), não atalhos para abrir ferramentas.
  const [todayActivities, setTodayActivities] = useState<{ title: string; start_time: string | null }[]>([])

  const load = useCallback(async () => {
    if (!user) return
    const [p, care, mar, inc, unlogged, acts] = await Promise.all([
      scope.filter(supabase.from('patients').select('id', { count: 'exact', head: true }).eq('active', true)),
      scope.filter(supabase.from('care_records').select('patient_id')).eq('date', today),
      scope.filter(supabase.from('mar_records').select('status')).eq('date', today),
      scope.filter(supabase.from('incidents').select('id,patient_id,type', { count: 'exact' }).eq('status', 'open')).limit(3),
      scope.filter(supabase.from('patients').select('id,name').eq('active', true)),
      scope.filter(supabase.from('activities').select('title,start_time')).eq('date', today).order('start_time', { ascending: true }),
    ])
    const loggedIds = new Set((care.data || []).map((r: any) => r.patient_id))
    const logged = loggedIds.size
    const doses = (mar.data || []).filter((m: any) => m.status === 'administered' || m.status === 'taken' || m.status === 'given').length
    setSnap({ people: p.count || 0, logged, doses, alerts: (inc as any).count || 0 })
    // O "A vigiar hoje" com três nomes foi removido (2026-08-31). Numa casa
    // com trinta e quatro utentes, mostrar três pelo nome não é uma amostra —
    // é um recorte pela ordem da consulta, que dá a impressão errada de que
    // aqueles são OS casos. Quem lista pessoa a pessoa é o /painel, que mostra
    // todas as pendências e ordena por urgência a sério.
    setTodayActivities(((acts.data || []) as any[]).slice(0, 4))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, supabase, scope.orgId, scope.userId])

  useEffect(() => { load() }, [load])
  useLiveData({ supabase, userId: user?.id, table: ['patients', 'care_records', 'mar_records', 'incidents', 'activities'], filterColumn: scope.liveFilterColumn, filterValue: scope.liveFilterValue, onChange: load })

  const firstName = name
  const greetLead = bp.greetingLead(firstName)

  const stats = snap ? [
    { n: snap.people, l: cfg.personNounPlural },
    { n: snap.logged, l: 'com registo hoje' },
    { n: snap.doses, l: 'tomas dadas' },
    // Diz o que conta mesmo. Estava "a vigiar", mas o número só conta
    // ocorrências em aberto, enquanto a lista "A vigiar hoje" logo abaixo
    // junta-lhes os utentes sem registo do dia. Dava a contradição de mostrar
    // "0 a vigiar" com pessoas listadas a seguir.
    { n: snap.alerts, l: snap.alerts === 1 ? 'ocorrência em aberto' : 'ocorrências em aberto', alert: snap.alerts > 0 },
  ] : []

  // ── Widgets, e nenhum nome de utente ──────────────────────────────────
  // Mostrava "A vigiar hoje" com três pessoas pelo nome. Numa casa com 34
  // utentes, três nomes não é uma amostra — é um recorte arbitrário que faz
  // parecer que aqueles são os casos, quando são só os primeiros da consulta.
  // O painel é que lista pessoa a pessoa; aqui fica a forma do dia.
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
  const conclusao = snap ? pct(snap.doses + snap.logged, snap.people * 2) : null

  const Bloco = ({ etiqueta, children, href, largo }: {
    etiqueta: string; children: React.ReactNode; href?: string; largo?: boolean
  }) => {
    const inner = (
      <div style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        padding: 'var(--space-9) var(--space-10)', height: '100%',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-5)',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: 'var(--ink-4)', fontWeight: 700,
        }}>{etiqueta}</div>
        {children}
      </div>
    )
    return (
      <div style={{ gridColumn: largo ? 'span 2' : 'auto', minWidth: 0 }}>
        {href ? <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>{inner}</Link> : inner}
      </div>
    )
  }

  const Grande = ({ v, de, cor }: { v: number; de?: number; cor?: string }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 38, lineHeight: 1, color: cor || 'var(--ink)', letterSpacing: '-0.025em' }}>{v}</span>
      {de != null && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--ink-5)' }}>/{de}</span>}
    </div>
  )

  const Nota = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 12.5, color: 'var(--ink-4)', lineHeight: 1.5, marginTop: 'auto' }}>{children}</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: t.pageBg, fontFamily: 'var(--font-sans)', color: t.ink }}>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '30px clamp(16px,3vw,24px) 64px' }}>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 'var(--space-4)' }}>{bp.productName}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 'clamp(27px,4.6vw,36px)', margin: '0 0 var(--space-3)', letterSpacing: '-0.02em', color: t.ink }}>{greetLead}</h1>
        <p style={{ color: t.inkSoft, fontSize: 14.5, marginBottom: 'var(--space-12)' }}>{bp.tagline}</p>

        {!snap ? (
          <div style={{ color: t.inkFaint, fontSize: 13 }}>A carregar o dia…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(196px,1fr))', gap: 'var(--space-6)' }}>

            <Bloco etiqueta="Como vai o dia" href="/painel" largo>
              {conclusao == null ? (
                <Nota>Ainda sem nada registado hoje.</Nota>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-6)' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 44, lineHeight: 1, color: bp.accent, letterSpacing: '-0.03em' }}>{conclusao}%</span>
                    <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>do que o dia pede já está feito</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, conclusao)}%`, background: bp.accent, borderRadius: 3, transition: 'width .5s' }} />
                  </div>
                  <Nota>Conta as tomas dadas e os registos do dia, sobre o que estava previsto.</Nota>
                </>
              )}
            </Bloco>

            <Bloco etiqueta={cfg.personNounPlural} href="/patients">
              <Grande v={snap.people} />
              <Nota>{snap.people === 1 ? 'pessoa ativa' : 'pessoas ativas'} na casa</Nota>
            </Bloco>

            <Bloco etiqueta="Tomas dadas" href="/mar">
              <Grande v={snap.doses} />
              <Nota>hoje, registadas pela equipa</Nota>
            </Bloco>

            <Bloco etiqueta="Registos do dia" href="/care-log">
              <Grande v={snap.logged} de={snap.people} />
              <Nota>{snap.people - snap.logged > 0 ? `${snap.people - snap.logged} por fazer` : 'todos feitos'}</Nota>
            </Bloco>

            <Bloco etiqueta="Ocorrências em aberto" href="/incidents">
              <Grande v={snap.alerts} cor={snap.alerts > 0 ? '#b91c1c' : undefined} />
              <Nota>{snap.alerts > 0 ? 'com seguimento por fazer' : 'nada em aberto'}</Nota>
            </Bloco>

            <Bloco etiqueta="Atividades de hoje" href="/activities" largo>
              {todayActivities.length === 0 ? (
                <Nota>Sem atividades marcadas. Num centro de dia, são elas que fazem o dia.</Nota>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {todayActivities.slice(0, 4).map((a: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-6)', fontSize: 14 }}>
                      {a.start_time && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-5)', minWidth: 40 }}>{String(a.start_time).slice(0, 5)}</span>}
                      <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </Bloco>

          </div>
        )}

        <Link href="/painel" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginTop: 'var(--space-12)', padding: 'var(--space-7)', borderRadius: 'var(--r-md)',
          background: t.accent, color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: 14.5,
        }}>
          <Icon name="grid" size={17} color="white" /> Abrir o painel
        </Link>
      </div>
    </div>
  )
}


// Mapeia o emoji do blueprint para um ícone do nosso set (fallback p/ grid).
// Exportada: /painel também usa isto para desenhar o catálogo de ferramentas.
export function iconForTool(emoji: string): string {
  const map: Record<string, string> = {
    '🧑‍🤝‍🧑': 'family', '💊': 'pill', '📝': 'book', '👨‍👩‍👧': 'family', '🔄': 'spark',
    '⚠️': 'shield', '📐': 'check', '🩺': 'check', '🏪': 'grid', '📦': 'grid', '🔍': 'search', '📅': 'calendar',
  }
  return map[emoji] || 'grid'
}
