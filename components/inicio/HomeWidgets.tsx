'use client'

// HomeWidgets — os widgets a sério de /inicio (pessoal + cuidador).
// REDESIGN 2026-08-09 (2ª volta): a 1ª tentativa só tinha aumentado os
// atalhos para parecerem "cartões" — continuavam a ser um menu (ícone +
// rótulo, só isso). O Fernando pediu widgets verdadeiros: cada um mostra
// ESTADO VIVO (não só um nome de ferramenta) e, quando faz sentido, permite
// agir ali mesmo, sem abrir a ferramenta. A disposição (que widget vem
// primeiro, qual é o "herói" de largura cheia) é fixa por desenho — só a
// PRESENÇA de cada widget é escolhida em /settings (WidgetToggleList).
//
// Cada widget busca os seus próprios dados, como o resto dos módulos de
// /inicio (TodayModule, HealthModule, RosterModule) já fazem.

import { Fragment, useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import Icon from '@/components/Icon'
import WidgetPickerModal from '@/components/inicio/WidgetPickerModal'
import { activeWidgets, type HomeWidgetId } from '@/lib/homeWidgets'
import { computeAdherenceOverview, type AdherenceMed, type AdherenceLog } from '@/lib/adherence'
import type { ModeTheme } from '@/lib/modeTheme'

function relTime(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })
}

// ─── Cartão base (widgets pequenos, 1 célula da grelha, tocável) ────────────
function Tile({ href, tag, headline, sub, icon, t, tone }: {
  href: string; tag: string; headline: string; sub: string; icon: string; t: ModeTheme; tone?: 'warn' | 'good'
}) {
  return (
    <Link href={href} style={{
      display: 'flex', flexDirection: 'column', gap: 7, padding: '15px 14px', minHeight: 112,
      borderRadius: t.radius, background: t.surface, border: `1px solid ${t.border}`, textDecoration: 'none',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={t.accent} />
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{tag}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: tone === 'warn' ? '#b45309' : tone === 'good' ? '#15803d' : t.ink, lineHeight: 1.2, marginTop: -2 }}>{headline}</div>
      <div style={{ fontSize: 11.5, color: t.inkFaint, lineHeight: 1.35 }}>{sub}</div>
    </Link>
  )
}

// ─── Cartão herói (largura cheia, ação direta) ───────────────────────────────
// `href` opcional: quando o herói inteiro é só navegação (sem botão próprio
// lá dentro), renderiza-se como <Link> — tem de SER o item da grelha
// (gridColumn só funciona em filhos diretos do grid), não um <div> lá dentro
// de um <Link> à volta.
function Hero({ icon, tag, children, t, href }: { icon: string; tag: string; children: React.ReactNode; t: ModeTheme; href?: string }) {
  const style: React.CSSProperties = { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14, padding: '15px 16px', borderRadius: t.radius, background: t.surface, border: `1px solid ${t.border}`, textDecoration: 'none' }
  const inner = (
    <>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={19} color={t.accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: t.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>{tag}</div>
        {children}
      </div>
    </>
  )
  return href ? <Link href={href} style={style}>{inner}</Link> : <div style={style}>{inner}</div>
}

// ─── PESSOAL: Como se sente (herói, registo de 1 toque) ─────────────────────
function SymptomsWidget({ t }: { t: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [today, setToday] = useState<{ feeling: number | null; at: string } | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!user || !supabase) return
    const since = new Date(); since.setHours(0, 0, 0, 0)
    const { data } = await supabase.from('symptom_logs').select('feeling, at').eq('user_id', user.id).is('profile_id', null)
      .gte('at', since.toISOString()).order('at', { ascending: false }).limit(1)
    setToday(data && data[0] ? data[0] : null)
  }, [user, supabase])
  useEffect(() => { load() }, [load])

  async function quickLog(feeling: number) {
    if (!user || busy) return
    setBusy(true)
    try {
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/sintomas', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd?.session?.access_token || ''}` },
        body: JSON.stringify({ feeling, symptoms: [] }),
      })
      if (res.ok) setToday({ feeling, at: new Date().toISOString() })
    } catch { /* offline */ }
    setBusy(false)
  }

  const FEELING_LABEL: Record<number, string> = { 1: 'Muito mal', 2: 'Mal', 3: 'Assim-assim', 4: 'Bem', 5: 'Ótimo' }

  return (
    <Hero icon="heart" tag="Como se sente" t={t}>
      {today === undefined ? (
        <div style={{ fontSize: 14, color: t.inkFaint }}>A carregar…</div>
      ) : today ? (
        <div style={{ fontSize: 14.5, fontWeight: 700, color: t.ink }}>{FEELING_LABEL[today.feeling || 4] || 'Registado'} <span style={{ fontWeight: 500, color: t.inkFaint }}>· registado {relTime(today.at)}</span></div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>Ainda não registou hoje</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => quickLog(4)} disabled={busy} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: t.accent, color: 'white', fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>🙂 Tudo bem</button>
            <Link href="/sintomas" style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${t.border}`, color: t.accent, fontSize: 12.5, fontWeight: 700, textDecoration: 'none', alignSelf: 'center' }}>Registar →</Link>
          </div>
        </div>
      )}
    </Hero>
  )
}

// ─── PESSOAL: Sinais vitais (última leitura) ────────────────────────────────
function VitalsWidget({ t }: { t: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [v, setV] = useState<any | null | undefined>(undefined)
  useEffect(() => {
    if (!user || !supabase) return
    supabase.from('vitals').select('bp_sys,bp_dia,weight,glucose,hr,spo2,temp,recorded_at').eq('user_id', user.id)
      .order('recorded_at', { ascending: false }).limit(1)
      .then(({ data }: any) => setV(data && data[0] ? data[0] : null))
  }, [user, supabase])

  if (v === undefined) return <Tile href="/vitals" tag="Sinais vitais" headline="…" sub="A carregar" icon="droplet" t={t} />
  if (!v) return <Tile href="/vitals" tag="Sinais vitais" headline="Sem registos" sub="Registar a primeira leitura" icon="droplet" t={t} />
  const headline = v.bp_sys ? `${v.bp_sys}/${v.bp_dia ?? '—'}` : v.weight ? `${v.weight} kg` : v.glucose ? `${v.glucose} mg/dL` : v.hr ? `${v.hr} bpm` : v.spo2 ? `${v.spo2}%` : '—'
  const label = v.bp_sys ? 'mmHg' : v.weight ? 'peso' : v.glucose ? 'glicemia' : v.hr ? 'freq. cardíaca' : 'SpO₂'
  return <Tile href="/vitals" tag="Sinais vitais" headline={headline} sub={`${label} · ${relTime(v.recorded_at)}`} icon="droplet" t={t} />
}

// ─── PESSOAL: Adesão (7 dias) ───────────────────────────────────────────────
function AdherenceWidget({ t }: { t: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [rate, setRate] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (!user || !supabase) return
    const since = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10)
    Promise.all([
      supabase.from('personal_meds').select('id,name,reminder_times,created_at').eq('user_id', user.id).eq('active', true),
      supabase.from('med_logs').select('med_id,date,logged_at,status').eq('user_id', user.id).gte('date', since),
    ]).then(([m, l]: any) => {
      const meds = (m.data || []) as AdherenceMed[]
      const logs = (l.data || []) as AdherenceLog[]
      if (!meds.some(x => (x.reminder_times || []).length > 0)) { setRate(null); return }
      setRate(computeAdherenceOverview(meds, logs, 7).overallRate)
    })
  }, [user, supabase])

  if (rate === undefined) return <Tile href="/adherencia" tag="Adesão" headline="…" sub="A carregar" icon="target" t={t} />
  if (rate === null) return <Tile href="/mymeds" tag="Adesão" headline="Sem horários" sub="Define horários para veres a adesão" icon="target" t={t} />
  return <Tile href="/adherencia" tag="Adesão · 7 dias" headline={`${rate}%`} sub={rate >= 80 ? 'A correr bem' : rate >= 50 ? 'Alguns esquecimentos' : 'Vale a pena rever'} icon="target" t={t} tone={rate >= 80 ? 'good' : rate < 50 ? 'warn' : undefined} />
}

// ─── Interações (pessoal: os meus meds · cuidador: os da família) ──────────
function InteractionsWidget({ t, mode }: { t: ModeTheme; mode: string }) {
  const { user, supabase } = useAuth() as any
  const [count, setCount] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (!user || !supabase) return
    if (mode === 'caregiver') {
      supabase.from('family_profiles').select('id').eq('user_id', user.id).then(async ({ data: profs }: any) => {
        const ids = (profs || []).map((p: any) => p.id)
        if (!ids.length) { setCount(0); return }
        const { count: c } = await supabase.from('family_profile_meds').select('id', { count: 'exact', head: true }).in('profile_id', ids)
        setCount(c || 0)
      })
    } else {
      supabase.from('personal_meds').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('active', true)
        .then(({ count: c }: any) => setCount(c || 0))
    }
  }, [user, supabase, mode])

  const sub = mode === 'caregiver' ? 'medicamentos na família' : 'medicamentos ativos'
  if (count === undefined) return <Tile href="/interactions" tag="Interações" headline="…" sub="A carregar" icon="shield" t={t} />
  if (count === 0) return <Tile href="/interactions" tag="Interações" headline="Sem medicação" sub="Ainda não há nada para verificar" icon="shield" t={t} />
  return <Tile href="/interactions" tag="Interações" headline={`${count}`} sub={sub} icon="shield" t={t} />
}

// ─── Nova receita / caixa (pessoal + cuidador) ──────────────────────────────
function ScanWidget({ t, mode }: { t: ModeTheme; mode: string }) {
  const sub = mode === 'caregiver' ? 'Foto à receita de alguém' : 'Foto à receita ou caixa'
  return <Tile href="/scan" tag="Nova receita" headline="Tirar foto" sub={sub} icon="camera" t={t} />
}

// ─── Phlox AI (pessoal + cuidador) ──────────────────────────────────────────
function AIWidget({ t }: { t: ModeTheme }) {
  return <Tile href="/ai" tag="Phlox AI" headline="Tenho uma dúvida" sub="Sobre sintomas, medicação ou análises" icon="spark" t={t} />
}

// ─── Convidar amigos (pessoal + cuidador) — 1 mês de Pro por amigo ─────────
function ReachWidget({ t }: { t: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [upgraded, setUpgraded] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (!user || !supabase) return
    supabase.auth.getSession().then(({ data: sd }: any) =>
      fetch('/api/reach/code', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
        .then(r => r.ok ? r.json() : null).then(j => setUpgraded(j?.upgraded ?? null)).catch(() => setUpgraded(null))
    )
  }, [user, supabase])

  if (upgraded === undefined) return <Tile href="/reach" tag="Convidar amigos" headline="…" sub="A carregar" icon="megaphone" t={t} />
  if (!upgraded) return <Tile href="/reach" tag="Convidar amigos" headline="Ganhe 1 mês grátis" sub="Por cada amigo que passar a Pro" icon="megaphone" t={t} />
  return <Tile href="/reach" tag="Convidar amigos" headline={`${upgraded} ${upgraded === 1 ? 'mês' : 'meses'} ganhos`} sub="Sem limite — continue a convidar" icon="megaphone" t={t} tone="good" />
}

// ─── CUIDADOR: Novidades da família (herói) ─────────────────────────────────
function FamilyNewsWidget({ t }: { t: ModeTheme }) {
  const { user, supabase } = useAuth() as any
  const [state, setState] = useState<'loading' | 'empty' | { name: string; line: string; at: string; n: number }>('loading')

  useEffect(() => {
    if (!user || !supabase) return
    let cancel = false
    ;(async () => {
      try {
        const { data: sd } = await supabase.auth.getSession()
        const res = await fetch('/api/family-link', { headers: { Authorization: `Bearer ${sd?.session?.access_token || ''}` } })
        const d = await res.json()
        const links = res.ok && Array.isArray(d.links) ? d.links : []
        if (!links.length) { if (!cancel) setState('empty'); return }
        const results = await Promise.all(links.slice(0, 5).map((l: any) =>
          fetch(`/api/family-portal?code=${encodeURIComponent(l.code)}&verify=${encodeURIComponent(l.verify_digits)}`)
            .then(r => r.json()).then(dd => ({ name: l.patient_name, dd })).catch(() => null)
        ))
        let best: { name: string; line: string; at: string } | null = null
        for (const r of results) {
          if (!r || !r.dd) continue
          const msgs = (r.dd.messages || []).filter((m: any) => m.author_side === 'staff')
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg && (!best || lastMsg.created_at > best.at)) best = { name: r.name, line: lastMsg.content || 'Nova mensagem', at: lastMsg.created_at }
          const lastDay = (r.dd.dailySummaries || [])[0]
          if (lastDay && lastDay.lines?.[0] && (!best || lastDay.date > best.at)) best = { name: r.name, line: lastDay.lines[0], at: lastDay.date }
        }
        if (cancel) return
        if (best) setState({ ...best, n: links.length })
        else setState({ name: links[0].patient_name, line: 'Sem novidades recentes', at: new Date().toISOString(), n: links.length })
      } catch { if (!cancel) setState('empty') }
    })()
    return () => { cancel = true }
  }, [user, supabase])

  if (state === 'loading') return <Hero icon="chat" tag="Novidades da família" t={t}><div style={{ fontSize: 14, color: t.inkFaint }}>A carregar…</div></Hero>
  if (state === 'empty') return (
    <Hero icon="chat" tag="Novidades da família" t={t} href="/familia">
      <div style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>Ligue-se a um lar ou centro de dia →</div>
    </Hero>
  )
  return (
    <Hero icon="chat" tag={`Novidades da família${state.n > 1 ? ` · ${state.n} pessoas` : ''}`} t={t} href="/familia">
      <div style={{ fontSize: 14, color: t.ink, fontWeight: 600 }}>{state.name.split(' ')[0]}: <span style={{ fontWeight: 500, color: t.inkSoft }}>{state.line}</span></div>
    </Hero>
  )
}

// ─── Módulo principal — grelha de widgets do modo ───────────────────────────
const REGISTRY: Record<HomeWidgetId, (p: { t: ModeTheme; mode: string }) => React.ReactNode> = {
  symptoms: ({ t }) => <SymptomsWidget t={t} />,
  vitals: ({ t }) => <VitalsWidget t={t} />,
  interactions: ({ t, mode }) => <InteractionsWidget t={t} mode={mode} />,
  adherence: ({ t }) => <AdherenceWidget t={t} />,
  scan: ({ t, mode }) => <ScanWidget t={t} mode={mode} />,
  ai: ({ t }) => <AIWidget t={t} />,
  familyNews: ({ t }) => <FamilyNewsWidget t={t} />,
  reach: ({ t }) => <ReachWidget t={t} />,
}

export default function HomeWidgetsModule({ mode, theme: t }: { mode: string; theme: ModeTheme }) {
  const [widgets, setWidgets] = useState<HomeWidgetId[] | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  useEffect(() => { setWidgets(activeWidgets(mode).map(w => w.id)) }, [mode])

  if (widgets === null) return <div className="skeleton" style={{ height: 200, borderRadius: 10 }} />

  return (
    <div>
      <WidgetPickerModal open={pickerOpen} onClose={() => { setPickerOpen(false); setWidgets(activeWidgets(mode).map(w => w.id)) }} mode={mode} />
      {widgets.length === 0 ? (
        <div style={{ fontSize: 13, color: t.inkFaint, padding: '6px 0' }}>Sem widgets ativos. <button onClick={() => setPickerOpen(true)} style={{ background: 'none', border: 'none', color: t.accent, fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 13 }}>Escolher →</button></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {widgets.map(id => <Fragment key={id}>{REGISTRY[id]?.({ t, mode })}</Fragment>)}
        </div>
      )}
      <button onClick={() => setPickerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: t.accent, fontFamily: 'var(--font-sans)' }}>
        <Icon name="sliders" size={14} color={t.accent} /> Personalizar
      </button>
    </div>
  )
}
