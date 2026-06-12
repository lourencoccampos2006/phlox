'use client'

// PainelCockpit — o NOVO cockpit institucional, montado a partir do blueprint.
// Cada tipo de instituição vê o SEU painel, talhado de raiz. Lê dados reais e
// renderiza só os blocos do blueprint, pela ordem definida. O utilizador pode
// esconder blocos não-essenciais (persiste). Sem dados de exemplo: tudo vem do
// que a equipa regista. Reformulação institucional 2026-06-12.

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthContext'
import { useClinicPrefs } from '@/lib/useClinicPrefs'
import { institutionConfig } from '@/lib/institutionConfig'
import { blueprintFor, type BlockId, type CockpitBlock } from '@/lib/institutionBlueprint'
import { analyzeResident, SEVERITY_STYLE } from '@/lib/residentSignals'

const today = () => new Date().toISOString().slice(0, 10)
const HIDE_KEY = 'phlox-cockpit-hidden'

interface PatientRow { id: string; name: string; room_number?: string; age?: number; conditions?: string; allergies?: string }

export default function PainelCockpit() {
  const { user, supabase } = useAuth() as any
  const { institution, role } = useClinicPrefs()
  const bp = blueprintFor(institution)
  const cfg = institutionConfig(institution)

  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState(false)

  // dados reais
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [careToday, setCareToday] = useState<any[]>([])
  const [marToday, setMarToday] = useState<any[]>([])
  const [acts, setActs] = useState<any[]>([])
  const [incidents, setIncidents] = useState<any[]>([])
  const [family, setFamily] = useState<any[]>([])
  const [medsByPt, setMedsByPt] = useState<Record<string, string[]>>({})

  useEffect(() => {
    setMounted(true)
    try { const s = localStorage.getItem(HIDE_KEY); if (s) setHidden(new Set(JSON.parse(s))) } catch {}
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true); setErr('')
    const d = today()
    const [p, cr, mar, ac, inc, fam, meds] = await Promise.all([
      supabase.from('patients').select('id,name,room_number,age,conditions,allergies').eq('user_id', user.id).eq('active', true).order('name'),
      supabase.from('care_records').select('patient_id,date,shift,nutrition,mood').eq('user_id', user.id).eq('date', d),
      supabase.from('mar_records').select('patient_id,status,date').eq('user_id', user.id).eq('date', d),
      supabase.from('activities').select('id,title,type,date,start_time').eq('user_id', user.id).eq('date', d).order('start_time'),
      supabase.from('incidents').select('id,type,severity,status,date,patient_id').eq('user_id', user.id).eq('status', 'open'),
      supabase.from('family_thread_messages').select('id,patient_id,author_side,content,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('patient_meds').select('patient_id,name').eq('user_id', user.id),
    ])
    if (p.error) { setErr('Não foi possível carregar os dados. Verifica a ligação e tenta novamente.'); setLoading(false); return }
    setPatients(p.data || [])
    setCareToday(cr.data || [])
    setMarToday(mar.data || [])
    setActs(ac.data || [])
    setIncidents(inc.data || [])
    setFamily(fam.data || [])
    const m: Record<string, string[]> = {}
    ;(meds.data || []).forEach((x: any) => { (m[x.patient_id] ||= []).push(x.name) })
    setMedsByPt(m)
    setLoading(false)
  }, [user, supabase])

  useEffect(() => { load() }, [load])

  // ── derivados ──
  const withCareToday = useMemo(() => new Set(careToday.map(r => r.patient_id)), [careToday])
  const ranked = useMemo(() => patients.map(p => {
    const a = analyzeResident({
      age: p.age, conditions: p.conditions, allergies: p.allergies,
      meds: medsByPt[p.id] || [],
      incidents: incidents.filter(i => i.patient_id === p.id).map(i => ({ type: i.type, severity: i.severity, status: i.status })),
      assessments: [], wounds: [], weightSeries: [], fluidToday: null, lastBowelDays: null,
      careLoggedToday: withCareToday.has(p.id), latestVitals: null,
    })
    return { p, ...a }
  }).sort((a, b) => b.score - a.score), [patients, medsByPt, incidents, withCareToday])
  const attention = ranked.filter(r => r.level === 'critical' || r.level === 'warning')
  const marTaken = marToday.filter(m => m.status === 'taken' || m.status === 'given').length

  const toggleHide = (id: string) => {
    setHidden(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(HIDE_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }

  const firstName = user?.name?.split(' ')[0] || ''
  const visibleBlocks = bp.cockpit.filter(b => editing || b.essential || !hidden.has(b.id))

  // ── estilos por tom ──
  const warm = bp.tone === 'warm'
  const pageBg = warm ? '#fbfaf8' : '#f8fafc'

  if (!user) return null

  return (
    <div style={{ minHeight: '100vh', background: pageBg, fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '22px clamp(14px,3vw,28px) 60px' }}>

        {/* Cabeçalho — a cara do produto deste tipo */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: bp.accent, fontWeight: 700, marginBottom: 6 }}>{bp.productName}</div>
            <h1 style={{ fontFamily: warm ? 'var(--font-serif)' : 'var(--font-sans)', fontSize: warm ? 'clamp(26px,4vw,34px)' : 'clamp(22px,3vw,28px)', fontWeight: warm ? 500 : 800, color: '#0b1120', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {bp.greetingLead(firstName)}
            </h1>
            <p style={{ fontSize: 13.5, color: '#64748b', margin: '6px 0 0', maxWidth: 520, lineHeight: 1.5 }}>{bp.tagline}</p>
          </div>
          <button onClick={() => setEditing(e => !e)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: editing ? bp.accent : 'white', color: editing ? 'white' : '#64748b', border: `1px solid ${editing ? bp.accent : 'var(--border)'}`, borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {editing ? '✓ Concluir' : '⚙ Personalizar'}
          </button>
        </div>

        {err && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <span style={{ color: '#b91c1c', fontSize: 18 }}>⚠</span>
            <span style={{ flex: 1, fontSize: 13.5, color: '#991b1b' }}>{err}</span>
            <button onClick={() => load()} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Tentar novamente</button>
          </div>
        )}

        {/* Grelha de blocos — montada do blueprint */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
          {visibleBlocks.map(block => (
            <BlockShell key={block.id} block={block} editing={editing} hidden={hidden.has(block.id)} onToggle={() => toggleHide(block.id)} accent={bp.accent}>
              <BlockBody
                id={block.id} bp={bp} cfg={cfg} loading={loading}
                ctx={{ patients, careToday, withCareToday, marToday, marTaken, acts, incidents, family, attention, firstName }}
              />
            </BlockShell>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shell de cada bloco: trata do tamanho (span) e do modo personalizar ──
const SPAN: Record<string, number> = { hero: 12, large: 8, medium: 6, small: 4 }
function BlockShell({ block, editing, hidden, onToggle, accent, children }: { block: CockpitBlock; editing: boolean; hidden: boolean; onToggle: () => void; accent: string; children: React.ReactNode }) {
  const span = SPAN[block.size] || 6
  return (
    <div style={{ gridColumn: `span ${span}`, position: 'relative', opacity: editing && hidden ? 0.45 : 1 }} className={`blk blk-${block.size}`}>
      {editing && !block.essential && (
        <button onClick={onToggle} style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: hidden ? '#e2e8f0' : accent, color: hidden ? '#475569' : 'white', border: 'none', borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
          {hidden ? 'Mostrar' : 'Esconder'}
        </button>
      )}
      {editing && block.essential && (
        <span style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: '#f1f5f9', color: '#94a3b8', borderRadius: 7, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>fixo</span>
      )}
      {children}
      <style>{`@media (max-width: 760px){ .blk { grid-column: span 12 !important; } }`}</style>
    </div>
  )
}

// ── Cartão base ──
const card: React.CSSProperties = { background: 'white', border: '1px solid #e9eaec', borderRadius: 16, padding: '16px 18px', height: '100%', boxSizing: 'border-box' }
const blkTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#0b1120', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }

interface Ctx {
  patients: PatientRow[]; careToday: any[]; withCareToday: Set<string>; marToday: any[]; marTaken: number
  acts: any[]; incidents: any[]; family: any[]; attention: any[]; firstName: string
}

function BlockBody({ id, bp, cfg, loading, ctx }: { id: BlockId; bp: any; cfg: any; loading: boolean; ctx: Ctx }) {
  const noun = cfg.personNounPlural
  if (loading) return <div style={{ ...card, color: '#94a3b8', fontSize: 13 }}>A carregar…</div>

  switch (id) {
    case 'day_overview': {
      const present = ctx.withCareToday.size
      return (
        <div style={{ ...card, background: bp.accent, border: 'none', color: 'white' }}>
          <div style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, marginBottom: 10 }}>O dia de hoje</div>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
            <Stat n={ctx.patients.length} l={noun} light />
            <Stat n={present} l="com registo hoje" light />
            <Stat n={ctx.marTaken} l="tomas dadas" light />
            <Stat n={ctx.acts.length} l="atividades" light />
          </div>
        </div>
      )
    }
    case 'attendance': {
      // Presença = tem registo de cuidado hoje. Quem não tem ainda = "por chegar/registar".
      const present = ctx.patients.filter(p => ctx.withCareToday.has(p.id))
      const pending = ctx.patients.filter(p => !ctx.withCareToday.has(p.id))
      return (
        <div style={card}>
          <div style={blkTitle}>🟢 Presenças <span style={{ color: '#94a3b8', fontWeight: 600 }}>{present.length}/{ctx.patients.length}</span></div>
          {ctx.patients.length === 0 ? <Empty msg={`Sem ${noun.toLowerCase()} ainda.`} href="/patients" cta={`Adicionar ${noun.toLowerCase()}`} />
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {present.slice(0, 24).map(p => <Chip key={p.id} label={p.name.split(' ')[0]} tone="ok" />)}
              {pending.slice(0, 16).map(p => <Chip key={p.id} label={p.name.split(' ')[0]} tone="pending" />)}
            </div>}
          {pending.length > 0 && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 10 }}>{pending.length} ainda sem registo hoje</div>}
        </div>
      )
    }
    case 'med_round': {
      return (
        <div style={card}>
          <div style={blkTitle}>💊 Medicação a dar</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0b1120', lineHeight: 1 }}>{ctx.marTaken}<span style={{ fontSize: 14, color: '#94a3b8', fontWeight: 600 }}> tomas registadas hoje</span></div>
          <Link href="/mar" style={{ display: 'inline-block', marginTop: 12, fontSize: 12.5, fontWeight: 700, color: bp.accent, textDecoration: 'none' }}>Abrir medicação →</Link>
        </div>
      )
    }
    case 'people_watch': {
      return (
        <div style={card}>
          <div style={blkTitle}>👁 A vigiar {ctx.attention.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fef2f2', padding: '2px 7px', borderRadius: 6 }}>{ctx.attention.length}</span>}</div>
          {ctx.attention.length === 0 ? <div style={{ fontSize: 13, color: '#16a34a' }}>Tudo tranquilo — ninguém em alerta. ✓</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {ctx.attention.slice(0, 6).map(({ p, score, level, summary }: any) => {
                const st = SEVERITY_STYLE[level as keyof typeof SEVERITY_STYLE]
                return <Link key={p.id} href={`/patients/${p.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: st.bg, border: `1.5px solid ${st.border}`, color: st.color, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{score}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0b1120' }}>{p.name}</span>
                    <span style={{ display: 'block', fontSize: 11, color: st.color }}>{summary}</span>
                  </span>
                </Link>
              })}
            </div>}
        </div>
      )
    }
    case 'activities': {
      return (
        <div style={card}>
          <div style={blkTitle}>🎯 Atividades de hoje</div>
          {ctx.acts.length === 0 ? <Empty msg="Sem atividades marcadas para hoje." href="/activities" cta="Planear atividades" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ctx.acts.slice(0, 5).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#334155' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#94a3b8', minWidth: 38 }}>{a.start_time || '—'}</span>
                  <span style={{ fontWeight: 600 }}>{a.title}</span>
                </div>
              ))}
            </div>}
        </div>
      )
    }
    case 'family_feed': {
      return (
        <div style={card}>
          <div style={blkTitle}>👨‍👩‍👧 Famílias</div>
          {ctx.family.length === 0 ? <Empty msg="Nenhuma mensagem ainda. Partilha como correu o dia." href="/family" cta="Abrir portal das famílias" />
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ctx.family.slice(0, 4).map(m => (
                <div key={m.id} style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.45 }}>
                  <span style={{ fontWeight: 700, color: m.author_side === 'family' ? '#b45309' : bp.accent }}>{m.author_side === 'family' ? 'Família' : 'Equipa'}:</span> {(m.content || '').slice(0, 90)}
                </div>
              ))}
            </div>}
          <Link href="/family" style={{ display: 'inline-block', marginTop: 10, fontSize: 12, fontWeight: 700, color: bp.accent, textDecoration: 'none' }}>Ver tudo →</Link>
        </div>
      )
    }
    case 'incidents': {
      return (
        <div style={card}>
          <div style={blkTitle}>⚠️ Ocorrências</div>
          {ctx.incidents.length === 0 ? <div style={{ fontSize: 13, color: '#16a34a' }}>Nenhuma em aberto. ✓</div>
          : <div style={{ fontSize: 13, color: '#b91c1c', fontWeight: 700 }}>{ctx.incidents.length} em aberto · <Link href="/incidents" style={{ color: '#b91c1c' }}>ver</Link></div>}
        </div>
      )
    }
    case 'quick_actions': {
      return (
        <div style={card}>
          <div style={blkTitle}>⚡ Ações rápidas</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {bp.coreTools.slice(0, 4).map((t: any) => (
              <Link key={t.href} href={t.href} style={{ textDecoration: 'none', background: bp.accentSoft, borderRadius: 9, padding: '9px 11px', fontSize: 12, fontWeight: 700, color: '#0b1120' }}>{t.icon} {t.label}</Link>
            ))}
          </div>
        </div>
      )
    }
    // Blocos de farmácia/clínica/hospital — placeholders honestos que ligam à tool real
    case 'counter':        return <LinkBlock title="🧾 Balcão" hint="Atendimentos e fila de utentes" href="/balcao" accent={bp.accent} />
    case 'sales_today':    return <LinkBlock title="🛒 Vendas de hoje" hint="Caixa e dispensa do dia" href="/vendas" accent={bp.accent} />
    case 'validation_queue': return <LinkBlock title="📬 Validação" hint="Prescrições a validar" href="/prescription-queue" accent={bp.accent} />
    case 'appointments':   return <LinkBlock title="📅 Agenda de hoje" hint="Marcações e consultas" href="/agenda" accent={bp.accent} />
    case 'tasks':          return <LinkBlock title="✅ Tarefas" hint="Pendentes da equipa" href="/tarefas-equipa" accent={bp.accent} />
    default: return null
  }
}

// ── peças pequenas ──
function Stat({ n, l, light }: { n: number; l: string; light?: boolean }) {
  return <div><div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: light ? 'white' : '#0b1120' }}>{n}</div><div style={{ fontSize: 11.5, marginTop: 4, color: light ? 'rgba(255,255,255,0.8)' : '#94a3b8', fontWeight: 600 }}>{l}</div></div>
}
function Chip({ label, tone }: { label: string; tone: 'ok' | 'pending' }) {
  const s = tone === 'ok' ? { bg: '#f0fdf4', bd: '#bbf7d0', c: '#15803d' } : { bg: '#fffbeb', bd: '#fde68a', c: '#b45309' }
  return <span style={{ fontSize: 12, fontWeight: 600, color: s.c, background: s.bg, border: `1px solid ${s.bd}`, padding: '3px 9px', borderRadius: 99 }}>{label}</span>
}
function Empty({ msg, href, cta }: { msg: string; href: string; cta: string }) {
  return <div style={{ textAlign: 'center', padding: '14px 0' }}><div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>{msg}</div><Link href={href} style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}>{cta} →</Link></div>
}
function LinkBlock({ title, hint, href, accent }: { title: string; hint: string; href: string; accent: string }) {
  return <Link href={href} style={{ ...card, display: 'block', textDecoration: 'none' }}>
    <div style={blkTitle}>{title}</div>
    <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10 }}>{hint}</div>
    <span style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>Abrir →</span>
  </Link>
}
