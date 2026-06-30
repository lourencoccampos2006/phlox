'use client'

// /familia360 — Hub para cuidador familiar. Integra:
//   • Inbox do dia (último que aconteceu em cada familiar)
//   • Auditor de duplicações cruzadas (mesmo DCI em 2 familiares)
//   • Reconciliação de medicação (antes vs depois)
//   • Avaliação Zarit-12 da sobrecarga do cuidador
//   • Atalho para o Cofre / share codes

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import Link from 'next/link'
import { ZARIT12_QUESTIONS, ZARIT12_OPTIONS, ZARIT12_BAND_META, zarit12Band, reconcile, type MedItem } from '@/lib/caregiverScales'

type Tab = 'inbox' | 'reconcile' | 'audit' | 'burden' | 'vault'

export default function Familia360Page() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('inbox')
  const plan = ((user as any)?.plan || 'free') as string
  const canUse = plan !== 'free'

  if (!canUse) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 520, textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)' }}>Família 360°</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.7, marginBottom: 24 }}>
          O hub do cuidador familiar — inbox, reconciliação, auditoria de duplicações, avaliação de sobrecarga e cofre partilhado.
        </p>
        <Link href="/pricing" style={{ display: 'inline-block', background: '#b45309', color: 'white', textDecoration: 'none', padding: '12px 28px', borderRadius: 8, fontWeight: 700 }}>Ver planos →</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: 'var(--font-sans)' }}>
      <div className="page-container page-body" style={{ maxWidth: 980 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>Cuidador · Premium</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(26px,3vw,36px)', color: '#0b1120', margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>Família 360°</h1>
          <p style={{ fontSize: 14, color: '#475569', margin: '6px 0 0', lineHeight: 1.55 }}>O painel do cuidador. Tudo num só sítio.</p>
        </div>

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 16, overflowX: 'auto' }}>
          {([
            ['inbox',     '📥 Inbox do dia'],
            ['reconcile', '🔁 Reconciliar receitas'],
            ['audit',     '🔍 Auditor cruzado'],
            ['burden',    '💛 Sobrecarga (Zarit)'],
            ['vault',     '🔒 Cofre & partilhas'],
          ] as [Tab, string][]).map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding: '10px 14px', background: tab === id ? '#fffbeb' : 'white', border: 'none', borderBottom: `2.5px solid ${tab === id ? '#b45309' : 'transparent'}`, fontSize: 13, fontWeight: tab === id ? 800 : 600, color: tab === id ? '#b45309' : '#475569', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}>
              {l}
            </button>
          ))}
        </div>

        {tab === 'inbox' && <InboxTab />}
        {tab === 'reconcile' && <ReconcileTab />}
        {tab === 'audit' && <AuditTab />}
        {tab === 'burden' && <BurdenTab />}
        {tab === 'vault' && <VaultTab />}
      </div>
    </div>
  )
}

// ─── Inbox ────────────────────────────────────────────────────────────────────
function InboxTab() {
  const { user, supabase } = useAuth()
  const [profiles, setProfiles] = useState<any[]>([])
  const [events, setEvents] = useState<Record<string, any[]>>({})
  const [refills, setRefills] = useState<Record<string, { name: string; daysLeft: number }[]>>({})
  const [alerts, setAlerts] = useState<Record<string, any[]>>({})

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      // 2026-06-02: a coluna é "relation" (sprint1) e não "relationship".
      const { data: profs, error } = await supabase.from('family_profiles').select('*').eq('user_id', user.id)
      if (error) console.error('[familia360] family_profiles:', error)
      const list = profs || []
      setProfiles(list)
      if (!list.length) return
      const ids = list.map((p: any) => p.id)
      const today = new Date(); today.setHours(0, 0, 0, 0)

      // Alertas da vigilância (cron) — abertos, por familiar. Degrada a vazio.
      const fa = await supabase.from('family_alerts')
        .select('id, profile_id, kind, severity, title, detail, created_at')
        .eq('user_id', user.id).is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .then((r: any) => r.data || [], () => [])
      const al: Record<string, any[]> = {}
      ;(fa as any[]).forEach((a: any) => (al[a.profile_id] ||= []).push(a))
      setAlerts(al)

      const ev: Record<string, any[]> = {}
      const rf: Record<string, { name: string; daysLeft: number }[]> = {}
      await Promise.all(list.map(async (p: any) => {
        // CORREÇÃO 2026-06-28: antes lia med_logs/vital_signs por user_id (todos os
        // cartões mostravam o mesmo) e a tabela errada (vital_signs). Agora lê os
        // VITAIS reais (tabela 'vitals', por profile_id) + agenda + refill por familiar.
        const [v, c, meds] = await Promise.all([
          supabase.from('vitals').select('recorded_at, bp_sys, bp_dia, hr, weight, glucose, spo2').eq('profile_id', p.id).gte('recorded_at', today.toISOString()).limit(10).then((r: any) => r, () => ({ data: [] })),
          supabase.from('cal_events').select('id, title, starts_at').eq('user_id', user.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(5),
          supabase.from('family_profile_meds').select('name, pills_remaining, pills_per_day').eq('profile_id', p.id),
        ])
        ev[p.id] = [
          ...((v.data || []) as any[]).map((r: any) => ({ kind: 'vital', when: r.recorded_at, text: `TA ${r.bp_sys ?? '—'}/${r.bp_dia ?? '—'}${r.hr ? ` · FC ${r.hr}` : ''}${r.glucose ? ` · Glic ${r.glucose}` : ''}${r.weight ? ` · ${r.weight}kg` : ''}` })),
          ...(c.data || []).map((r: any) => ({ kind: 'event', when: r.starts_at, text: `Próximo: ${r.title}` })),
        ].sort((a, b) => b.when.localeCompare(a.when))
        rf[p.id] = (meds.data || [])
          .filter((mm: any) => mm.pills_remaining != null && mm.pills_per_day && mm.pills_per_day > 0)
          .map((mm: any) => ({ name: mm.name, daysLeft: Math.floor((mm.pills_remaining || 0) / mm.pills_per_day) }))
          .filter(x => x.daysLeft <= 14)
          .sort((a, b) => a.daysLeft - b.daysLeft)
      }))
      setEvents(ev)
      setRefills(rf)
    })()
  }, [user?.id])

  const SEV_C: Record<string, string> = { critical: '#991b1b', major: '#b91c1c', moderate: '#b45309', minor: '#1d4ed8', info: '#64748b' }
  const dismiss = async (id: string, pid: string) => {
    setAlerts(prev => ({ ...prev, [pid]: (prev[pid] || []).filter(a => a.id !== id) }))
    await supabase.from('family_alerts').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
  }

  if (profiles.length === 0) return <Empty msg="Sem perfis familiares ainda. Cria perfis em /perfis ou /familia." />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 12 }}>
      {profiles.map(p => {
        const evs = events[p.id] || []
        const rf = refills[p.id] || []
        const al = alerts[p.id] || []
        return (
          <div key={p.id} style={{ background: 'white', border: `1px solid ${al.some(a => a.severity === 'critical') ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0b1120' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{p.relation || p.relationship || ''}</div>
              </div>
              <Link href={`/familia?p=${p.id}`} style={{ fontSize: 11, color: '#b45309', textDecoration: 'none', fontWeight: 700 }}>Abrir →</Link>
            </div>
            {/* Alertas da vigilância — o que o Phlox detetou e precisa de atenção */}
            {al.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                {al.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ background: `${SEV_C[a.severity]}0f`, border: `1px solid ${SEV_C[a.severity]}33`, borderRadius: 7, padding: '7px 9px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: SEV_C[a.severity] }}>⚠ {a.title}</span>
                      <button onClick={() => dismiss(a.id, p.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 11, padding: 0 }}>×</button>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4, marginTop: 1 }}>{a.detail}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Refill em destaque — o cuidador vê logo o que vai acabar */}
            {rf.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 10 }}>
                {rf.slice(0, 3).map((r, i) => {
                  const c = r.daysLeft <= 3 ? '#dc2626' : r.daysLeft <= 7 ? '#b45309' : '#0d6e42'
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '4px 8px', background: c === '#dc2626' ? '#fef2f2' : c === '#b45309' ? '#fffbeb' : '#f0fdf5', borderRadius: 6, border: `1px solid ${c}33` }}>
                      <span style={{ color: '#0b1120', fontWeight: 700 }}>📦 {r.name}</span>
                      <span style={{ color: c, fontWeight: 800, fontFamily: 'var(--font-mono)' }}>{r.daysLeft}d</span>
                    </div>
                  )
                })}
              </div>
            )}
            {evs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 12 }}>Sem atividade hoje</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evs.slice(0, 6).map((e, i) => (
                  <div key={i} style={{ display: 'flex', gap: 7, fontSize: 12, color: '#475569', padding: '4px 0' }}>
                    <span style={{ width: 16, color: e.kind === 'med' ? '#0d6e42' : e.kind === 'vital' ? '#1d4ed8' : '#b45309' }}>{e.kind === 'med' ? '💊' : e.kind === 'vital' ? '❤' : '📅'}</span>
                    <span style={{ flex: 1, lineHeight: 1.5 }}>{e.text}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontSize: 10 }}>{new Date(e.when).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Reconcile ────────────────────────────────────────────────────────────────
function ReconcileTab() {
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')

  function parse(txt: string): MedItem[] {
    return txt.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      // formato livre: "Ramipril 5mg 1x dia"
      const m = line.match(/^([^\d]+?)\s*([\d.,]+\s*mg|[\d.,]+\s*mcg|[\d.,]+\s*g)?\s*(.*)$/i)
      return { name: (m?.[1] || line).trim(), dose: (m?.[2] || '').trim(), frequency: (m?.[3] || '').trim() }
    })
  }
  const diff = useMemo(() => reconcile(parse(beforeText), parse(afterText)), [beforeText, afterText])

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
        Cola a lista <strong>antes</strong> e <strong>depois</strong> (ex: antes vs depois do internamento). Um medicamento por linha — formato livre.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <Label>Antes</Label>
          <textarea value={beforeText} onChange={e => setBeforeText(e.target.value)} rows={8}
            placeholder="Ramipril 5mg manhã&#10;Bisoprolol 2,5mg manhã&#10;…"
            style={textarea()} />
        </div>
        <div>
          <Label>Depois</Label>
          <textarea value={afterText} onChange={e => setAfterText(e.target.value)} rows={8}
            placeholder="Ramipril 10mg manhã&#10;Bisoprolol 5mg manhã&#10;Furosemida 20mg manhã&#10;…"
            style={textarea()} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))', gap: 10 }}>
        <DiffBlock title="✚ Novos" color="#0d6e42" items={diff.added.map(m => `${m.name} ${m.dose || ''} ${m.frequency || ''}`.trim())} />
        <DiffBlock title="✕ Removidos" color="#dc2626" items={diff.removed.map(m => `${m.name} ${m.dose || ''} ${m.frequency || ''}`.trim())} />
        <DiffBlock title="↻ Alterados" color="#d97706" items={diff.changed.map(c => `${c.name} — ${c.what.join('; ')}`)} />
        <DiffBlock title="= Mantidos" color="#94a3b8" items={diff.unchanged.map(m => `${m.name} ${m.dose || ''}`.trim())} muted />
      </div>
    </div>
  )
}

function DiffBlock({ title, color, items, muted }: { title: string; color: string; items: string[]; muted?: boolean }) {
  return (
    <div style={{ background: muted ? '#f8fafc' : 'white', border: `1px solid ${color}40`, borderLeft: `3px solid ${color}`, borderRadius: 8, padding: 10 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>{title} · {items.length}</div>
      {items.length === 0 ? <div style={{ fontSize: 11, color: '#94a3b8' }}>—</div> : items.map((t, i) => <div key={i} style={{ fontSize: 12, color: '#0b1120', lineHeight: 1.5, padding: '2px 0', borderBottom: i < items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>{t}</div>)}
    </div>
  )
}

// ─── Audit cruzado (duplicações entre familiares) ─────────────────────────────
function AuditTab() {
  const { user, supabase } = useAuth()
  const [meds, setMeds] = useState<{ profile: string; name: string }[]>([])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data: profs } = await supabase.from('family_profiles').select('id, name').eq('user_id', user.id)
      const list: { profile: string; name: string }[] = []
      // CORREÇÃO 2026-06-28: o auditor lia personal_meds (do próprio) para TODOS os
      // familiares → "duplicações" falsas (todos partilhavam a mesma lista). Agora lê
      // a medicação REAL de cada familiar (family_profile_meds por profile_id) — mais
      // o próprio (personal_meds), porque uma duplicação cuidador↔familiar também conta.
      const me = await supabase.from('personal_meds').select('name').eq('user_id', user.id)
      ;(me.data || []).forEach((m: any) => list.push({ profile: 'Eu', name: m.name }))
      await Promise.all((profs || []).map(async (p: any) => {
        const { data } = await supabase.from('family_profile_meds').select('name').eq('profile_id', p.id)
        ;(data || []).forEach((m: any) => list.push({ profile: p.name, name: m.name }))
      }))
      setMeds(list)
    })()
  }, [user?.id])

  // Agrega por nome DCI
  const dupes = useMemo(() => {
    const map = new Map<string, Set<string>>()
    meds.forEach(m => {
      const k = (m.name || '').trim().toLowerCase().replace(/\s+\d.*$/, '')
      if (!k) return
      if (!map.has(k)) map.set(k, new Set())
      map.get(k)!.add(m.profile)
    })
    return Array.from(map.entries())
      .filter(([, s]) => s.size > 1)
      .map(([name, set]) => ({ name, profiles: Array.from(set) }))
      .sort((a, b) => b.profiles.length - a.profiles.length)
  }, [meds])

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 12 }}>
        Mostra fármacos que aparecem em mais do que um familiar. Útil para confirmar prescrições paralelas, evitar trocas acidentais entre familiares, e identificar oportunidades de partilha de informação clínica.
      </p>
      {dupes.length === 0 ? (
        <Empty msg="Nenhum medicamento aparece em múltiplos familiares com os dados atuais." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {dupes.map((d, i) => (
            <div key={i} style={{ background: 'white', border: '1px solid #fde68a', borderLeft: '3px solid #d97706', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{d.name}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>Familiares: <strong>{d.profiles.join(', ')}</strong></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Burden (Zarit-12) ────────────────────────────────────────────────────────
function BurdenTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [caringFor, setCaringFor] = useState('')
  const [answers, setAnswers] = useState<number[]>(new Array(12).fill(-1))
  const [history, setHistory] = useState<any[]>([])
  const [load, setLoad] = useState<{ people: number; meds: number; alerts: number } | null>(null)

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      const { data } = await supabase.from('caregiver_burden').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }).limit(10)
      setHistory(data || [])
      // Carga REAL de cuidado — dá contexto objetivo à autoavaliação (degrada a 0).
      const { data: profs } = await supabase.from('family_profiles').select('id').eq('user_id', user.id)
      const ids = (profs || []).map((p: any) => p.id)
      const [meds, alerts] = await Promise.all([
        ids.length ? supabase.from('family_profile_meds').select('id', { count: 'exact', head: true }).in('profile_id', ids).then((r: any) => r.count || 0, () => 0) : Promise.resolve(0),
        supabase.from('family_alerts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('dismissed_at', null).then((r: any) => r.count || 0, () => 0),
      ])
      setLoad({ people: ids.length, meds: meds as number, alerts: alerts as number })
    })()
  }, [user?.id])

  const total = answers.filter(a => a >= 0).reduce((a, b) => a + b, 0)
  const complete = answers.every(a => a >= 0)
  const band = zarit12Band(total)
  const meta = ZARIT12_BAND_META[band]

  async function save() {
    if (!complete) { toast.error('Responde a todas as perguntas'); return }
    if (!caringFor.trim()) { toast.error('Indica o nome do familiar'); return }
    const ans: any = {}
    answers.forEach((a, i) => { ans[`q${i + 1}`] = a })
    const { error } = await supabase.from('caregiver_burden').insert({
      user_id: user!.id,
      caring_for: caringFor.trim(),
      answers: ans, total, band,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Avaliação guardada')
    setAnswers(new Array(12).fill(-1))
    const { data } = await supabase.from('caregiver_burden').select('*').eq('user_id', user!.id).order('measured_at', { ascending: false }).limit(10)
    setHistory(data || [])
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, marginBottom: 14 }}>
        <strong>Zarit-12</strong> é a escala validada internacionalmente para medir a sobrecarga do cuidador familiar (Bedard 2001). Responde a estas 12 perguntas — leva ~3 min.
      </p>

      {/* Carga real — torna a autoavaliação concreta, não abstrata */}
      {load && load.people > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { n: load.people, l: load.people === 1 ? 'pessoa ao seu cuidado' : 'pessoas ao seu cuidado' },
            { n: load.meds, l: 'medicamentos a gerir' },
            { n: load.alerts, l: load.alerts === 1 ? 'alerta por resolver' : 'alertas por resolver', warn: load.alerts > 0 },
          ].map((s, i) => (
            <div key={i} style={{ flex: '1 1 110px', background: (s as any).warn ? '#fef2f2' : 'white', border: `1px solid ${(s as any).warn ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: (s as any).warn ? '#b91c1c' : '#0b1120', fontFamily: 'var(--font-mono)' }}>{s.n}</div>
              <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.3, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      <Label>Cuido principalmente de:</Label>
      <input value={caringFor} onChange={e => setCaringFor(e.target.value)} placeholder="Ex: Mãe, Pai, Avó Maria…" style={input()} />

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ZARIT12_QUESTIONS.map((q, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 13, color: '#0b1120', marginBottom: 6, lineHeight: 1.45 }}><strong>{i + 1}.</strong> {q}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ZARIT12_OPTIONS.map(o => (
                <button key={o.v} onClick={() => setAnswers(p => p.map((x, j) => j === i ? o.v : x))}
                  style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${answers[i] === o.v ? '#b45309' : '#e5e7eb'}`, background: answers[i] === o.v ? '#fffbeb' : 'white', color: answers[i] === o.v ? '#b45309' : '#475569', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{o.label}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {complete && (
        <div style={{ marginTop: 14, background: meta.color + '14', border: `1px solid ${meta.color}40`, borderLeft: `4px solid ${meta.color}`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: meta.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Score {total}/48</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: meta.color, marginTop: 4 }}>{meta.label}</div>
          <div style={{ fontSize: 13, color: '#0b1120', marginTop: 6, lineHeight: 1.55 }}>{meta.advice}</div>
          <button onClick={save} style={{ marginTop: 10, padding: '9px 16px', background: meta.color, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Guardar avaliação</button>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <Label>Histórico</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map(h => {
              const m = ZARIT12_BAND_META[h.band as keyof typeof ZARIT12_BAND_META]
              return (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7 }}>
                  <span style={{ fontSize: 12, color: '#475569' }}>{new Date(h.measured_at).toLocaleDateString('pt-PT')} · {h.caring_for}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: m.color }}>{h.total}/48 · {m.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Vault tab — cofre de documentos POR FAMILIAR (fotografar, guardar, perguntar) ──
function VaultTab() {
  const { user, supabase } = useAuth()
  const toast = useToast()
  const [profiles, setProfiles] = useState<any[]>([])
  const [sel, setSel] = useState<string>('')   // profile_id ativo
  const [docs, setDocs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [openDoc, setOpenDoc] = useState<any>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [asking, setAsking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadDocs = async (pid: string) => {
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch(`/api/family/documents?profile_id=${pid}`, { headers: { Authorization: `Bearer ${sd.session?.access_token}` } })
    const d = await res.json()
    setDocs(d.documents || [])
  }

  useEffect(() => {
    if (!user?.id) return
    supabase.from('family_profiles').select('id, name').eq('user_id', user.id).order('name')
      .then(({ data }: any) => {
        setProfiles(data || [])
        if (data?.length) { setSel(data[0].id); loadDocs(data[0].id) }
      })
  }, [user?.id])

  const upload = async (file: File) => {
    if (!sel) { toast.error('Escolhe primeiro o familiar.'); return }
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve((r.result as string).split(',')[1]); r.onerror = reject; r.readAsDataURL(file)
      })
      const { data: sd } = await supabase.auth.getSession()
      const res = await fetch('/api/family/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
        body: JSON.stringify({ profile_id: sel, image: base64, mimeType: file.type || 'image/jpeg' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao guardar')
      toast.success('Documento guardado no cofre')
      if (d.warning) toast.error(d.warning)
      loadDocs(sel)
    } catch (e: any) { toast.error(e.message) }
    setUploading(false)
  }

  const ask = async () => {
    if (!openDoc || !question.trim()) return
    setAsking(true); setAnswer('')
    const { data: sd } = await supabase.auth.getSession()
    const res = await fetch('/api/family/documents', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` },
      body: JSON.stringify({ document_id: openDoc.id, question }),
    })
    const d = await res.json()
    setAnswer(d.answer || d.error || 'Não consegui responder.')
    setAsking(false)
  }

  const del = async (id: string) => {
    const { data: sd } = await supabase.auth.getSession()
    await fetch('/api/family/documents', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sd.session?.access_token}` }, body: JSON.stringify({ id }) })
    setDocs(p => p.filter(x => x.id !== id))
    if (openDoc?.id === id) setOpenDoc(null)
  }

  if (profiles.length === 0) return <Empty msg="Cria primeiro um familiar em /perfis ou /familia para guardar os documentos dele." />

  const KIND_ICON: Record<string, string> = { receita: '💊', analise: '🧪', relatorio: '📄', bula: '📋', outro: '📎' }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 14 }}>
        Fotografe um exame, receita ou relatório do seu familiar. O Phlox lê, resume e guarda — e depois pode <strong>fazer perguntas</strong> sobre o documento. Para partilhar com um médico sem dar acesso, use o <Link href="/vault" style={{ color: '#b45309', fontWeight: 700 }}>cofre com código temporário</Link>.
      </p>

      {/* Seletor de familiar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {profiles.map((p: any) => (
          <button key={p.id} onClick={() => { setSel(p.id); setOpenDoc(null); loadDocs(p.id) }}
            style={{ padding: '7px 13px', borderRadius: 20, border: `1.5px solid ${sel === p.id ? '#b45309' : '#e5e7eb'}`, background: sel === p.id ? '#fffbeb' : 'white', color: sel === p.id ? '#b45309' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* Upload */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ width: '100%', padding: '14px', background: uploading ? '#f1f5f9' : '#b45309', color: uploading ? '#94a3b8' : 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: uploading ? 'default' : 'pointer', marginBottom: 14 }}>
        {uploading ? 'A ler o documento…' : '📷 Fotografar / carregar documento'}
      </button>

      {/* Lista de documentos */}
      {docs.length === 0 ? (
        <Empty msg="Ainda sem documentos para este familiar. Fotografe o primeiro acima." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(d => (
            <div key={d.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0b1120' }}>{KIND_ICON[d.kind] || '📎'} {d.title}</div>
                  <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.5, marginTop: 3 }}>{d.summary}</div>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', fontFamily: 'var(--font-mono)', marginTop: 4 }}>{new Date(d.created_at).toLocaleDateString('pt-PT')}</div>
                </div>
                <button onClick={() => del(d.id)} style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', fontSize: 16, padding: 0 }} aria-label="Apagar">×</button>
              </div>
              <button onClick={() => { setOpenDoc(openDoc?.id === d.id ? null : d); setQuestion(''); setAnswer('') }}
                style={{ marginTop: 8, fontSize: 12.5, fontWeight: 700, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {openDoc?.id === d.id ? 'Fechar' : '💬 Fazer uma pergunta sobre este documento'}
              </button>
              {openDoc?.id === d.id && (
                <div style={{ marginTop: 8, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask() }}
                      placeholder="Ex: Algum valor está alterado?" style={{ ...input(), flex: 1 }} />
                    <button onClick={ask} disabled={asking || !question.trim()} style={{ padding: '9px 14px', background: asking || !question.trim() ? '#f1f5f9' : '#b45309', color: asking || !question.trim() ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 800, cursor: asking || !question.trim() ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                      {asking ? '…' : 'Perguntar'}
                    </button>
                  </div>
                  {answer && <div style={{ marginTop: 8, fontSize: 13, color: '#0b1120', lineHeight: 1.6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>{answer}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ background: 'white', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, lineHeight: 1.55 }}>{msg}</div>
}
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, marginBottom: 5, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</div> }
function input(): React.CSSProperties { return { width: '100%', boxSizing: 'border-box', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13.5, fontFamily: 'var(--font-sans)', outline: 'none' } }
function textarea(): React.CSSProperties { return { ...input(), fontFamily: 'var(--font-mono)', fontSize: 12.5, lineHeight: 1.55, resize: 'vertical' } }
